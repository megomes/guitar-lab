"""Etapa 3: classificação. Cada ideia das fichas vai para uma subcategoria da taxonomia (Haiku, via Batch API).

Antes de classificar, aplica as decisões do usuário sobre a taxonomia proposta (ver DECISOES abaixo) e
separa o que fica de fora: licks (vão para uma lista com links no minuto exato) e fontes fracas.

Comandos (da raiz do projeto):
  python solos/scripts/classificar.py preparar     taxonomia final + lista de licks + lotes (grátis)
  python solos/scripts/classificar.py enviar       manda os lotes pendentes/com erro num batch
  python solos/scripts/classificar.py acompanhar
  python solos/scripts/classificar.py coletar      valida (cada ideia exatamente uma vez) e grava
  python solos/scripts/classificar.py status       cobertura: ideias classificadas, órfãs, contagem por subcategoria

Saídas em solos/processed/03-classificacao/:
  taxonomia_final.json / .md   taxonomia com as decisões aplicadas
  classificacao.json           id_global -> {principal, secundarias}
  resumo.md                    contagem por subcategoria e exemplos
  _lotes.json, _batches.json   estado
Lista de licks: solos/processed/licks_para_revisar.md
"""
import json
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming  # noqa: E402
from anthropic.types.messages.batch_create_params import Request  # noqa: E402

import fichar_api  # noqa: E402  (reaproveita client(), cost(), confirm())

ROOT = Path(__file__).resolve().parents[2]
FICHAS = ROOT / "solos" / "processed" / "01-fichas" / "json"
TAX_IN = ROOT / "solos" / "processed" / "02-taxonomia" / "taxonomia.json"
OUT = ROOT / "solos" / "processed" / "03-classificacao"
LICKS_MD = ROOT / "solos" / "processed" / "licks_para_revisar.md"
MODEL = "claude-haiku-5-5"
CHUNK = 60
FORA = "X00"

DECISOES = [
    "Licks (tipo frase_lick) ficam fora da classificação: o usuário não confia no transcript para licks. "
    "Viram a lista licks_para_revisar.md com link no minuto exato, para ele tirar de ouvido.",
    "Removidas C02.5 (leitura de tablatura/notação) e C12.5 (outros estilos): não são específicas de solo.",
    f"Criada {FORA} 'Fora do escopo': ideias que não são específicas de solo/improvisação (acompanhamento "
    "genérico, equipamento, teoria sem aplicação ao solo, propaganda). Ficam registradas, mas não seguem adiante.",
    "C10.6 (tríades no acompanhamento) mantida: o usuário considera tríades importantes para variar no solo.",
    "Fontes com qualidade 1 descartadas; qualidade 2 descartadas, exceto as que vieram das listas do usuário.",
    "Lacunas apontadas pela taxonomia: seguir com o material atual.",
]
REMOVER = {"C02.5", "C12.5"}


def load_fichas():
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(FICHAS.glob("*.json"))]


def fonte_mantida(f) -> bool:
    nota = f["qualidade_didatica"]["nota"]
    if nota >= 3:
        return True
    return nota == 2 and str(f["fonte"].get("origem") or "").startswith("lista do usuário")


def ts_seconds(ts):
    if not ts:
        return 0
    s = 0
    for p in ts.split(":"):
        s = s * 60 + int(p)
    return s


# ---------- preparar ----------

def taxonomia_final() -> dict:
    t = json.loads(TAX_IN.read_text(encoding="utf-8"))
    for c in t["categorias"]:
        c["subcategorias"] = [s for s in c["subcategorias"] if s["id"] not in REMOVER]
    t["categorias"].append({
        "id": "X", "nome": "Fora do escopo", "descricao": "Ideias que não são específicas de solo/improvisação.",
        "subcategorias": [{
            "id": FORA, "nome": "Não específico de solo",
            "descricao": "Acompanhamento genérico, leitura de tablatura/partitura, equipamento, teoria sem aplicação "
                         "ao solo, propaganda de cursos/comunidades, comentários sobre o próprio vídeo.",
            "inclui": "Tudo que não ajuda diretamente a solar ou improvisar melhor.",
            "nao_inclui": "Tríades/voicings que servem ao solo (C10.6); teoria aplicada ao solo (C02).",
            "exemplos": [], "estimativa_ideias": 0, "nivel_predominante": "misto"}],
    })
    t["_decisoes"] = DECISOES
    return t


def tax_prompt(t) -> str:
    lines = []
    for c in t["categorias"]:
        lines.append(f"{c['id']} {c['nome']}")
        for s in c["subcategorias"]:
            lines.append(f"  {s['id']} {s['nome']}: {s['descricao']} INCLUI: {s['inclui']} NÃO INCLUI: {s['nao_inclui']}")
    return "\n".join(lines)


def cmd_preparar(_):
    OUT.mkdir(parents=True, exist_ok=True)
    t = taxonomia_final()
    (OUT / "taxonomia_final.json").write_text(json.dumps(t, ensure_ascii=False, indent=1), encoding="utf-8")
    md = ["# Taxonomia final", "", "## Decisões aplicadas", ""] + [f"- {d}" for d in DECISOES] + ["", "## Subcategorias", ""]
    for c in t["categorias"]:
        md.append(f"- **{c['id']} {c['nome']}**: " + " · ".join(f"{s['id']} {s['nome']}" for s in c["subcategorias"]))
    (OUT / "taxonomia_final.md").write_text("\n".join(md) + "\n", encoding="utf-8")

    fichas = load_fichas()
    ideias, licks, descartadas = [], [], Counter()
    for f in fichas:
        keep = fonte_mantida(f)
        for i in f["ideias"]:
            if i["tipo"] == "frase_lick":
                licks.append((f, i))
            elif not keep:
                descartadas[f["qualidade_didatica"]["nota"]] += 1
            else:
                ideias.append({"id": i["id_global"], "fonte": f["fonte"].get("titulo"), "tipo": i["tipo"],
                               "titulo": i["titulo"], "descricao": i["descricao"][:350], "tags": i["tags"][:6]})

    # licks com link no minuto exato
    lm = ["# Licks para revisar", "",
          "O transcript não é confiável para notas exatas de licks. Cada item abaixo tem o link no minuto em que "
          "o lick aparece: abra, ouça e tire de ouvido.", ""]
    for f, i in sorted(licks, key=lambda x: (x[0]["fonte"].get("autor") or "", x[0]["fonte_id"], ts_seconds(x[1]["timestamp"]))):
        fo = f["fonte"]
        if fo["tipo"] == "video" and i.get("timestamp"):
            link = f"{fo['url']}&t={max(0, ts_seconds(i['timestamp']) - 3)}s"
            where = f"[{i['timestamp']}]({link})"
        else:
            where = f"[documento]({fo['url']})"
        lm.append(f"- {where} · **{i['titulo']}** — {fo.get('autor') or ''}, _{fo.get('titulo')}_  \n  {i['descricao']}")
    LICKS_MD.write_text("\n".join(lm) + "\n", encoding="utf-8")

    lotes = [{"id": f"lote-{n:04d}", "ideias": ideias[k:k + CHUNK], "status": "pendente"}
             for n, k in enumerate(range(0, len(ideias), CHUNK))]
    (OUT / "_lotes.json").write_text(json.dumps(lotes, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Taxonomia final: {sum(len(c['subcategorias']) for c in t['categorias'])} subcategorias (com {FORA}).")
    print(f"Ideias a classificar: {len(ideias)} em {len(lotes)} lotes · licks separados: {len(licks)} · "
          f"descartadas por fonte fraca: {sum(descartadas.values())} {dict(descartadas)}")


# ---------- batch ----------

SYSTEM = """Você classifica ideias de uma base de conhecimento sobre SOLO e IMPROVISAÇÃO na guitarra numa taxonomia fixa.
Para cada ideia, escolha a subcategoria PRINCIPAL que melhor corresponde ao objetivo de aprendizado da ideia (o que o aluno
melhora com ela), seguindo os critérios INCLUI / NÃO INCLUI. Opcionalmente, até 2 SECUNDÁRIAS quando a ideia também for
claramente útil lá. Use {fora} para o que não é específico de solo/improvisação. Classifique TODAS as ideias recebidas,
exatamente uma vez cada, copiando o id sem alterar.

TAXONOMIA:
{tax}"""


def schema(valid_ids):
    return {
        "type": "object", "additionalProperties": False, "required": ["itens"],
        "properties": {"itens": {"type": "array", "items": {
            "type": "object", "additionalProperties": False, "required": ["id", "principal", "secundarias"],
            "properties": {
                "id": {"type": "string"},
                "principal": {"type": "string", "enum": valid_ids},
                "secundarias": {"type": "array", "items": {"type": "string", "enum": valid_ids}},
            }}}},
    }


def load(name, default):
    p = OUT / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def save(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")


def cmd_enviar(args):
    t = load("taxonomia_final.json", None)
    if t is None:
        sys.exit("Rode `preparar` primeiro.")
    lotes = load("_lotes.json", [])
    todo = [l for l in lotes if l["status"] in ("pendente", "erro")]
    if not todo:
        print("Nada a enviar.")
        return
    valid = [s["id"] for c in t["categorias"] for s in c["subcategorias"]]
    system = SYSTEM.format(fora=FORA, tax=tax_prompt(t))
    est_in = sum(len(system) / 3.5 + len(json.dumps(l["ideias"], ensure_ascii=False)) / 3.5 for l in todo)
    est_out = sum(len(l["ideias"]) * 40 + 2000 for l in todo)  # 40 tokens/ideia + raciocínio
    pin, pout = fichar_api.PRICES[MODEL]
    print(f"{len(todo)} lotes ({sum(len(l['ideias']) for l in todo)} ideias) · {MODEL} · batch")
    fichar_api.confirm((est_in * pin + est_out * pout) / 1e6 / 2, args.teto, args.sim)
    reqs = []
    for l in todo:
        user = json.dumps(l["ideias"], ensure_ascii=False)
        if l.get("feedback"):
            user += "\n\nATENÇÃO, a tentativa anterior foi rejeitada: " + "; ".join(l["feedback"])
        reqs.append(Request(custom_id=l["id"], params=MessageCreateParamsNonStreaming(
            model=MODEL, max_tokens=16000, system=system,
            output_config={"effort": "medium", "format": {"type": "json_schema", "schema": schema(valid)}},
            messages=[{"role": "user", "content": "Classifique estas ideias:\n" + user}])))
        l["status"] = "enviado"
    batch = fichar_api.client().messages.batches.create(requests=reqs)
    batches = load("_batches.json", [])
    batches.append({"id": batch.id, "criado_em": datetime.now().isoformat(timespec="seconds"),
                    "lotes": [l["id"] for l in todo], "coletado": False})
    save("_batches.json", batches)
    save("_lotes.json", lotes)
    print(f"Batch criado: {batch.id}")


def cmd_acompanhar(_):
    cl = fichar_api.client()
    abertos = [b for b in load("_batches.json", []) if not b["coletado"]]
    for b in abertos:
        info = cl.messages.batches.retrieve(b["id"])
        rc = info.request_counts
        print(f"{b['id']} · {info.processing_status} · {len(b['lotes'])} lotes · processando {rc.processing} · "
              f"ok {rc.succeeded} · erro {rc.errored}")
    if not abertos:
        print("Nenhum batch em aberto.")


def cmd_coletar(_):
    cl, batches, lotes = fichar_api.client(), load("_batches.json", []), load("_lotes.json", [])
    by_id = {l["id"]: l for l in lotes}
    t = load("taxonomia_final.json", None)
    valid = {s["id"] for c in t["categorias"] for s in c["subcategorias"]}
    result = load("classificacao.json", {})
    total, ok, err = 0.0, 0, 0
    for b in batches:
        if b["coletado"]:
            continue
        if cl.messages.batches.retrieve(b["id"]).processing_status != "ended":
            print(f"{b['id']} ainda processando; pulando.")
            continue
        for r in cl.messages.batches.results(b["id"]):
            lote = by_id[r.custom_id]
            if r.result.type != "succeeded":
                lote.update(status="erro", feedback=[f"batch: {r.result.type}"])
                err += 1
                continue
            msg = r.result.message
            total += fichar_api.cost(msg.usage, MODEL, batch=True)
            esperados = {i["id"] for i in lote["ideias"]}
            try:
                itens = json.loads(fichar_api.first_text(msg))["itens"]
            except (json.JSONDecodeError, KeyError) as e:
                lote.update(status="erro", feedback=[f"JSON inválido: {e}"])
                err += 1
                continue
            vistos = Counter(i["id"] for i in itens)
            faltando = esperados - set(vistos)
            extras = set(vistos) - esperados
            repetidos = [k for k, v in vistos.items() if v > 1]
            invalid = [i["id"] for i in itens if i["principal"] not in valid]
            problems = []
            if faltando:
                problems.append(f"faltaram {len(faltando)} ideias: {sorted(faltando)[:10]}")
            if extras:
                problems.append(f"ids que não existem na entrada: {sorted(extras)[:5]}")
            if repetidos:
                problems.append(f"ids repetidos: {repetidos[:5]}")
            if invalid:
                problems.append(f"subcategoria inválida em {invalid[:5]}")
            if problems:
                lote.update(status="erro", feedback=problems)
                err += 1
                continue
            for i in itens:
                result[i["id"]] = {"principal": i["principal"],
                                   "secundarias": [s for s in i["secundarias"] if s != i["principal"]][:2]}
            lote.update(status="ok", feedback=[])
            ok += 1
        b["coletado"] = True
    save("classificacao.json", result)
    save("_lotes.json", lotes)
    save("_batches.json", batches)
    print(f"Coletado: {ok} lotes ok, {err} com erro, custo US$ {total:.4f}.")
    write_resumo()


def write_resumo():
    t = load("taxonomia_final.json", None)
    result = load("classificacao.json", {})
    lotes = load("_lotes.json", [])
    todas = {i["id"] for l in lotes for i in l["ideias"]}
    orfas = todas - set(result)
    prim, sec = Counter(v["principal"] for v in result.values()), Counter(s for v in result.values() for s in v["secundarias"])
    names = {s["id"]: s["nome"] for c in t["categorias"] for s in c["subcategorias"]}
    md = ["# Classificação — resumo", "",
          f"{len(result)} de {len(todas)} ideias classificadas · **órfãs: {len(orfas)}**", "",
          "| Subcategoria | Principal | Também (secundária) |", "|---|---|---|"]
    for sid in names:
        md.append(f"| {sid} {names[sid]} | {prim.get(sid, 0)} | {sec.get(sid, 0)} |")
    (OUT / "resumo.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"{len(result)}/{len(todas)} ideias classificadas · órfãs: {len(orfas)} · lotes: "
          f"{dict(Counter(l['status'] for l in lotes))}")
    return orfas


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    import argparse
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["preparar", "enviar", "acompanhar", "coletar", "status"])
    ap.add_argument("--teto", type=float, default=0.50)
    ap.add_argument("--sim", action="store_true")
    args = ap.parse_args()
    {"preparar": cmd_preparar, "enviar": cmd_enviar, "acompanhar": cmd_acompanhar, "coletar": cmd_coletar,
     "status": lambda a: write_resumo()}[args.cmd](args)


if __name__ == "__main__":
    main()
