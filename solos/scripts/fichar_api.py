"""Etapa 1 via API da Anthropic (sem Claude Code): mesma ficha do fichar.py, bem mais barato.

Usa a ANTHROPIC_API_KEY (do ambiente ou, no Windows, das variáveis de usuário) e cobra
dos créditos da API, sem tocar na cota do plano. O schema, o prompt e a validação vêm
do fichar.py, então as fichas saem no mesmo formato.

Comandos (da raiz do projeto):
  python solos/scripts/fichar_api.py teste --only ID1 ID2 ...    chamadas diretas; grava em _teste/<modelo>/
  python solos/scripts/fichar_api.py enviar [--limit N] [--refazer]   cria um batch (50% mais barato)
  python solos/scripts/fichar_api.py acompanhar                  mostra o andamento dos batches
  python solos/scripts/fichar_api.py coletar                     baixa resultados, valida e grava as fichas
  python solos/scripts/fichar_api.py status                      resumo geral (mesmo do fichar.py)

Todo comando que gasta dinheiro mostra a estimativa antes e pede confirmação acima de --teto (US$).
Fichas que falharem na validação voltam para "erro" e entram no próximo `enviar` com o feedback.
"""
import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import anthropic  # noqa: E402
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming  # noqa: E402
from anthropic.types.messages.batch_create_params import Request  # noqa: E402

import fichar  # noqa: E402

OUT = fichar.OUT
BATCHES_FILE = OUT / "_batches.json"
DEFAULT_MODEL = "claude-haiku-5-5"
MAX_TOKENS = 32000
# US$ por 1M tokens (entrada, saída), preço padrão; o batch cobra metade
PRICES = {"claude-haiku-5-5": (0.10, 0.50), "claude-sonnet-5-5": (2.00, 10.00), "claude-opus-5-5": (4.00, 20.00)}
EST_OUTPUT_TOKENS = 9000  # saída média estimada por fonte (inclui raciocínio)


def api_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key and sys.platform == "win32":
        import winreg
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as k:
                key = winreg.QueryValueEx(k, "ANTHROPIC_API_KEY")[0]
        except OSError:
            key = None
    if not key:
        sys.exit("ANTHROPIC_API_KEY não encontrada (nem no ambiente nem nas variáveis de usuário do Windows).")
    return key


def client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=api_key())


def strip_unsupported(node):
    """O structured output da API não aceita minimum/maximum; a faixa é checada em check_nota."""
    if isinstance(node, dict):
        return {k: strip_unsupported(v) for k, v in node.items() if k not in ("minimum", "maximum")}
    if isinstance(node, list):
        return [strip_unsupported(v) for v in node]
    return node


API_SCHEMA = strip_unsupported(fichar.SCHEMA)


def params(src: dict, model: str, effort: str, feedback=None) -> dict:
    return {
        "model": model,
        "max_tokens": MAX_TOKENS,
        "system": fichar.SYSTEM_PROMPT,
        "output_config": {"effort": effort, "format": {"type": "json_schema", "schema": API_SCHEMA}},
        "messages": [{"role": "user", "content": fichar.build_prompt(src, feedback)}],
    }


def cost(usage, model: str, batch: bool) -> float:
    pin, pout = PRICES.get(model, PRICES["claude-sonnet-5-5"])
    inp = (usage.input_tokens or 0) + (getattr(usage, "cache_creation_input_tokens", 0) or 0) * 1.25 \
        + (getattr(usage, "cache_read_input_tokens", 0) or 0) * 0.1
    c = (inp * pin + (usage.output_tokens or 0) * pout) / 1e6
    return c / 2 if batch else c


def estimate(sources: list[dict], model: str, batch: bool) -> float:
    pin, pout = PRICES.get(model, PRICES["claude-sonnet-5-5"])
    tokens_in = sum(len(s["body"]) / 3.5 + 2500 for s in sources)  # corpo + prompt/schema
    c = (tokens_in * pin + len(sources) * EST_OUTPUT_TOKENS * pout) / 1e6
    return c / 2 if batch else c


def confirm(valor: float, teto: float, sim: bool):
    print(f"Custo estimado: ~US$ {valor:.2f}")
    if valor > teto and not sim:
        resp = input(f"Passa do teto de US$ {teto:.2f}. Continuar? [s/N] ").strip().lower()
        if resp != "s":
            sys.exit("Cancelado.")


def first_text(msg) -> str:
    return next((b.text for b in msg.content if b.type == "text"), "")


def finish(src: dict, data: dict, model: str, attempt: int, c: float, dest_json: Path, dest_md: Path):
    for i in data["ideias"]:
        i["id_global"] = f"{src['id']}#{i['id']}"
    ficha = {"fonte_id": src["id"], "fonte": src["fonte"], **data,
             "_meta": {"modelo": model, "gerado_em": datetime.now().isoformat(timespec="seconds"),
                       "tentativas": attempt, "custo_usd": round(c, 5), "via": "api"}}
    dest_json.write_text(json.dumps(ficha, ensure_ascii=False, indent=1), encoding="utf-8")
    dest_md.write_text(fichar.render_md(ficha), encoding="utf-8")
    return ficha


def check_nota(data: dict) -> list[str]:
    nota = data.get("qualidade_didatica", {}).get("nota")
    return [] if isinstance(nota, int) and 1 <= nota <= 5 else [f"qualidade_didatica.nota deve ser inteiro 1-5 (veio {nota})"]


# ---------- teste: chamadas diretas, para comparar modelos ----------

def cmd_teste(args):
    sources = [s for s in fichar.discover() if s["id"] in set(args.only)]
    missing = set(args.only) - {s["id"] for s in sources}
    if missing:
        sys.exit(f"IDs não encontrados: {missing}")
    confirm(estimate(sources, args.model, batch=False), args.teto, args.sim)
    dest = OUT / "_teste" / args.model
    dest.mkdir(parents=True, exist_ok=True)
    c_total, cl = 0.0, client()
    for s in sources:
        t0 = time.time()
        with cl.messages.stream(**params(s, args.model, args.effort)) as stream:
            msg = stream.get_final_message()
        c = cost(msg.usage, args.model, batch=False)
        c_total += c
        try:
            data = json.loads(first_text(msg))
            errs = fichar.validate(data, s) + check_nota(data)
        except json.JSONDecodeError as e:
            data, errs = None, [f"JSON inválido: {e} (stop_reason={msg.stop_reason})"]
        if data is not None:
            finish(s, data, args.model, 1, c, dest / f"{s['id']}.json", dest / f"{s['id']}.md")
        status = "OK " if not errs else "ERRO"
        n = f"{len(data['segmentos'])} seg · {len(data['ideias'])} ideias" if data else ""
        print(f"{status} {s['id'][:40]:<40} {n:<22} in {msg.usage.input_tokens} · out {msg.usage.output_tokens} · "
              f"US$ {c:.4f} · {time.time() - t0:.0f}s {'; '.join(errs[:2])}", flush=True)
    print(f"\nTotal: US$ {c_total:.4f}. Fichas em {dest.relative_to(fichar.ROOT)}")


# ---------- batch ----------

def load_batches() -> list:
    return json.loads(BATCHES_FILE.read_text(encoding="utf-8")) if BATCHES_FILE.exists() else []


def save_batches(b: list):
    BATCHES_FILE.write_text(json.dumps(b, ensure_ascii=False, indent=1), encoding="utf-8")


def cmd_enviar(args):
    status = fichar.load_status()
    pending_batch = {cid for b in load_batches() if not b.get("coletado") for cid in b["ids"]}
    sources = [s for s in fichar.discover() if s["id"] not in pending_batch]
    if args.only:
        sources = [s for s in sources if s["id"] in set(args.only)]

    def needs(s):
        st = status.get(s["id"], {})
        if st.get("status") != "ok":
            return True
        return args.refazer and st.get("modelo") != args.model

    todo = sorted([s for s in sources if needs(s)], key=lambda s: len(s["body"]))
    if args.limit:
        todo = todo[: args.limit]
    if not todo:
        print("Nada a enviar.")
        return
    print(f"{len(todo)} fontes · modelo {args.model} · effort {args.effort} · batch (50% off)")
    confirm(estimate(todo, args.model, batch=True), args.teto, args.sim)
    # custom_id só aceita [a-zA-Z0-9_-]{1,64}; ids fora disso (documentos longos, acentos) ganham um apelido
    reqs, alias = [], {}
    for n, s in enumerate(todo):
        cid = s["id"] if re.fullmatch(r"[A-Za-z0-9_-]{1,64}", s["id"]) else f"doc-{n:04d}"
        alias[cid] = s["id"]
        fb = status.get(s["id"], {}).get("feedback")
        reqs.append(Request(custom_id=cid, params=MessageCreateParamsNonStreaming(**params(s, args.model, args.effort, fb))))
    batch = client().messages.batches.create(requests=reqs)
    b = load_batches()
    b.append({"id": batch.id, "criado_em": datetime.now().isoformat(timespec="seconds"), "modelo": args.model,
              "effort": args.effort, "ids": [s["id"] for s in todo], "alias": alias, "coletado": False})
    save_batches(b)
    print(f"Batch criado: {batch.id}. Acompanhe com `acompanhar` e depois rode `coletar`.")


def cmd_acompanhar(args):
    cl = client()
    for b in load_batches():
        if b.get("coletado"):
            continue
        info = cl.messages.batches.retrieve(b["id"])
        rc = info.request_counts
        print(f"{b['id']} · {info.processing_status} · {len(b['ids'])} fontes · processando {rc.processing} · "
              f"ok {rc.succeeded} · erro {rc.errored} · expirado {rc.expired} · criado {b['criado_em']}")
    if not any(not b.get("coletado") for b in load_batches()):
        print("Nenhum batch em aberto.")


def cmd_coletar(args):
    cl, batches = client(), load_batches()
    by_id = {s["id"]: s for s in fichar.discover()}
    status = fichar.load_status()
    total_cost, ok, err = 0.0, 0, 0
    for b in batches:
        if b.get("coletado"):
            continue
        info = cl.messages.batches.retrieve(b["id"])
        if info.processing_status != "ended":
            print(f"{b['id']} ainda em {info.processing_status}; pulando.")
            continue
        for r in cl.messages.batches.results(b["id"]):
            sid = b["alias"].get(r.custom_id, r.custom_id)
            src = by_id.get(sid)
            prev = status.get(sid, {})
            attempt = prev.get("tentativas", 0) + 1 if prev.get("status") == "erro" else 1
            entry = {"titulo": src["fonte"].get("titulo") if src else sid, "modelo": b["modelo"], "tentativas": attempt}
            if r.result.type != "succeeded":
                entry.update(status="erro", erro=f"batch: {r.result.type}")
                err += 1
            else:
                msg = r.result.message
                c = cost(msg.usage, b["modelo"], batch=True)
                total_cost += c
                try:
                    data = json.loads(first_text(msg))
                    errs = fichar.validate(data, src) + check_nota(data)
                except json.JSONDecodeError as e:
                    data, errs = None, [f"JSON inválido: {e} (stop_reason={msg.stop_reason})"]
                if errs:
                    entry.update(status="erro", erro="validação: " + "; ".join(errs[:5]), feedback=errs[:15],
                                 custo_usd=round(prev.get("custo_usd", 0) + c, 5))
                    err += 1
                else:
                    finish(src, data, b["modelo"], attempt, c, OUT / "json" / f"{sid}.json", OUT / "md" / f"{sid}.md")
                    entry.update(status="ok", custo_usd=round(c, 5), segmentos=len(data["segmentos"]),
                                 ideias=len(data["ideias"]))
                    ok += 1
            status[sid] = entry
        b["coletado"] = True
        b["coletado_em"] = datetime.now().isoformat(timespec="seconds")
    (OUT / "_status.json").write_text(json.dumps(status, ensure_ascii=False, indent=1), encoding="utf-8")
    save_batches(batches)
    print(f"Coletado: {ok} ok, {err} com erro, custo US$ {total_cost:.4f}.")
    if err:
        print("Os com erro entram no próximo `enviar`, já com o motivo da falha como feedback.")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("teste", "enviar"):
        p = sub.add_parser(name)
        p.add_argument("--model", default=DEFAULT_MODEL)
        p.add_argument("--effort", default="medium", choices=["low", "medium", "high"])
        p.add_argument("--only", nargs="+", required=(name == "teste"))
        p.add_argument("--teto", type=float, default=0.50, help="pede confirmação se a estimativa passar disso")
        p.add_argument("--sim", action="store_true", help="não pergunta (para rodar sem terminal interativo)")
        if name == "enviar":
            p.add_argument("--limit", type=int)
            p.add_argument("--refazer", action="store_true", help="refaz também fichas ok feitas com outro modelo")
    sub.add_parser("acompanhar")
    sub.add_parser("coletar")
    sub.add_parser("status")
    args = ap.parse_args()
    {"teste": cmd_teste, "enviar": cmd_enviar, "acompanhar": cmd_acompanhar, "coletar": cmd_coletar,
     "status": lambda a: fichar.show_status()}[args.cmd](args)


if __name__ == "__main__":
    main()
