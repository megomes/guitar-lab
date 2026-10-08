"""Etapa 4b: encaixe. Coloca nas subcategorias de destino as ideias que a consolidação marcou como "fora do lugar".

Para cada subcategoria de destino, o Opus (Batch API) recebe os itens que já existem (id + título + resumo curto) e
as ideias que chegaram, e decide: anexar cada ideia a um item existente ou criar itens novos com elas.
Cobertura validada: toda ideia recebida precisa ir para um anexo ou um item novo.

Uso (da raiz do projeto):
  python solos/scripts/encaixar.py enviar [--sim]
  python solos/scripts/encaixar.py acompanhar
  python solos/scripts/encaixar.py coletar
"""
import argparse
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming  # noqa: E402
from anthropic.types.messages.batch_create_params import Request  # noqa: E402

import consolidar as cons  # noqa: E402
import fichar_api  # noqa: E402

OUT = cons.OUT
STATE = OUT / "_encaixe.json"
MODEL = "claude-opus-5-5"

ITEM_SCHEMA = cons.SCHEMA["properties"]["itens"]
SCHEMA = {
    "type": "object", "additionalProperties": False, "required": ["anexos", "novos_itens"],
    "properties": {
        "anexos": {"type": "array", "items": {
            "type": "object", "additionalProperties": False, "required": ["id", "item"],
            "properties": {"id": {"type": "integer", "description": "número (#) da ideia"},
                           "item": {"type": "string", "description": "id do item existente (K..)"}}}},
        "novos_itens": ITEM_SCHEMA,
    },
}

SYSTEM = """Você mantém uma base consolidada sobre SOLO e IMPROVISAÇÃO na guitarra (português do Brasil).
Uma subcategoria já tem itens canônicos. Chegaram ideias novas, vindas de outras subcategorias.
Para CADA ideia recebida, decida:
- se diz essencialmente o mesmo que um item existente, ANEXE ao item (anexos: id da ideia + id do item);
- se traz algo que nenhum item cobre, crie um item NOVO (novos_itens), juntando ideias novas parecidas entre si.
Toda ideia recebida precisa aparecer exatamente uma vez (num anexo ou nas fontes de um item novo; use os números #).
Itens novos seguem o estilo enxuto: descrição de 2 a 4 frases objetivas e concretas, passos curtos (máx. 6),
divergencias/correcoes em uma frase ou vazio. Ids dos itens novos: continue a numeração (ex.: se o último é K31, use K32).
Calcule notas e intervalos com cuidado (C7 é dominante, com B♭; só Cmaj7 tem B)."""


def load(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def pending():
    """{destino: [ids globais]} das ideias fora do lugar que não estão em nenhum item."""
    em_item, fora = set(), {}
    for p in OUT.glob("C*.json"):
        d = json.loads(p.read_text(encoding="utf-8"))
        for it in d["itens"]:
            em_item.update(it["fontes"])
        for x in d["fora_do_lugar"]:
            fora[x["id"]] = x["sugestao"]
    by_dest = defaultdict(list)
    for gid, dest in fora.items():
        if gid not in em_item:
            by_dest[dest].append(gid)
    return by_dest


def prompt(dest, gids, ideias):
    d = json.loads((OUT / f"{dest}.json").read_text(encoding="utf-8"))
    lines = [f"SUBCATEGORIA {dest}. ITENS EXISTENTES ({len(d['itens'])}):"]
    lines += [f"{it['id']} · {it['titulo']} — {it['descricao'][:160]}" for it in d["itens"]]
    lines += ["", f"IDEIAS QUE CHEGARAM ({len(gids)}):"]
    lines += [cons.idea_line(n, *ideias[g], "nova") for n, g in enumerate(gids, 1)]
    return "\n".join(lines) + "\n\nDecida anexos e itens novos."


def cmd_enviar(args):
    by_dest = pending()
    if not by_dest:
        print("Nada pendente: todas as ideias já estão em algum item.")
        return
    _, _, ideias, subs = cons.build_inputs()
    state = load(STATE, {"batches": []})
    reqs, est = [], 0.0
    plan = {}
    for dest, gids in sorted(by_dest.items()):
        if dest not in subs or dest == "X00":
            print(f"  {len(gids)} ideias sugeridas para {dest} (fora do escopo/inválido): ficam registradas, sem encaixe")
            continue
        text = prompt(dest, gids, ideias)
        plan[dest] = gids
        est += (len(SYSTEM) + len(text)) / 3.5 * 2 / 1e6 + (len(gids) * 200 + 2000) * 10 / 1e6
        reqs.append(Request(custom_id=dest.replace(".", "_"), params=MessageCreateParamsNonStreaming(
            model=MODEL, max_tokens=32000, system=SYSTEM,
            output_config={"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMA}},
            messages=[{"role": "user", "content": text}])))
    print(f"{sum(len(v) for v in plan.values())} ideias para {len(plan)} subcategorias · {MODEL} · batch")
    fichar_api.confirm(est, args.teto, args.sim)
    batch = fichar_api.client().messages.batches.create(requests=reqs)
    state["batches"].append({"id": batch.id, "plano": plan, "coletado": False,
                             "criado_em": datetime.now().isoformat(timespec="seconds")})
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Batch criado: {batch.id}")


def cmd_acompanhar(_):
    cl = fichar_api.client()
    for b in load(STATE, {"batches": []})["batches"]:
        if not b["coletado"]:
            info = cl.messages.batches.retrieve(b["id"])
            rc = info.request_counts
            print(f"{b['id']} · {info.processing_status} · processando {rc.processing} · ok {rc.succeeded} · erro {rc.errored}")


def cmd_coletar(_):
    cl, state = fichar_api.client(), load(STATE, {"batches": []})
    _, _, _, subs = cons.build_inputs()
    total, ok, err = 0.0, 0, []
    for b in state["batches"]:
        if b["coletado"] or cl.messages.batches.retrieve(b["id"]).processing_status != "ended":
            continue
        for r in cl.messages.batches.results(b["id"]):
            dest = r.custom_id.replace("_", ".")
            gids = b["plano"][dest]
            if r.result.type != "succeeded":
                err.append(f"{dest}: {r.result.type}")
                continue
            msg = r.result.message
            total += fichar_api.cost(msg.usage, MODEL, batch=True)
            out = json.loads(fichar_api.first_text(msg))
            path = OUT / f"{dest}.json"
            d = json.loads(path.read_text(encoding="utf-8"))
            existing = {it["id"]: it for it in d["itens"]}
            back = {n: g for n, g in enumerate(gids, 1)}
            used = Counter([a["id"] for a in out["anexos"]] + [f for it in out["novos_itens"] for f in it["fontes"]])
            missing = set(back) - set(used)
            bad = [a for a in out["anexos"] if a["item"] not in existing]
            if missing or bad or set(used) - set(back):
                err.append(f"{dest}: faltaram {sorted(missing)} · anexos a itens inexistentes {len(bad)}")
                continue
            for a in out["anexos"]:
                existing[a["item"]]["fontes"].append(back[a["id"]])
            used_ids = {it["id"] for it in d["itens"]}
            nxt = max((int(i[1:]) for i in used_ids if i[1:].isdigit()), default=0)
            for it in out["novos_itens"]:
                it["fontes"] = [back[f] for f in it["fontes"]]
                if it["id"] in used_ids:  # garante id único mesmo se o modelo repetir numeração
                    nxt += 1
                    it["id"] = f"K{nxt:02d}"
                used_ids.add(it["id"])
                it["encaixado"] = True
                d["itens"].append(it)
            d["_meta"].setdefault("encaixe", []).append({"batch": b["id"], "anexos": len(out["anexos"]),
                                                         "novos_itens": len(out["novos_itens"])})
            d["_meta"]["itens"] = len(d["itens"])
            path.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
            (OUT / f"{dest}.md").write_text(cons.render_md(f"{dest} · {subs[dest][1]['nome']}",
                                                           d, {**d["_meta"], "segundos": d["_meta"].get("segundos", 0)}),
                                            encoding="utf-8")
            ok += 1
        b["coletado"] = True
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Encaixe: {ok} subcategorias atualizadas, custo US$ {total:.2f}. Erros: {err or 'nenhum'}")
    left = pending()
    print(f"Ideias ainda sem item: {sum(len(v) for k, v in left.items() if k in subs and k != 'X00')}")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["enviar", "acompanhar", "coletar"])
    ap.add_argument("--teto", type=float, default=1.5)
    ap.add_argument("--sim", action="store_true")
    args = ap.parse_args()
    {"enviar": cmd_enviar, "acompanhar": cmd_acompanhar, "coletar": cmd_coletar}[args.cmd](args)


if __name__ == "__main__":
    main()
