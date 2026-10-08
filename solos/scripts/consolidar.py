"""Etapa 4: consolidação. Para cada subcategoria, funde as ideias repetidas em itens canônicos com todas as fontes.

Roda via Claude Agent SDK (cota do plano). Garante cobertura: toda ideia cuja subcategoria PRINCIPAL é esta precisa
aparecer em exatamente um item (campo fontes) ou ser devolvida como "fora do lugar" com sugestão de destino.

Uso (da raiz do projeto):
  python solos/scripts/consolidar.py piloto --modelos claude-opus-5-5 claude-sonnet-5-5 --subs C07.3 C05.2 ...
  python solos/scripts/consolidar.py rodar --modelo claude-sonnet-5-5 [-c 4]     todas as subcategorias pendentes
  python solos/scripts/consolidar.py comparar      tabela do piloto (tokens, custo, itens, cobertura)

Saídas em solos/processed/04-consolidacao/  (piloto em _piloto/<modelo>/)
  <sub>.json / <sub>.md, _status.json, _log.txt (com tokens reais de entrada, saída e cache de cada chamada)
"""
import argparse
import asyncio
import json
import sys
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from claude_agent_sdk import ClaudeAgentOptions, ResultMessage, query  # noqa: E402

import fichar  # noqa: E402  (cola de teoria)

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / "solos" / "processed"
OUT = P / "04-consolidacao"
MAX_ATTEMPTS = 2
TEORIA = fichar.SYSTEM_PROMPT.split("REFERÊNCIA DE TEORIA", 1)[1]
TIPOS = ["dica", "exercicio", "conceito", "erro_comum", "rotina_estudo", "mentalidade", "recurso"]

SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["visao_geral", "itens", "fora_do_lugar", "observacoes"],
    "properties": {
        "visao_geral": {"type": "string", "description": "Síntese do que a subcategoria ensina, cruzando as fontes (4-8 frases)."},
        "itens": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "required": ["id", "tipo", "titulo", "descricao", "passos", "nivel", "fontes", "divergencias", "correcoes"],
            "properties": {
                "id": {"type": "string", "description": "K01, K02, ..."},
                "tipo": {"type": "string", "enum": TIPOS},
                "titulo": {"type": "string"},
                "descricao": {"type": "string", "description": "Versão consolidada, mais completa e precisa que cada fonte isolada."},
                "passos": {"type": "array", "items": {"type": "string"}},
                "nivel": {"type": "string", "enum": ["iniciante", "intermediario", "avancado"]},
                "fontes": {"type": "array", "items": {"type": "integer"},
                           "description": "números (#) das ideias fundidas aqui"},
                "divergencias": {"type": "string", "description": "Onde as fontes discordam; vazio se não há."},
                "correcoes": {"type": "string", "description": "Erros de teoria/transcrição corrigidos; vazio se não há."},
            }}},
        "fora_do_lugar": {"type": "array", "items": {
            "type": "object", "additionalProperties": False, "required": ["id", "sugestao", "motivo"],
            "properties": {"id": {"type": "integer"}, "sugestao": {"type": "string"}, "motivo": {"type": "string"}}}},
        "observacoes": {"type": "string"},
    },
}

SYSTEM = """Você é um professor de guitarra e designer instrucional. Está consolidando uma base de conhecimento sobre SOLO e
IMPROVISAÇÃO, extraída de ~300 vídeos e artigos, para uma aba de estudo. Escreva em português do Brasil.

Você recebe UMA subcategoria da taxonomia e todas as ideias classificadas nela (vindas de várias fontes).
Tarefa: fundir as ideias que dizem a mesma coisa em ITENS CANÔNICOS.

Regras:
1. COBERTURA OBRIGATÓRIA: cada ideia marcada como PRINCIPAL deve aparecer em exatamente um item (no campo fontes) OU em
   fora_do_lugar (se claramente pertence a outra subcategoria; informe o id sugerido). Ideias SECUNDÁRIAS são opcionais:
   inclua nas fontes só se enriquecem um item daqui.
2. Funda o que é a mesma ideia mesmo com palavras diferentes; NÃO funda ideias diferentes só porque o tema é parecido.
   Um exercício e o conceito que ele treina são itens separados.
3. A descrição consolidada junta o melhor de todas as fontes: mais concreta (notas, casas, BPM, tonalidade, passos)
   e corrigida. Não invente nada que nenhuma fonte disse.
4. divergencias: registre quando professores discordam (ex.: "X recomenda começar pelo shape 1, Y pelo shape 5").
   correcoes: registre erros de teoria ou de legenda automática que você corrigiu.
5. Ordene os itens numa progressão pedagógica (do básico ao avançado).
6. Calcule notas/intervalos pela referência de teoria abaixo antes de escrevê-los.

REFERÊNCIA DE TEORIA""" + TEORIA


def load_json(path, default=None):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def build_inputs():
    tax = load_json(P / "03-classificacao" / "taxonomia_final.json")
    cls = load_json(P / "03-classificacao" / "classificacao.json")
    ideias = {}
    for p in (P / "01-fichas" / "json").glob("*.json"):
        f = json.loads(p.read_text(encoding="utf-8"))
        for i in f["ideias"]:
            ideias[i["id_global"]] = (f, i)
    subs = {s["id"]: (c, s) for c in tax["categorias"] for s in c["subcategorias"]}
    return tax, cls, ideias, subs


def idea_line(n, f, i, papel):
    fo = f["fonte"]
    ts = f" @{i['timestamp']}" if i.get("timestamp") else ""
    passos = (" PASSOS: " + " | ".join(i["passos"])) if i["passos"] else ""
    return (f"[#{n}] ({papel}) {i['tipo']}/{i['nivel']} — {i['titulo']}{ts}\n"
            f"   fonte: {fo.get('autor') or ''} · {fo.get('titulo')} (qualidade {f['qualidade_didatica']['nota']})\n"
            f"   {i['descricao']}{passos}")


def prompt_for(sub_id, tax_bits):
    tax, cls, ideias, subs = tax_bits
    c, s = subs[sub_id]
    prim = [k for k, v in cls.items() if v["principal"] == sub_id]
    sec = [k for k, v in cls.items() if sub_id in v["secundarias"]]
    lines = [f"SUBCATEGORIA {s['id']} · {s['nome']} (categoria {c['id']} {c['nome']})",
             f"Descrição: {s['descricao']}", f"Inclui: {s['inclui']}", f"Não inclui: {s['nao_inclui']}", "",
             "Outras subcategorias (para fora_do_lugar): " + "; ".join(f"{k} {v[1]['nome']}" for k, v in subs.items() if k != sub_id),
             "", f"IDEIAS PRINCIPAIS ({len(prim)}):"]
    # ids curtos (#1, #2...) no lugar dos ids globais longos: o modelo reescreve menos tokens; o script converte de volta
    num = {k: n for n, k in enumerate(prim + sec, 1)}
    lines += [idea_line(num[k], *ideias[k], "PRINCIPAL") for k in prim]
    lines += ["", f"IDEIAS SECUNDÁRIAS ({len(sec)}, opcionais):"]
    lines += [idea_line(num[k], *ideias[k], "secundária") for k in sec]
    return "\n".join(lines) + "\n\nConsolide. Nas fontes e em fora_do_lugar use os números (#).", set(prim), set(sec), \
        {n: k for k, n in num.items()}


def expand_ids(out, back):
    """Troca os números curtos pelos ids globais; números desconhecidos viram 'desconhecido#N' (a validação reprova)."""
    for it in out["itens"]:
        it["fontes"] = [back.get(n, f"desconhecido#{n}") for n in it["fontes"]]
    for x in out["fora_do_lugar"]:
        x["id"] = back.get(x["id"], f"desconhecido#{x['id']}")
    return out


def validate(out, prim, sec, valid_subs):
    errs = []
    used = Counter(fid for it in out["itens"] for fid in it["fontes"])
    fora = {x["id"] for x in out["fora_do_lugar"]}
    missing = prim - set(used) - fora
    if missing:
        errs.append(f"{len(missing)} ideias PRINCIPAIS sem item nem fora_do_lugar: {sorted(missing)[:15]}")
    # uma ideia apoiando dois itens não perde nada; fica registrada em _meta (ver dup_ids), não reprova
    unknown = set(used) - prim - sec
    if unknown:
        errs.append(f"ids inexistentes nas fontes: {sorted(unknown)[:10]}")
    bad = [x["id"] for x in out["fora_do_lugar"] if x["sugestao"] not in valid_subs]
    if bad:
        errs.append(f"fora_do_lugar com sugestão inválida: {bad[:5]}")
    if any(not it["fontes"] for it in out["itens"]):
        errs.append("item sem fontes")
    return errs


def render_md(sub_name, out, meta):
    lines = [f"# {sub_name}", "", f"_{meta['modelo']} · {meta['ideias_principais']} ideias → {len(out['itens'])} itens · "
             f"US$ {meta['custo_usd']:.2f} nominal · {meta['segundos']}s_", "", out["visao_geral"], ""]
    for it in out["itens"]:
        lines += [f"## {it['id']} · {it['titulo']}", f"_{it['tipo']} · {it['nivel']} · {len(it['fontes'])} fontes_", "",
                  it["descricao"], ""]
        lines += [f"{n}. {p}" for n, p in enumerate(it["passos"], 1)]
        if it["passos"]:
            lines.append("")
        if it["divergencias"]:
            lines += [f"> **Divergências:** {it['divergencias']}", ""]
        if it["correcoes"]:
            lines += [f"> **Correções:** {it['correcoes']}", ""]
        lines += ["<sub>Fontes: " + ", ".join(it["fontes"]) + "</sub>", ""]
    if out["fora_do_lugar"]:
        lines += ["## Fora do lugar", ""] + [f"- {x['id']} → {x['sugestao']}: {x['motivo']}" for x in out["fora_do_lugar"]]
    if out["observacoes"]:
        lines += ["", "---", f"_Observações:_ {out['observacoes']}"]
    return "\n".join(lines) + "\n"


def log(dest, msg):
    with (dest / "_log.txt").open("a", encoding="utf-8") as fh:
        fh.write(f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}\n")


async def consolidate(sub_id, model, effort, dest, tax_bits, sem, status):
    tax, cls, ideias, subs = tax_bits
    valid_subs = set(subs)
    async with sem:
        text, prim, sec, back = prompt_for(sub_id, tax_bits)
        feedback, t0, cost, usage_total = None, time.time(), 0.0, Counter()
        for attempt in range(1, MAX_ATTEMPTS + 1):
            prompt = text + (("\n\nATENÇÃO, tentativa anterior rejeitada:\n- " + "\n- ".join(feedback)) if feedback else "")
            options = ClaudeAgentOptions(model=model, system_prompt=SYSTEM, tools=[], allowed_tools=[], setting_sources=[], strict_mcp_config=True, mcp_servers={},
                                         max_turns=4, effort=effort, cwd=str(dest),
                                         output_format={"type": "json_schema", "schema": SCHEMA})
            result = None
            try:
                async for m in query(prompt=prompt, options=options):
                    if isinstance(m, ResultMessage):
                        result = m
            except Exception as e:
                log(dest, f"[{sub_id}] exceção: {e}")
                feedback = None
                continue
            if result is None or result.is_error or result.structured_output is None:
                log(dest, f"[{sub_id}] erro: {getattr(result, 'subtype', None)} {getattr(result, 'errors', None)}")
                continue
            cost += result.total_cost_usd or 0.0
            for k, v in (result.usage or {}).items():
                if isinstance(v, (int, float)):
                    usage_total[k] += v
            out = expand_ids(result.structured_output, back)
            errs = validate(out, prim, sec, valid_subs)
            if errs:  # o feedback ao modelo precisa falar em números curtos, não em ids globais
                fwd = {v: k for k, v in back.items()}
                for gid, n in fwd.items():
                    errs = [e.replace(f"'{gid}'", f"#{n}") for e in errs]
            log(dest, f"[{sub_id}] tentativa {attempt} usage={dict(result.usage or {})} custo={result.total_cost_usd} erros={errs}")
            if errs:
                feedback = errs
                continue
            meta = {"modelo": model, "effort": effort, "ideias_principais": len(prim), "ideias_secundarias": len(sec),
                    "itens": len(out["itens"]), "fora_do_lugar": len(out["fora_do_lugar"]), "tentativas": attempt,
                    "custo_usd": round(cost, 4), "segundos": round(time.time() - t0), "usage": dict(usage_total),
                    "gerado_em": datetime.now().isoformat(timespec="seconds")}
            (dest / f"{sub_id}.json").write_text(json.dumps({"subcategoria": sub_id, **out, "_meta": meta},
                                                            ensure_ascii=False, indent=1), encoding="utf-8")
            (dest / f"{sub_id}.md").write_text(render_md(f"{sub_id} · {subs[sub_id][1]['nome']}", out, meta), encoding="utf-8")
            status[sub_id] = {"status": "ok", **meta}
            print(f"OK   {model:<18} {sub_id:<6} {len(prim):>4} ideias → {len(out['itens']):>3} itens · "
                  f"in {usage_total.get('input_tokens', 0) + usage_total.get('cache_read_input_tokens', 0):>6} · "
                  f"out {usage_total.get('output_tokens', 0):>6} · US$ {cost:.2f} · {meta['segundos']}s", flush=True)
            break
        else:
            status[sub_id] = {"status": "erro", "custo_usd": round(cost, 4), "erro": "; ".join(feedback or ["sem resposta"])[:400]}
            print(f"ERRO {model:<18} {sub_id:<6} {status[sub_id]['erro'][:120]}", flush=True)
        (dest / "_status.json").write_text(json.dumps(status, ensure_ascii=False, indent=1), encoding="utf-8")


async def run_many(jobs, concurrency):
    sem = asyncio.Semaphore(concurrency)
    await asyncio.gather(*(consolidate(*j[:5], sem, j[5]) for j in jobs))


def cmd_piloto(args):
    tax_bits = build_inputs()
    jobs = []
    for model in args.modelos:
        dest = OUT / "_piloto" / model
        dest.mkdir(parents=True, exist_ok=True)
        status = load_json(dest / "_status.json", {})
        for sub in args.subs:
            if status.get(sub, {}).get("status") != "ok":
                jobs.append((sub, model, args.effort, dest, tax_bits, status))
    print(f"{len(jobs)} consolidações · effort {args.effort} · {args.concurrency} em paralelo\n", flush=True)
    asyncio.run(run_many(jobs, args.concurrency))
    cmd_comparar(args)


def cmd_rodar(args):
    tax_bits = build_inputs()
    OUT.mkdir(parents=True, exist_ok=True)
    status = load_json(OUT / "_status.json", {})
    # reaproveita o que o piloto já fez com o mesmo modelo (não paga duas vezes)
    piloto = OUT / "_piloto" / args.modelo
    for sub, st in load_json(piloto / "_status.json", {}).items():
        if st.get("status") == "ok" and status.get(sub, {}).get("status") != "ok":
            for ext in ("json", "md"):
                (OUT / f"{sub}.{ext}").write_text((piloto / f"{sub}.{ext}").read_text(encoding="utf-8"), encoding="utf-8")
            status[sub] = {**st, "reaproveitado_do_piloto": True}
            print(f"reaproveitado do piloto: {sub}")
    subs = [s for s in tax_bits[3] if s != "X00" and status.get(s, {}).get("status") != "ok"]
    if args.limit:
        subs = subs[: args.limit]
    jobs = [(s, args.modelo, args.effort, OUT, tax_bits, status) for s in subs]
    done = sum(1 for v in status.values() if v.get("status") == "ok")
    print(f"{done} já prontas · rodando {len(jobs)}: {' '.join(subs)} · {args.modelo} · effort {args.effort}\n", flush=True)
    asyncio.run(run_many(jobs, args.concurrency))
    cmd_status(args)


def cmd_status(_):
    tax_bits = build_inputs()
    status = load_json(OUT / "_status.json", {})
    alvo = [s for s in tax_bits[3] if s != "X00"]
    ok = [s for s in alvo if status.get(s, {}).get("status") == "ok"]
    err = [s for s in alvo if status.get(s, {}).get("status") == "erro"]
    custo = sum(v.get("custo_usd", 0) for v in status.values() if not v.get("reaproveitado_do_piloto"))
    itens = sum(status[s].get("itens", 0) for s in ok)
    ideias = sum(status[s].get("ideias_principais", 0) for s in ok)
    print(f"\nConsolidação: {len(ok)}/{len(alvo)} subcategorias · {ideias} ideias → {itens} itens · "
          f"erro: {err or 'nenhum'} · custo nominal desta etapa: US$ {custo:.2f}")


def cmd_teste_api(args):
    """Consolida subcategorias pela API (créditos, sem cota do plano), chamada direta, para comparar modelos."""
    import fichar_api
    tax_bits = build_inputs()
    dest = OUT / "_piloto_api" / args.modelo
    dest.mkdir(parents=True, exist_ok=True)
    cl, subs = fichar_api.client(), tax_bits[3]
    for sub_id in args.subs:
        text, prim, sec, back = prompt_for(sub_id, tax_bits)
        t0 = time.time()
        with cl.messages.stream(model=args.modelo, max_tokens=64000, system=SYSTEM,
                                output_config={"effort": args.effort, "format": {"type": "json_schema", "schema": SCHEMA}},
                                messages=[{"role": "user", "content": text}]) as stream:
            msg = stream.get_final_message()
        c = fichar_api.cost(msg.usage, args.modelo, batch=False)
        out = expand_ids(json.loads(fichar_api.first_text(msg)), back)
        errs = validate(out, prim, sec, set(subs))
        meta = {"modelo": args.modelo, "effort": args.effort, "ideias_principais": len(prim), "itens": len(out["itens"]),
                "custo_usd": round(c, 4), "segundos": round(time.time() - t0), "via": "api",
                "usage": {"input_tokens": msg.usage.input_tokens, "output_tokens": msg.usage.output_tokens}}
        (dest / f"{sub_id}.json").write_text(json.dumps({"subcategoria": sub_id, **out, "_meta": meta}, ensure_ascii=False,
                                                        indent=1), encoding="utf-8")
        (dest / f"{sub_id}.md").write_text(render_md(f"{sub_id} · {subs[sub_id][1]['nome']}", out, meta), encoding="utf-8")
        print(f"{'OK ' if not errs else 'ERRO'} {sub_id} {len(prim)} ideias → {len(out['itens'])} itens · in {msg.usage.input_tokens} "
              f"· out {msg.usage.output_tokens} · US$ {c:.4f} · {meta['segundos']}s {'; '.join(errs[:2])}")


ENXUTO = """

ESTILO ENXUTO (obrigatório): descricao com 2 a 4 frases objetivas, só o essencial e o concreto (notas, casas, BPM,
exemplos), sem introduções nem repetir o título. passos curtos (uma linha cada), no máximo 6. divergencias e correcoes
em uma frase cada, só quando existirem. visao_geral em até 4 frases. Não reduza a COBERTURA nem a precisão: cada ideia
principal continua precisando estar num item ou em fora_do_lugar."""


def batch_params(sub_id, tax_bits, model, effort, feedback=None):
    text, prim, sec, back = prompt_for(sub_id, tax_bits)
    if feedback:
        text += "\n\nATENÇÃO, tentativa anterior rejeitada:\n- " + "\n- ".join(feedback)
    return {"model": model, "max_tokens": 64000, "system": SYSTEM + ENXUTO,
            "output_config": {"effort": effort, "format": {"type": "json_schema", "schema": SCHEMA}},
            "messages": [{"role": "user", "content": text}]}, prim, sec, back


def cmd_batch_enviar(args):
    import fichar_api
    from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
    from anthropic.types.messages.batch_create_params import Request
    tax_bits = build_inputs()
    status = load_json(OUT / "_status.json", {})
    batches = load_json(OUT / "_batches.json", [])
    em_voo = {s for b in batches if not b["coletado"] for s in b["subs"]}
    subs = [s for s in tax_bits[3] if s != "X00" and status.get(s, {}).get("status") != "ok" and s not in em_voo]
    if args.limit:
        subs = subs[: args.limit]
    if not subs:
        print("Nada a enviar.")
        return
    reqs, est_in, est_out = [], 0, 0
    for s in subs:
        params, prim, sec, _ = batch_params(s, tax_bits, args.modelo, args.effort, status.get(s, {}).get("feedback"))
        est_in += (len(params["system"]) + len(params["messages"][0]["content"])) / 3.5
        est_out += len(prim) * 125 + 2500  # medido: ~170 tokens/ideia no estilo normal; enxuto ~125 + raciocínio
        reqs.append(Request(custom_id=s.replace(".", "_"), params=MessageCreateParamsNonStreaming(**params)))
    pin, pout = fichar_api.PRICES[args.modelo]
    print(f"{len(subs)} subcategorias · {args.modelo} · effort {args.effort} · batch · "
          f"~{est_in / 1000:.0f}k tokens de entrada, ~{est_out / 1000:.0f}k de saída")
    fichar_api.confirm((est_in * pin + est_out * pout) / 1e6 / 2, args.teto, args.sim)
    batch = fichar_api.client().messages.batches.create(requests=reqs)
    batches.append({"id": batch.id, "modelo": args.modelo, "effort": args.effort, "subs": subs, "coletado": False,
                    "criado_em": datetime.now().isoformat(timespec="seconds")})
    (OUT / "_batches.json").write_text(json.dumps(batches, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Batch criado: {batch.id}")


def cmd_batch_acompanhar(_):
    import fichar_api
    cl = fichar_api.client()
    abertos = [b for b in load_json(OUT / "_batches.json", []) if not b["coletado"]]
    for b in abertos:
        info = cl.messages.batches.retrieve(b["id"])
        rc = info.request_counts
        print(f"{b['id']} · {info.processing_status} · {len(b['subs'])} subs · processando {rc.processing} · "
              f"ok {rc.succeeded} · erro {rc.errored}")
    if not abertos:
        print("Nenhum batch em aberto.")


def cmd_batch_coletar(args):
    import fichar_api
    cl, tax_bits = fichar_api.client(), build_inputs()
    subs_map = tax_bits[3]
    status = load_json(OUT / "_status.json", {})
    batches = load_json(OUT / "_batches.json", [])
    total, ok, err = 0.0, 0, 0
    recoletar = getattr(args, "recoletar", False)
    for b in batches:
        if b["coletado"] and not recoletar:
            continue
        if cl.messages.batches.retrieve(b["id"]).processing_status != "ended":
            print(f"{b['id']} ainda processando; pulando.")
            continue
        for r in cl.messages.batches.results(b["id"]):
            sub_id = r.custom_id.replace("_", ".")
            prev = status.get(sub_id, {})
            if recoletar and prev.get("status") == "ok":
                continue  # só reprocessa os que falharam; resultados do batch ficam guardados 29 dias, sem custo
            if r.result.type != "succeeded":
                status[sub_id] = {"status": "erro", "erro": f"batch: {r.result.type}", "feedback": None}
                err += 1
                continue
            msg = r.result.message
            c = fichar_api.cost(msg.usage, b["modelo"], batch=True)
            total += c
            _, prim, sec, back = batch_params(sub_id, tax_bits, b["modelo"], b["effort"])
            try:
                out = expand_ids(json.loads(fichar_api.first_text(msg)), back)
                errs = validate(out, prim, sec, set(subs_map))
            except (json.JSONDecodeError, KeyError) as e:
                out, errs = None, [f"JSON inválido: {e} (stop_reason={msg.stop_reason})"]
            if errs:
                fwd = {v: k for k, v in back.items()}
                for gid, n in fwd.items():
                    errs = [e.replace(f"'{gid}'", f"#{n}") for e in errs]
                status[sub_id] = {"status": "erro", "erro": "; ".join(errs)[:400], "feedback": errs[:10],
                                  "custo_usd": round(prev.get("custo_usd", 0) + c, 4)}
                err += 1
                continue
            used = Counter(f for it in out["itens"] for f in it["fontes"])
            meta = {"modelo": b["modelo"], "effort": b["effort"], "estilo": "enxuto", "ideias_principais": len(prim),
                    "ideias_em_mais_de_um_item": [k for k, v in used.items() if v > 1],
                    "ideias_secundarias": len(sec), "itens": len(out["itens"]), "fora_do_lugar": len(out["fora_do_lugar"]),
                    "custo_usd": round(c, 4), "via": "api-batch",
                    "usage": {"input_tokens": msg.usage.input_tokens, "output_tokens": msg.usage.output_tokens},
                    "gerado_em": datetime.now().isoformat(timespec="seconds")}
            (OUT / f"{sub_id}.json").write_text(json.dumps({"subcategoria": sub_id, **out, "_meta": meta},
                                                           ensure_ascii=False, indent=1), encoding="utf-8")
            (OUT / f"{sub_id}.md").write_text(render_md(f"{sub_id} · {subs_map[sub_id][1]['nome']}", out,
                                                        {**meta, "segundos": 0}), encoding="utf-8")
            status[sub_id] = {"status": "ok", **meta}
            ok += 1
        b["coletado"] = True
    (OUT / "_status.json").write_text(json.dumps(status, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "_batches.json").write_text(json.dumps(batches, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Coletado: {ok} ok, {err} com erro, custo US$ {total:.2f}.")
    cmd_status(args)


def cmd_comparar(_):
    base = OUT / "_piloto"
    rows = {}
    for d in sorted(base.glob("*")) if base.exists() else []:
        for sub, st in load_json(d / "_status.json", {}).items():
            rows.setdefault(sub, {})[d.name] = st
    models = sorted({m for r in rows.values() for m in r})
    print(f"\n{'sub':<6} " + " | ".join(f"{m[7:]:^42}" for m in models))
    tot = Counter()
    for sub in sorted(rows):
        cells = []
        for m in models:
            st = rows[sub].get(m, {})
            if st.get("status") == "ok":
                u = st["usage"]
                cells.append(f"{st['ideias_principais']:>3}→{st['itens']:>3} itens · out {u.get('output_tokens', 0):>6} · US$ {st['custo_usd']:.2f}")
                tot[m] += st["custo_usd"]
                tot[m + "_out"] += u.get("output_tokens", 0)
                tot[m + "_ideias"] += st["ideias_principais"]
            else:
                cells.append(f"{st.get('status', '-'):^42}")
        print(f"{sub:<6} " + " | ".join(f"{c:<42}" for c in cells))
    for m in models:
        if tot[m + "_ideias"]:
            per = tot[m] / tot[m + "_ideias"]
            print(f"{m}: total US$ {tot[m]:.2f} · {tot[m + '_out']} tokens de saída · US$ {per:.4f}/ideia → "
                  f"projeção p/ ~5.200 ideias: US$ {per * 5200:.0f}")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("piloto")
    p.add_argument("--modelos", nargs="+", default=["claude-opus-5-5", "claude-sonnet-5-5"])
    p.add_argument("--subs", nargs="+", required=True)
    p.add_argument("--effort", default="medium")
    p.add_argument("-c", "--concurrency", type=int, default=4)
    r = sub.add_parser("rodar")
    r.add_argument("--modelo", default="claude-sonnet-5-5")
    r.add_argument("--effort", default="medium")
    r.add_argument("-c", "--concurrency", type=int, default=4)
    r.add_argument("--limit", type=int, help="quantas subcategorias pendentes rodar nesta leva")
    sub.add_parser("comparar")
    sub.add_parser("status")
    a = sub.add_parser("teste-api")
    a.add_argument("--modelo", default="claude-sonnet-5-5")
    a.add_argument("--subs", nargs="+", required=True)
    a.add_argument("--effort", default="medium")
    be = sub.add_parser("batch-enviar")
    be.add_argument("--modelo", default="claude-opus-5-5")
    be.add_argument("--effort", default="medium")
    be.add_argument("--limit", type=int)
    be.add_argument("--teto", type=float, default=2.0)
    be.add_argument("--sim", action="store_true")
    sub.add_parser("batch-acompanhar")
    bc = sub.add_parser("batch-coletar")
    bc.add_argument("--recoletar", action="store_true", help="reprocessa, dos batches já coletados, só os que falharam")
    args = ap.parse_args()
    {"piloto": cmd_piloto, "rodar": cmd_rodar, "comparar": cmd_comparar, "status": cmd_status,
     "teste-api": cmd_teste_api, "batch-enviar": cmd_batch_enviar, "batch-acompanhar": cmd_batch_acompanhar,
     "batch-coletar": cmd_batch_coletar}[args.cmd](args)


if __name__ == "__main__":
    main()
