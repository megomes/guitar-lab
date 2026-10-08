"""Etapa 1: fichamento. Cada transcript/documento de solos/raw vira uma ficha estruturada.

A ficha divide a fonte em SEGMENTOS por assunto (com início/fim no vídeo) e extrai
IDEIAS atômicas (dicas, exercícios, conceitos...), cada uma presa a um segmento e
a um timestamp. Roda com o Claude Agent SDK (usa o login do Claude Code, sem API key).

Uso (da raiz do projeto):
  python solos/scripts/fichar.py run                 # processa tudo que ainda não está ok
  python solos/scripts/fichar.py run -c 6            # 6 em paralelo
  python solos/scripts/fichar.py run --limit 10      # só os próximos 10
  python solos/scripts/fichar.py run --only fwyn5tQdF4k
  python solos/scripts/fichar.py run --force         # refaz também os que já estão ok
  python solos/scripts/fichar.py status              # resumo + lista de erros

Saídas em solos/processed/01-fichas/:
  json/<fonte>.json   ficha completa (fonte de verdade para as próximas etapas)
  md/<fonte>.md       a mesma ficha legível
  _status.json        estado de cada fonte (ok / erro / pendente, tentativas, custo, contagens)
  _log.txt            log detalhado com horário
Pode interromper com Ctrl+C a qualquer momento: ao rodar de novo, continua de onde parou.
"""
import argparse
import asyncio
import json
import os
import re
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path

from claude_agent_sdk import ClaudeAgentOptions, ResultMessage, query

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "solos" / "raw"
OUT = ROOT / "solos" / "processed" / "01-fichas"
STATUS_FILE = OUT / "_status.json"
LOG_FILE = OUT / "_log.txt"

DEFAULT_MODEL = "claude-sonnet-5-5"
MAX_ATTEMPTS = 3
SKIP_PREFIXES = ("_INDEX", "_sem_", "_fontes")
NOISE = re.compile(r"\[(?:Música|Music|Aplausos|Applause|Risos|Laughter|Risadas|Música de fundo)\]\s*", re.I)

TIPOS_IDEIA = ["dica", "exercicio", "conceito", "erro_comum", "frase_lick", "rotina_estudo", "mentalidade", "recurso"]
NIVEIS = ["iniciante", "intermediario", "avancado"]

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["resumo", "nivel", "qualidade_didatica", "assuntos_principais", "segmentos", "ideias",
                 "artistas_citados", "musicas_citadas", "recursos_citados", "observacoes"],
    "properties": {
        "resumo": {"type": "string", "description": "3 a 6 frases sobre o que a fonte ensina e para quem."},
        "nivel": {"type": "string", "enum": NIVEIS + ["misto"]},
        "qualidade_didatica": {
            "type": "object", "additionalProperties": False, "required": ["nota", "justificativa"],
            "properties": {
                "nota": {"type": "integer", "minimum": 1, "maximum": 5},
                "justificativa": {"type": "string"},
            },
        },
        "assuntos_principais": {"type": "array", "items": {"type": "string"}},
        "segmentos": {
            "type": "array",
            "items": {
                "type": "object", "additionalProperties": False,
                "required": ["id", "titulo", "inicio", "fim", "resumo", "assuntos", "didatico"],
                "properties": {
                    "id": {"type": "string", "description": "S1, S2, ..."},
                    "titulo": {"type": "string"},
                    "inicio": {"type": ["string", "null"], "description": "mm:ss ou h:mm:ss (vídeo); null em documento"},
                    "fim": {"type": ["string", "null"]},
                    "resumo": {"type": "string"},
                    "assuntos": {"type": "array", "items": {"type": "string"}},
                    "didatico": {"type": "boolean", "description": "false para intro, propaganda, despedida, só música"},
                },
            },
        },
        "ideias": {
            "type": "array",
            "items": {
                "type": "object", "additionalProperties": False,
                "required": ["id", "segmento", "tipo", "titulo", "descricao", "passos", "timestamp", "nivel", "tags"],
                "properties": {
                    "id": {"type": "string", "description": "I01, I02, ..."},
                    "segmento": {"type": "string", "description": "id do segmento (S1...)"},
                    "tipo": {"type": "string", "enum": TIPOS_IDEIA},
                    "titulo": {"type": "string"},
                    "descricao": {"type": "string", "description": "Autossuficiente: entendível sem ver a fonte."},
                    "passos": {"type": "array", "items": {"type": "string"},
                               "description": "Passo a passo para exercícios/rotinas; vazio se não se aplica."},
                    "timestamp": {"type": ["string", "null"], "description": "Momento no vídeo onde aparece; null em documento"},
                    "nivel": {"type": "string", "enum": NIVEIS},
                    "tags": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        "artistas_citados": {"type": "array", "items": {"type": "string"}},
        "musicas_citadas": {"type": "array", "items": {"type": "string"}},
        "recursos_citados": {"type": "array", "items": {"type": "string"},
                             "description": "Livros, backing tracks, apps, cursos, outros vídeos citados."},
        "observacoes": {"type": "string",
                        "description": "Problemas da fonte: transcrição ruim, conteúdo que depende de ver tablatura, etc."},
    },
}

SYSTEM_PROMPT = """Você é um professor de guitarra experiente catalogando material didático sobre SOLO e IMPROVISAÇÃO.
Você recebe UMA fonte (transcript de vídeo do YouTube ou documento) e produz uma ficha estruturada em português do Brasil.

Regras:
1. SEGMENTOS: divida a fonte em trechos por assunto. Num vídeo, cada segmento tem início e fim (mm:ss) tirados dos
   timestamps [mm:ss] do transcript; os segmentos são contíguos, em ordem, e cobrem o vídeo inteiro. Um vídeo de
   10 min costuma ter 3 a 8 segmentos. Num documento, segmente pelas seções/assuntos e use inicio/fim = null.
   Marque didatico=false em intro, propaganda/patrocínio, pedido de inscrição, despedida e trechos só de música.
2. IDEIAS: extraia TODAS as ideias úteis para quem quer solar e improvisar melhor. Seja exaustivo e granular:
   uma ideia = uma dica, um exercício, um conceito, um erro comum, uma frase/lick, uma rotina, uma mentalidade ou um
   recurso. Não junte duas coisas diferentes num item. Todo segmento com didatico=true PRECISA ter pelo menos
   uma ideia; se uma introdução só anuncia o tema, sem ensinar nada, marque-a didatico=false.
   - descricao: autossuficiente e concreta (notas, intervalos, casas, cordas, BPM, tonalidade, quando citados).
   - passos: para exercícios e rotinas, o passo a passo prático; senão lista vazia.
   - timestamp: o momento do vídeo onde a ideia aparece (mm:ss); null em documento.
   - tags: termos curtos em minúsculas (ex.: "pentatônica", "notas-alvo", "bend", "call and response").
3. Legendas automáticas erram termos ("beckham" = backing track, "pentatonic" mal escrito, nomes de notas trocados).
   Corrija pelo contexto musical e registre em observacoes os problemas relevantes. Não invente o que não está na fonte.
4. qualidade_didatica: 1 = pouco aproveitável, 5 = excelente e muito concreto.
5. Escreva tudo em português do Brasil, mantendo termos técnicos consagrados (bend, lick, backing track, shape).
6. PRECISÃO TEÓRICA: antes de escrever o nome de uma nota, intervalo ou acorde, calcule-o pela referência abaixo.
   Identifique o TIPO do acorde citado na fonte (C, Cm, C7, Cmaj7...) e não o troque. Se a fonte não deixar claro,
   descreva pelo grau (ex.: "a ♭7 do acorde") em vez de chutar a nota.

REFERÊNCIA DE TEORIA
Notas: Dó=C, Ré=D, Mi=E, Fá=F, Sol=G, Lá=A, Si=B. Sustenido=#, bemol=♭. Semitons entre notas naturais: E-F e B-C;
as demais distam 1 tom. Cromática: C C# D D# E F F# G G# A A# B (C#=D♭, D#=E♭, F#=G♭, G#=A♭, A#=B♭).
Intervalos (semitons): 1=0, ♭2=1, 2=2, ♭3=3, 3=4, 4=5, ♭5/#4=6, 5=7, #5/♭6=8, 6=9, ♭7=10, 7=11, 8=12, 9=2+8va, 11=4+8va, 13=6+8va.
Acordes (fórmula → exemplo em C):
  maior 1-3-5 (C E G) · menor 1-♭3-5 (C E♭ G) · diminuto 1-♭3-♭5 · aumentado 1-3-#5
  7 / dominante 1-3-5-♭7 (C7 = C E G B♭) · maj7 / 7M / "sétima maior" 1-3-5-7 (Cmaj7 = C E G B)
  m7 1-♭3-5-♭7 (Cm7 = C E♭ G B♭) · m7♭5 / meio-diminuto 1-♭3-♭5-♭7 · dim7 1-♭3-♭5-♭♭7 · sus4 1-4-5 · sus2 1-2-5
  9 = 7 + 9; add9 = tríade + 9; 6 = tríade + 6.
  ATENÇÃO: "C7" / "dó sete" / "dó com sétima" é DOMINANTE, então a sétima é B♭. Só em Cmaj7/C7M a sétima é B.
  Guide tones = 3ª e 7ª do acorde (definem a qualidade). Num blues, I7-IV7-V7 são todos dominantes.
Escalas (graus):
  maior / jônio 1-2-3-4-5-6-7 · menor natural / eólio 1-2-♭3-4-5-♭6-♭7 · dórico 1-2-♭3-4-5-6-♭7
  frígio 1-♭2-♭3-4-5-♭6-♭7 · lídio 1-2-3-#4-5-6-7 · mixolídio 1-2-3-4-5-6-♭7 · lócrio 1-♭2-♭3-4-♭5-♭6-♭7
  menor harmônica 1-2-♭3-4-5-♭6-7 · menor melódica 1-2-♭3-4-5-6-7
  pentatônica menor 1-♭3-4-5-♭7 (Am: A C D E G) · pentatônica maior 1-2-3-5-6 (C: C D E G A; relativa de Am)
  blues 1-♭3-4-♭5-5-♭7 (blue note = ♭5) · "blues maior" 1-2-♭3-3-5-6
Campo harmônico maior: I maj7, ii m7, iii m7, IV maj7, V 7, vi m7, vii m7♭5 (em C: Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7♭5).
Braço da guitarra (afinação padrão E A D G B E): casa 5 = nota da corda seguinte, exceto na corda G (casa 4 = B).
  Notas na corda E grave: 0=E 1=F 3=G 5=A 7=B 8=C 10=D 12=E. Corda A: 0=A 2=B 3=C 5=D 7=E 8=F 10=G 12=A.
Legenda automática: "beckham"/"back in track" = backing track; "pentatonic"/"penta" mal escrito; "target nous" =
  target notes; números soltos costumam ser casas ou graus; "Lá menor" = Am; "Mi menor" = Em."""

_status_lock = asyncio.Lock()
_log_lock = asyncio.Lock()
_limit_lock = asyncio.Lock()
_resume_at = 0.0  # time.time() até quando todos os workers esperam (limite do plano)
LIMIT_RE = re.compile(r"(session|usage|weekly) limit|rate.?limit|overloaded|\b429\b|\b529\b", re.I)
RESET_RE = re.compile(r"resets\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", re.I)


class PlanLimit(Exception):
    pass


def reset_time(msg: str) -> float:
    """Converte 'resets 4am' no próximo horário local; sem horário, espera 15 min."""
    m = RESET_RE.search(msg)
    if not m:
        return time.time() + 15 * 60
    hour, minute, ampm = int(m.group(1)), int(m.group(2) or 0), (m.group(3) or "").lower()
    if ampm == "pm" and hour != 12:
        hour += 12
    if ampm == "am" and hour == 12:
        hour = 0
    now = datetime.now()
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if target <= now:
        target = target.fromtimestamp(target.timestamp() + 86400)
    return target.timestamp() + 120  # 2 min de folga


async def wait_for_limit():
    while time.time() < _resume_at:
        await asyncio.sleep(min(60, _resume_at - time.time()))


async def hit_limit(msg: str):
    global _resume_at
    async with _limit_lock:
        if time.time() < _resume_at:
            return  # outro worker já pausou
        _resume_at = reset_time(msg)
        when = datetime.fromtimestamp(_resume_at).strftime("%H:%M")
        print(f"\n*** Limite do plano atingido. Pausando tudo até {when} e retomando sozinho. "
              f"(Ctrl+C para sair; rode de novo depois.)\n", flush=True)
        await log(f"=== limite do plano: pausa até {when} ({msg[:200]})")


# ---------- fontes ----------

def parse_frontmatter(text: str) -> tuple[dict, str]:
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    meta = {}
    if m:
        for line in m.group(1).splitlines():
            key, _, value = line.partition(": ")
            value = value.strip()
            if value.startswith('"'):
                try:
                    value = json.loads(value)
                except json.JSONDecodeError:
                    value = value.strip('"')
            meta[key] = value
    return meta, text[m.end():] if m else text


def duration_seconds(human: str) -> int | None:
    parts = dict((u, int(n)) for n, u in re.findall(r"(\d+)\s*([hms])", human or ""))
    return parts.get("h", 0) * 3600 + parts.get("m", 0) * 60 + parts.get("s", 0) if parts else None


def discover() -> list[dict]:
    sources = []
    for path in sorted((RAW / "transcripts").glob("*.md")):
        if path.name.startswith(SKIP_PREFIXES):
            continue
        meta, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        sources.append({
            "id": meta.get("video_id") or path.name[:11], "kind": "video", "path": path, "body": body,
            "fonte": {"tipo": "video", "titulo": meta.get("title"), "autor": meta.get("channel"), "url": meta.get("url"),
                      "idioma": meta.get("language"), "duracao": meta.get("duration"), "origem": meta.get("source"),
                      "legenda_automatica": meta.get("auto_generated_captions") == "true",
                      "arquivo_raw": str(path.relative_to(ROOT)).replace("\\", "/")},
            "duration_s": duration_seconds(meta.get("duration", "")),
        })
    for path in sorted((RAW / "documentos").glob("*.md")):
        if path.name.startswith(SKIP_PREFIXES):
            continue
        meta, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        sources.append({
            "id": path.stem, "kind": "documento", "path": path, "body": body,
            "fonte": {"tipo": "documento", "titulo": meta.get("title"), "autor": meta.get("author"), "url": meta.get("url"),
                      "site": meta.get("site"), "idioma": meta.get("idioma"), "tema_coleta": meta.get("tema"),
                      "arquivo_raw": str(path.relative_to(ROOT)).replace("\\", "/")},
            "duration_s": None,
        })
    return sources


def build_prompt(src: dict, feedback: list[str] | None) -> str:
    f = src["fonte"]
    body = NOISE.sub("", src["body"]).strip()
    header = [f"TIPO: {f['tipo']}", f"TÍTULO: {f.get('titulo')}", f"AUTOR/CANAL: {f.get('autor')}",
              f"IDIOMA ORIGINAL: {f.get('idioma')}", f"URL: {f.get('url')}"]
    if f.get("duracao"):
        header.append(f"DURAÇÃO: {f['duracao']}")
    prompt = "\n".join(header) + "\n\n===== CONTEÚDO =====\n" + body + "\n===== FIM =====\n\nProduza a ficha."
    if feedback:
        prompt += ("\n\nATENÇÃO: uma tentativa anterior foi rejeitada pela validação automática. Corrija:\n- "
                   + "\n- ".join(feedback))
    return prompt


# ---------- validação ----------

def ts_seconds(ts: str | None) -> int | None:
    if ts is None:
        return None
    if not re.fullmatch(r"\d{1,2}(:\d{2}){1,2}", ts.strip()):
        raise ValueError(ts)
    s = 0
    for p in ts.strip().split(":"):
        s = s * 60 + int(p)
    return s


def validate(ficha: dict, src: dict) -> list[str]:
    errs = []
    segs, ideias = ficha.get("segmentos") or [], ficha.get("ideias") or []
    seg_ids = [s["id"] for s in segs]
    if not segs:
        errs.append("nenhum segmento")
    if len(set(seg_ids)) != len(seg_ids):
        errs.append("ids de segmento repetidos")
    ideia_ids = [i["id"] for i in ideias]
    if len(set(ideia_ids)) != len(ideia_ids):
        errs.append("ids de ideia repetidos")
    if not ideias and any(s.get("didatico") for s in segs):
        errs.append("há segmentos didáticos mas nenhuma ideia")
    for i in ideias:
        if i["segmento"] not in seg_ids:
            errs.append(f"ideia {i['id']} aponta para segmento inexistente {i['segmento']}")
    with_ideas = {i["segmento"] for i in ideias}
    for s in segs:
        if s.get("didatico") and s["id"] not in with_ideas:
            errs.append(f"segmento didático {s['id']} ('{s['titulo']}') sem nenhuma ideia")

    if src["kind"] == "video":
        limit = (src["duration_s"] or 10 ** 6) + 60
        prev = -1
        for s in segs:
            try:
                ini, fim = ts_seconds(s["inicio"]), ts_seconds(s["fim"])
            except ValueError as e:
                errs.append(f"segmento {s['id']}: timestamp inválido '{e}' (use mm:ss)")
                continue
            if ini is None or fim is None:
                errs.append(f"segmento {s['id']}: vídeo precisa de inicio e fim")
                continue
            if ini < prev:
                errs.append(f"segmento {s['id']} começa antes do anterior (fora de ordem)")
            if fim < ini:
                errs.append(f"segmento {s['id']}: fim antes do início")
            if fim > limit:
                errs.append(f"segmento {s['id']}: fim {s['fim']} passa da duração do vídeo")
            prev = ini
        if segs and not errs:
            first = ts_seconds(segs[0]["inicio"])
            if first is not None and first > 90:
                errs.append("o primeiro segmento deve começar no início do vídeo (cobrir o vídeo inteiro)")
        for i in ideias:
            try:
                t = ts_seconds(i["timestamp"])
            except ValueError as e:
                errs.append(f"ideia {i['id']}: timestamp inválido '{e}'")
                continue
            if t is not None and t > limit:
                errs.append(f"ideia {i['id']}: timestamp {i['timestamp']} passa da duração do vídeo")
    return errs


# ---------- saída ----------

def render_md(ficha: dict) -> str:
    f = ficha["fonte"]
    lines = [f"# {f.get('titulo')}", "",
             f"**{f.get('autor') or ''}** · {f['tipo']} · {f.get('duracao') or f.get('site') or ''} · "
             f"nível {ficha['nivel']} · qualidade {ficha['qualidade_didatica']['nota']}/5 · {f.get('url')}", "",
             ficha["resumo"], ""]
    by_seg = {}
    for i in ficha["ideias"]:
        by_seg.setdefault(i["segmento"], []).append(i)
    for s in ficha["segmentos"]:
        span = f" [{s['inicio']}–{s['fim']}]" if s.get("inicio") else ""
        lines += [f"## {s['id']} · {s['titulo']}{span}" + ("" if s["didatico"] else " _(não didático)_"), "",
                  s["resumo"], ""]
        for i in by_seg.get(s["id"], []):
            ts = f" `{i['timestamp']}`" if i.get("timestamp") else ""
            lines.append(f"- **{i['id_global']}** · _{i['tipo']}_ · {i['titulo']}{ts} — {i['descricao']}")
            lines += [f"    {n}. {p}" for n, p in enumerate(i["passos"], 1)]
        lines.append("")
    if ficha.get("observacoes"):
        lines += ["---", f"_Observações:_ {ficha['observacoes']}", ""]
    return "\n".join(lines)


def load_status() -> dict:
    if STATUS_FILE.exists():
        return json.loads(STATUS_FILE.read_text(encoding="utf-8"))
    return {}


async def save_status(status: dict, sid: str, entry: dict):
    async with _status_lock:
        status[sid] = entry
        tmp = STATUS_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(status, ensure_ascii=False, indent=1), encoding="utf-8")
        os.replace(tmp, STATUS_FILE)


async def log(msg: str):
    async with _log_lock:
        with LOG_FILE.open("a", encoding="utf-8") as fh:
            fh.write(f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}\n")


# ---------- execução ----------

async def call_model(prompt: str, model: str) -> tuple[dict, float]:
    options = ClaudeAgentOptions(
        model=model, system_prompt=SYSTEM_PROMPT, tools=[], allowed_tools=[], setting_sources=[], strict_mcp_config=True, mcp_servers={},
        max_turns=4, output_format={"type": "json_schema", "schema": SCHEMA}, cwd=str(OUT),
    )
    result = None
    try:
        async for message in query(prompt=prompt, options=options):
            if isinstance(message, ResultMessage):
                result = message
    except Exception as e:
        if LIMIT_RE.search(str(e)):
            raise PlanLimit(str(e)) from e
        raise
    if result is None:
        raise RuntimeError("sem ResultMessage")
    if result.is_error or result.structured_output is None:
        msg = f"subtype={result.subtype} errors={result.errors} result={(result.result or '')[:300]}"
        if LIMIT_RE.search(msg):
            raise PlanLimit(msg)
        raise RuntimeError(f"erro do modelo: {msg}")
    return result.structured_output, result.total_cost_usd or 0.0


async def process(src: dict, model: str, status: dict, sem: asyncio.Semaphore, progress) -> None:
    sid = src["id"]
    async with sem:
        t0, cost, feedback, last_err = time.time(), 0.0, None, ""
        attempt = 0
        while attempt < MAX_ATTEMPTS:
            await wait_for_limit()
            attempt += 1
            try:
                await log(f"[{sid}] tentativa {attempt} ({len(src['body'])} chars)")
                try:
                    ficha, c = await call_model(build_prompt(src, feedback), model)
                except PlanLimit as e:
                    attempt -= 1  # limite do plano não conta como tentativa
                    await hit_limit(str(e))
                    continue
                cost += c
                errs = validate(ficha, src)
                if errs:
                    feedback, last_err = errs[:15], "validação: " + "; ".join(errs[:5])
                    await log(f"[{sid}] validação falhou: {errs}")
                    continue
                for i in ficha["ideias"]:
                    i["id_global"] = f"{sid}#{i['id']}"
                ficha = {"fonte_id": sid, "fonte": src["fonte"], **ficha,
                         "_meta": {"modelo": model, "gerado_em": datetime.now().isoformat(timespec="seconds"),
                                   "tentativas": attempt, "custo_usd": round(cost, 4)}}
                (OUT / "json" / f"{sid}.json").write_text(json.dumps(ficha, ensure_ascii=False, indent=1), encoding="utf-8")
                (OUT / "md" / f"{sid}.md").write_text(render_md(ficha), encoding="utf-8")
                entry = {"status": "ok", "tentativas": attempt, "custo_usd": round(cost, 4),
                         "segundos": round(time.time() - t0), "segmentos": len(ficha["segmentos"]),
                         "ideias": len(ficha["ideias"]), "titulo": src["fonte"].get("titulo")}
                await save_status(status, sid, entry)
                await log(f"[{sid}] OK {entry}")
                progress(sid, entry)
                return
            except Exception as e:  # erro de rede, rate limit, saída inválida...
                last_err = f"{type(e).__name__}: {e}"
                await log(f"[{sid}] exceção na tentativa {attempt}: {last_err}\n{traceback.format_exc()}")
                await asyncio.sleep(min(60, 5 * 2 ** attempt))
        entry = {"status": "erro", "tentativas": MAX_ATTEMPTS, "custo_usd": round(cost, 4),
                 "segundos": round(time.time() - t0), "erro": last_err[:500], "titulo": src["fonte"].get("titulo")}
        await save_status(status, sid, entry)
        progress(sid, entry)


async def run(args):
    for d in (OUT, OUT / "json", OUT / "md"):
        d.mkdir(parents=True, exist_ok=True)
    status = load_status()
    sources = discover()
    if args.only:
        sources = [s for s in sources if s["id"] in set(args.only)]
    todo = [s for s in sources if args.force or status.get(s["id"], {}).get("status") != "ok"]
    # vídeos curtos primeiro dá feedback rápido; documentos grandes ficam para o fim
    todo.sort(key=lambda s: len(s["body"]))
    if args.limit:
        todo = todo[: args.limit]
    total, done, t_start = len(todo), {"ok": 0, "erro": 0, "custo": 0.0, "ideias": 0}, time.time()
    print(f"{len(sources)} fontes · {total} a processar · modelo {args.model} · {args.concurrency} em paralelo")
    print(f"log: {LOG_FILE.relative_to(ROOT)}\n")
    await log(f"=== início: {total} fontes, modelo {args.model}, concorrência {args.concurrency}")

    def progress(sid, entry):
        done[entry["status"]] += 1
        done["custo"] += entry.get("custo_usd", 0)
        done["ideias"] += entry.get("ideias", 0)
        n = done["ok"] + done["erro"]
        elapsed = time.time() - t_start
        eta = elapsed / n * (total - n)
        mark = "OK  " if entry["status"] == "ok" else "ERRO"
        detail = (f"{entry['segmentos']:>2} seg · {entry['ideias']:>3} ideias" if entry["status"] == "ok"
                  else entry["erro"][:70])
        title = (entry.get("titulo") or sid)[:48]
        print(f"[{n:>3}/{total}] {mark} {title:<48} {detail} | ok {done['ok']} · erro {done['erro']} · "
              f"{done['ideias']} ideias · ${done['custo']:.2f} · ETA {eta / 60:.0f} min", flush=True)

    sem = asyncio.Semaphore(args.concurrency)
    await asyncio.gather(*(process(s, args.model, status, sem, progress) for s in todo))
    print(f"\nFim em {(time.time() - t_start) / 60:.1f} min: {done['ok']} ok, {done['erro']} com erro, "
          f"{done['ideias']} ideias, ${done['custo']:.2f}.")
    if done["erro"]:
        print("Rode de novo o mesmo comando para tentar só os que falharam.")
    await log("=== fim")


def show_status():
    status, sources = load_status(), discover()
    ok = [s for s in sources if status.get(s["id"], {}).get("status") == "ok"]
    err = [s for s in sources if status.get(s["id"], {}).get("status") == "erro"]
    pend = len(sources) - len(ok) - len(err)
    ideias = sum(status[s["id"]].get("ideias", 0) for s in ok)
    segs = sum(status[s["id"]].get("segmentos", 0) for s in ok)
    custo = sum(v.get("custo_usd", 0) for v in status.values())
    print(f"{len(sources)} fontes: {len(ok)} ok · {len(err)} erro · {pend} pendentes")
    print(f"{segs} segmentos · {ideias} ideias · custo acumulado ${custo:.2f}")
    for s in err:
        print(f"  ERRO {s['id']}: {status[s['id']].get('erro', '')[:150]}")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("-c", "--concurrency", type=int, default=4)
    r.add_argument("--limit", type=int)
    r.add_argument("--only", nargs="+")
    r.add_argument("--force", action="store_true")
    r.add_argument("--model", default=DEFAULT_MODEL)
    sub.add_parser("status")
    args = ap.parse_args()
    if args.cmd == "status":
        show_status()
    else:
        try:
            asyncio.run(run(args))
        except KeyboardInterrupt:
            print("\nInterrompido. O que já terminou está salvo; rode de novo para continuar.")


if __name__ == "__main__":
    main()
