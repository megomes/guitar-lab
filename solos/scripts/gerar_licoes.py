"""Etapa 5: lições. Cada subcategoria consolidada vira uma lição interativa (texto + exercícios com tab, braço e acordes).

O Opus recebe os itens consolidados, os exercícios originais transcritos (marcados como pouco confiáveis), a lista
de fontes com minuto exato e as outras lições (para não repetir). Devolve a lição num formato neutro que a aba
"Solos" do app desenha. Um validador confere cada nota pela corda e casa (nota e grau) e cada digitação de acorde;
se algo não bate, a lição volta ao modelo com os erros apontados.

Uso (da raiz do projeto):
  python solos/scripts/gerar_licoes.py piloto --subs C07.3 C09.1      chamada direta (créditos da API)
  python solos/scripts/gerar_licoes.py validar lib/solos/licoes/C07.3.json

Saídas: lib/solos/licoes/<sub>.json (o app importa daqui) e solos/processed/05-licoes/_log.txt
"""
import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import consolidar as cons  # noqa: E402
import fichar  # noqa: E402
import fichar_api  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / "solos" / "processed"
OUT_APP = ROOT / "lib" / "solos" / "licoes"
OUT_LOG = P / "05-licoes"
MODEL = "claude-opus-5-5"
MAX_ATTEMPTS = 3

# ---------- teoria para o validador ----------

OPEN_MIDI = {1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40}  # corda 1 = mi agudo
LETTER_PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
DEGREE_SEMI = {"1": 0, "♭2": 1, "♭9": 1, "2": 2, "9": 2, "♯2": 3, "♯9": 3, "♭3": 3, "3": 4, "4": 5, "11": 5,
               "♯4": 6, "♯11": 6, "♭5": 6, "5": 7, "♯5": 8, "♭6": 8, "♭13": 8, "6": 9, "13": 9, "♭♭7": 9,
               "♭7": 10, "7": 11}
QUALITY = [  # (sufixo, intervalos) — o mais longo primeiro
    ("m7♭5", [0, 3, 6, 10]), ("maj7", [0, 4, 7, 11]), ("dim7", [0, 3, 6, 9]), ("add9", [0, 4, 7, 2]),
    ("sus2", [0, 2, 7]), ("sus4", [0, 5, 7]), ("m9", [0, 3, 7, 10, 2]), ("m7", [0, 3, 7, 10]),
    ("m6", [0, 3, 7, 9]), ("dim", [0, 3, 6]), ("aug", [0, 4, 8]), ("13", [0, 4, 7, 10, 2, 9]),
    ("9", [0, 4, 7, 10, 2]), ("7", [0, 4, 7, 10]), ("6", [0, 4, 7, 9]), ("m", [0, 3, 7]), ("", [0, 4, 7]),
]


def norm(s: str) -> str:
    return s.replace("b", "♭").replace("#", "♯") if s else s


def note_pc(name: str) -> int | None:
    m = re.fullmatch(r"([A-G])([♭♯b#]*)", (name or "").strip())
    if not m:
        return None
    acc = norm(m.group(2))
    return (LETTER_PC[m.group(1)] + acc.count("♯") - acc.count("♭")) % 12


def parse_chord(sym: str):
    sym = norm(sym.replace("M7", "maj7").replace("7M", "maj7").replace("ø", "m7♭5").replace("°", "dim"))
    m = re.match(r"([A-G][♭♯]?)(.*)", sym)
    if not m:
        return None
    root = note_pc(m.group(1))
    rest = m.group(2).split("/")[0]
    for suf, ivs in QUALITY:
        if rest == suf:
            return root, {(root + i) % 12 for i in ivs}
    return None


def fret_pc(corda: int, casa: int) -> int:
    return (OPEN_MIDI[corda] + casa) % 12


def check_note(n: dict, ref_pc: int | None, where: str) -> list[str]:
    errs = []
    if n["corda"] not in OPEN_MIDI or not (0 <= n["casa"] <= 21):
        return [f"{where}: corda {n['corda']}/casa {n['casa']} fora do braço"]
    real = fret_pc(n["corda"], n["casa"])
    named = note_pc(n.get("nota", ""))
    if named is None:
        errs.append(f"{where}: nota '{n.get('nota')}' ilegível")
    elif named != real:
        errs.append(f"{where}: corda {n['corda']} casa {n['casa']} é {['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][real]}, não {n['nota']}")
    g = norm(n.get("grau") or "")
    if g and ref_pc is not None:
        if g not in DEGREE_SEMI:
            errs.append(f"{where}: grau '{n['grau']}' desconhecido")
        elif (real - ref_pc) % 12 != DEGREE_SEMI[g]:
            errs.append(f"{where}: {n.get('nota')} não é o {g} da referência ({n['corda']}ª corda, casa {n['casa']})")
    return errs


def validate_visual(v: dict, where: str) -> list[str]:
    errs = []
    if not v or v.get("tipo") in (None, "nenhum"):
        return errs
    ton = note_pc(v.get("tonica") or "")
    for bi, bar in enumerate(v.get("compassos") or []):
        ch = parse_chord(bar["acorde"]) if bar.get("acorde") else None
        if bar.get("acorde") and ch is None:
            errs.append(f"{where} compasso {bi + 1}: acorde '{bar['acorde']}' não reconhecido")
        ref = ch[0] if ch else ton
        for ev in bar.get("tempos") or []:
            if not (0 <= ev["t"] < 4):
                errs.append(f"{where} compasso {bi + 1}: tempo {ev['t']} fora de 0–3.75")
            for n in ev["notas"]:
                errs += check_note(n, ref, f"{where} c{bi + 1} t{ev['t']}")
                if n.get("alvo") and ch and fret_pc(n["corda"], n["casa"]) not in ch[1]:
                    errs.append(f"{where} c{bi + 1}: nota-alvo {n.get('nota')} não pertence a {bar['acorde']}")
    for i, mk in enumerate(v.get("marcas") or []):
        errs += check_note(mk, ton, f"{where} marca {i + 1}")
    for a in v.get("acordes") or []:
        ch = parse_chord(a["nome"])
        dig = a.get("digitacao") or ""
        if ch is None:
            errs.append(f"{where}: acorde '{a['nome']}' não reconhecido")
            continue
        if len(dig) != 6:
            errs.append(f"{where}: digitação '{dig}' de {a['nome']} precisa de 6 posições (6ª→1ª, x = abafada)")
            continue
        for k, c in enumerate(dig):
            if c.lower() == "x":
                continue
            corda = 6 - k
            casa = int(c, 36) if c.isalnum() else -1
            if fret_pc(corda, casa) not in ch[1]:
                errs.append(f"{where}: {a['nome']} {dig}: a {corda}ª corda casa {casa} não é nota do acorde")
    return errs


def clean_text(x):
    """O modelo às vezes devolve aspas escapadas dentro do texto (\\"); o app mostraria a barra."""
    if isinstance(x, str):
        return x.replace("\\\"", '"')
    if isinstance(x, list):
        return [clean_text(v) for v in x]
    if isinstance(x, dict):
        return {k: clean_text(v) for k, v in x.items()}
    return x


def inline_visuals(L: dict) -> dict:
    """O modelo devolve os visuais numa lista (schema menor); a lição final traz cada um no seu lugar."""
    L = clean_text(L)
    for v in L.get("visuais", []):
        for k in ("compassos", "marcas", "acordes"):
            v.setdefault(k, [])
        v.setdefault("bpm", 70)
    by_id = {v["id"]: v for v in L.pop("visuais", [])}
    for blk in L.get("conceito", []) + L.get("exercicios", []):
        if isinstance(blk.get("visual"), str):
            blk["visual"] = by_id.get(blk["visual"])
    return L


def validate_lesson(L: dict) -> list[str]:
    errs = []
    for k, sec in enumerate(L.get("conceito", [])):
        errs += validate_visual(sec.get("visual"), f"conceito {k + 1} (visual {(sec.get('visual') or {}).get('id', '-')})")
    for ex in L.get("exercicios", []):
        errs += validate_visual(ex.get("visual"), f"exercício '{ex['titulo']}' (visual {(ex.get('visual') or {}).get('id', '-')})")
    return errs


# ---------- schema da lição ----------

NOTE = {"type": "object", "additionalProperties": False, "required": ["corda", "casa", "nota", "grau", "alvo"],
        "properties": {"corda": {"type": "integer", "description": "1 = mi agudo ... 6 = mi grave"},
                       "casa": {"type": "integer"}, "nota": {"type": "string", "description": "ex.: C, F♯, B♭"},
                       "grau": {"type": "string", "description": "em relação ao acorde do compasso (ou à tônica); ex.: 1, ♭3, 5, ♭7, 9"},
                       "alvo": {"type": "boolean", "description": "nota-alvo do exercício (ganha anel)"}}}
VISUAL = {
    "type": "object", "additionalProperties": False,
    # Só o essencial é obrigatório: quando o modelo omitia uma lista vazia (ex.: "acordes" numa tab), o SDK
    # recusava a resposta e ele reescrevia a lição inteira. As listas que faltarem viram [] em inline_visuals.
    "required": ["id", "tipo", "legenda", "tonica"],
    "properties": {
        "id": {"type": "string", "description": "V1, V2, ... (referenciado por conceito/exercício)"},
        "tipo": {"type": "string", "enum": ["tab", "braco", "acordes", "nenhum"]},
        "legenda": {"type": "string"},
        "tonica": {"type": "string", "description": "referência dos graus quando o compasso não tem acorde"},
        "bpm": {"type": "integer"},
        "compassos": {"type": "array", "description": "tab: compassos 4/4; tempos vazios = pausa (silêncio é musical!)",
                      "items": {"type": "object", "additionalProperties": False, "required": ["acorde", "tempos"],
                                "properties": {
                                    "acorde": {"type": "string", "description": "acorde que soa no compasso, ou vazio"},
                                    "tempos": {"type": "array", "items": {
                                        "type": "object", "additionalProperties": False, "required": ["t", "notas"],
                                        "properties": {"t": {"type": "number", "description": "posição no compasso: 0, 0.5, 1 ... 3.5 (colcheias) ou 0, 1, 2, 3"},
                                                       "notas": {"type": "array", "items": NOTE}}}}}}},
        "marcas": {"type": "array", "description": "braço: notas acesas", "items": NOTE},
        "acordes": {"type": "array", "items": {"type": "object", "additionalProperties": False,
                                               "required": ["nome", "digitacao"],
                                               "properties": {"nome": {"type": "string"},
                                                              "digitacao": {"type": "string", "description": "6 caracteres da 6ª para a 1ª corda, x = abafada; casas ≥10 em letra (a=10, b=11, c=12)"}}}},
    },
}
FIX_SCHEMA = {"type": "object", "additionalProperties": False, "required": ["visuais"],
              "properties": {"visuais": {"type": "array", "items": VISUAL}}}

SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["titulo", "gancho", "porque_importa", "ilustracao", "visuais", "conceito", "fontes_destaque",
                 "exercicios", "erros_comuns", "resumo", "proximos_passos"],
    "properties": {
        "visuais": {"type": "array", "description": "todos os visuais (tab/braço/acordes) da lição; cada um com id V#",
                    "items": VISUAL},
        "titulo": {"type": "string"},
        "gancho": {"type": "string", "description": "uma frase que dá vontade de estudar"},
        "porque_importa": {"type": "string", "description": "2 a 3 frases"},
        "ilustracao": {"type": "string", "enum": ["respiracao", "gravidade", "conversa", "mapa", "ondas", "degraus"],
                       "description": "metáfora visual animada do topo da página"},
        "conceito": {"type": "array", "description": "3 a 5 blocos curtos que ensinam o conceito",
                     "items": {"type": "object", "additionalProperties": False,
                               "required": ["titulo", "texto", "destaque", "visual"],
                               "properties": {"titulo": {"type": "string"}, "texto": {"type": "string"},
                                              "destaque": {"type": "string", "description": "frase-chave curta, ou vazio"},
                                              "visual": {"type": "string", "description": "id do visual (V#) ou vazio"}}}},
        "fontes_destaque": {"type": "array", "description": "3 a 6 trechos de vídeo mais valiosos",
                            "items": {"type": "object", "additionalProperties": False, "required": ["ref", "porque"],
                                      "properties": {"ref": {"type": "integer", "description": "número da fonte (F#)"},
                                                     "porque": {"type": "string", "description": "o que o aluno vai ver ali, 1 frase"}}}},
        "exercicios": {"type": "array", "description": "4 a 7 exercícios progressivos",
                       "items": {"type": "object", "additionalProperties": False,
                                 "required": ["titulo", "objetivo", "nivel", "minutos", "passos", "visual",
                                              "variacoes", "cuidado", "inspirado_em"],
                                 "properties": {"titulo": {"type": "string"}, "objetivo": {"type": "string"},
                                                "nivel": {"type": "string", "enum": ["iniciante", "intermediario", "avancado"]},
                                                "minutos": {"type": "integer"},
                                                "passos": {"type": "array", "items": {"type": "string"}},
                                                "visual": {"type": "string", "description": "id do visual (V#) ou vazio"},
                                                "variacoes": {"type": "array", "items": {"type": "string"}},
                                                "cuidado": {"type": "string", "description": "o erro típico neste exercício"},
                                                "inspirado_em": {"type": "array", "items": {"type": "integer"},
                                                                 "description": "números F# das fontes que inspiraram"}}}},
        "erros_comuns": {"type": "array", "items": {"type": "string"}},
        "resumo": {"type": "array", "items": {"type": "string"}, "description": "3 a 5 bullets para lembrar"},
        "proximos_passos": {"type": "string", "description": "para quais lições seguir (cite pelo nome)"},
    },
}

SYSTEM = """Você é um professor de guitarra excepcional e designer instrucional, criando UMA lição da aba "Solos" de um app
de estudo de guitarra (português do Brasil). O app é interativo: desenha tablatura que TOCA com som e acende cada nota,
o braço da guitarra com notas coloridas por grau (tônica, terça, quinta) e diagramas de acordes.

Você recebe: (1) os itens consolidados desta subcategoria, extraídos de dezenas de professores; (2) os exercícios originais
como foram TRANSCRITOS de vídeos — legendas automáticas, pouco confiáveis em notas e casas; (3) a lista de fontes (F#) com
autor, qualidade e minuto; (4) as outras lições da aba.

Sua tarefa:
- Ensinar o conceito de forma clara, progressiva e envolvente, sem encher linguiça: texto curto, frases fortes, exemplos.
- Criar 4 a 7 EXERCÍCIOS PRÓPRIOS, os melhores possíveis: entenda a INTENÇÃO dos exercícios transcritos, junte o que
  vários professores propõem e projete exercícios melhores, concretos e tocáveis. Não copie notas/casas da transcrição:
  escreva você mesmo, nota por nota, e confira cada uma. Progressão do simples ao desafiador.
- Use os visuais onde ajudam: "tab" para frases e licks (com pausas reais — silêncio é parte da música; compassos vazios
  ou tempos sem notas), "braco" para mostrar onde as notas moram, "acordes" para as formas dos acordes. "nenhum" quando
  texto basta. Em tab, use 2 a 4 compassos, colcheias no máximo, e um bpm confortável (60–90). Prefira tonalidades
  comuns na guitarra (Lá menor, Mi menor, Sol, Dó, Ré) e regiões do braço que façam sentido para a mão.
- Corda 1 = mi agudo, corda 6 = mi grave. Casa 0 = solta. Grau sempre em relação ao acorde do compasso (ou à tônica).
- Fontes em destaque: escolha 3 a 6 trechos de vídeo realmente valiosos (prefira qualidade alta e trechos que MOSTRAM
  a ideia tocada), dizendo o que o aluno vai ver ali.
- NÃO repita o conteúdo de outras lições: se tocar no assunto delas, só referencie pelo nome.
- Entregue a lição UMA vez, direto no formato estruturado pedido, sem escrever a lição em texto antes. Confira os
  campos obrigatórios e os valores permitidos (enums) antes de entregar.

REFERÊNCIA DE TEORIA""" + cons.TEORIA


# ---------- entrada ----------

def build_prompt(sub_id: str):
    tax, cls, ideias, subs = cons.build_inputs()
    cons_d = json.loads((cons.OUT / f"{sub_id}.json").read_text(encoding="utf-8"))
    c, s = subs[sub_id]
    # fontes numeradas: só as ideias que entraram nos itens desta subcategoria
    gids = list(dict.fromkeys(g for it in cons_d["itens"] for g in it["fontes"]))
    fonte_num = {g: n for n, g in enumerate(gids, 1)}
    lines = [f"LIÇÃO: {s['id']} · {s['nome']} (módulo {c['id']} {c['nome']})", f"Descrição: {s['descricao']}", "",
             "OUTRAS LIÇÕES DA ABA (não repetir; só referenciar): " +
             "; ".join(f"{v[1]['nome']}" for k, v in subs.items() if k not in (sub_id, "X00")), "",
             "VISÃO GERAL CONSOLIDADA:", cons_d["visao_geral"], "", f"ITENS CONSOLIDADOS ({len(cons_d['itens'])}):"]
    for it in cons_d["itens"]:
        refs = ",".join(f"F{fonte_num[g]}" for g in it["fontes"])
        lines.append(f"- [{it['tipo']}/{it['nivel']}] {it['titulo']}: {it['descricao']}"
                     + (f" PASSOS: {' | '.join(it['passos'])}" if it["passos"] else "")
                     + (f" DIVERGÊNCIAS: {it['divergencias']}" if it["divergencias"] else "")
                     + (f" CORREÇÕES: {it['correcoes']}" if it["correcoes"] else "") + f" (fontes {refs})")
    feitas = []
    for p in sorted(OUT_APP.glob("*.json")):
        if p.stem == sub_id:
            continue
        o = json.loads(p.read_text(encoding="utf-8"))
        feitas.append(f"- {o['titulo']}: conceitos [{'; '.join(c['titulo'] for c in o['conceito'])}] · "
                      f"exercícios [{'; '.join(e['titulo'] for e in o['exercicios'])}]")
    if feitas:
        lines += ["", "LIÇÕES JÁ ESCRITAS (não repita estes conceitos nem exercícios; crie exercícios com foco "
                  "NESTA lição — se um exercício treinaria mais o tema de outra lição, não use):"] + feitas
    lines += ["", "EXERCÍCIOS ORIGINAIS TRANSCRITOS (intenção útil; notas/casas pouco confiáveis):"]
    for g in gids:
        f, i = ideias[g]
        if i["tipo"] == "exercicio":
            lines.append(f"- F{fonte_num[g]} {i['titulo']}: {i['descricao']}" + (f" PASSOS: {' | '.join(i['passos'])}" if i["passos"] else ""))
    lines += ["", "FONTES (F#):"]
    for g, n in fonte_num.items():
        f, i = ideias[g]
        fo = f["fonte"]
        ts = f" @{i['timestamp']}" if i.get("timestamp") else ""
        lines.append(f"F{n} {fo['tipo']} · {fo.get('autor') or fo.get('site') or ''} · {fo.get('titulo')} · qualidade "
                     f"{f['qualidade_didatica']['nota']}{ts} · {i['titulo']}")
    return "\n".join(lines) + "\n\nCrie a lição.", gids, (c, s)


def resolve_sources(L: dict, gids: list[str]):
    """Troca F# pelos dados reais da fonte: url com o minuto exato, autor, título, thumbnail."""
    _, _, ideias, _ = cons.build_inputs()

    def info(n):
        if not (1 <= n <= len(gids)):
            return None
        f, i = ideias[gids[n - 1]]
        fo = f["fonte"]
        sec = 0
        if i.get("timestamp"):
            for p in i["timestamp"].split(":"):
                sec = sec * 60 + int(p)
        vid = f["fonte_id"] if fo["tipo"] == "video" else None
        url = f"{fo['url']}&t={max(0, sec - 2)}s" if vid else fo["url"]
        return {"id": gids[n - 1], "tipo": fo["tipo"], "autor": fo.get("autor") or fo.get("site") or "",
                "titulo": fo.get("titulo") or "", "url": url, "video": vid, "inicio": max(0, sec - 2) if vid else None,
                "momento": i.get("timestamp"), "ideia": i["titulo"]}

    L["fontes_destaque"] = [{**x, "fonte": info(x["ref"])} for x in L["fontes_destaque"] if info(x["ref"])]
    for ex in L["exercicios"]:
        ex["inspirado_em"] = [info(n) for n in ex["inspirado_em"] if info(n)]
    return L


# ---------- execução ----------

def log(msg):
    OUT_LOG.mkdir(parents=True, exist_ok=True)
    with (OUT_LOG / "_log.txt").open("a", encoding="utf-8") as fh:
        fh.write(f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}\n")


def cmd_piloto(args):
    OUT_APP.mkdir(parents=True, exist_ok=True)
    cl, total = fichar_api.client(), 0.0
    for sub_id in args.subs:
        text, gids, (c, s) = build_prompt(sub_id)
        messages = [{"role": "user", "content": text}]
        for attempt in range(1, MAX_ATTEMPTS + 1):
            t0 = time.time()
            with cl.messages.stream(model=MODEL, max_tokens=64000, system=SYSTEM,
                                    output_config={"effort": args.effort, "format": {"type": "json_schema", "schema": SCHEMA}},
                                    messages=messages) as stream:
                msg = stream.get_final_message()
            c_ = fichar_api.cost(msg.usage, MODEL, batch=False)
            total += c_
            L = inline_visuals(json.loads(fichar_api.first_text(msg)))
            errs = validate_lesson(L)
            log(f"[{sub_id}] tentativa {attempt} in={msg.usage.input_tokens} out={msg.usage.output_tokens} "
                f"US$ {c_:.3f} erros={errs}")
            print(f"{sub_id} tentativa {attempt}: in {msg.usage.input_tokens} · out {msg.usage.output_tokens} · "
                  f"US$ {c_:.3f} · {time.time() - t0:.0f}s · {len(errs)} erros de teoria", flush=True)
            if not errs:
                break
            for e in errs[:8]:
                print("   ", e)
            # corrige na mesma conversa: o modelo vê a própria lição e os erros apontados
            messages = messages + [{"role": "assistant", "content": fichar_api.first_text(msg)},
                                   {"role": "user", "content": "O validador automático (que calcula a nota real de cada "
                                    "corda/casa) encontrou estes erros. Devolva a lição inteira corrigida:\n- " + "\n- ".join(errs[:30])}]
        L = resolve_sources(L, gids)
        L["_meta"] = {"subcategoria": sub_id, "modulo": {"id": c["id"], "nome": c["nome"]}, "nome": s["nome"],
                      "modelo": MODEL, "gerado_em": datetime.now().isoformat(timespec="seconds"),
                      "erros_restantes": errs, "tentativas": attempt}
        (OUT_APP / f"{sub_id}.json").write_text(json.dumps(L, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nTotal: US$ {total:.2f}")


# ---------- próximas N, via Agent SDK (cota do plano) ----------

REGISTRY = ROOT / "lib" / "solos" / "registry.ts"


def trail_order() -> list[str]:
    t = json.loads((ROOT / "lib" / "solos" / "trilha.json").read_text(encoding="utf-8"))
    return [l["id"] for m in t["modulos"] for l in m["licoes"]]


def write_registry():
    """lib/solos/registry.ts: importa todas as lições prontas (o app não precisa ser editado à mão)."""
    ids = [i for i in trail_order() if (OUT_APP / f"{i}.json").exists()]
    var = lambda i: "L_" + i.replace(".", "_")
    lines = ["/* Gerado por solos/scripts/gerar_licoes.py — não editar à mão. As lições prontas, na ordem da trilha. */",
             "import type { Lesson } from './types'", ""]
    lines += [f"import {var(i)} from './licoes/{i}.json'" for i in ids]
    lines += ["", "export const LESSONS: Record<string, Lesson> = {"]
    lines += [f"  '{i}': {var(i)} as unknown as Lesson," for i in ids]
    lines += ["}", ""]
    REGISTRY.write_text("\n".join(lines), encoding="utf-8")
    return ids


async def sdk_generate(sub_id: str, effort: str):
    import tempfile
    from claude_agent_sdk import (AssistantMessage, ClaudeAgentOptions, ResultMessage, TextBlock, ToolResultBlock,
                                  UserMessage, query)
    text, gids, (c, s) = build_prompt(sub_id)
    empty = tempfile.mkdtemp(prefix="licao-")
    usage_tot = {"input": 0, "cache_write": 0, "cache_read": 0, "output": 0, "thinking": 0, "turns": 0, "custo_nominal": 0.0}
    prompt, errs, attempt, L = text, [], 0, None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        # Mínimo de sobrecarga: sem ferramentas, sem MCP/conectores, sem settings/CLAUDE.md, pasta vazia.
        opts = ClaudeAgentOptions(model=MODEL, system_prompt=SYSTEM, tools=[], allowed_tools=[], setting_sources=[],
                                  strict_mcp_config=True, mcp_servers={}, plugins=[], max_turns=3, effort=effort,
                                  cwd=empty, output_format={"type": "json_schema", "schema": SCHEMA})
        res = None
        async for m in query(prompt=prompt, options=opts):
            if isinstance(m, ResultMessage):
                res = m
            elif isinstance(m, AssistantMessage):
                # Texto fora da ferramenta de saída = o modelo escrevendo a lição em prosa (tokens pagos à toa).
                txt = sum(len(b.text) for b in m.content if isinstance(b, TextBlock))
                if txt > 200:
                    log(f"[{sub_id}] turno com {txt} caracteres de texto fora da saída estruturada")
            elif isinstance(m, UserMessage) and isinstance(m.content, list):
                # Resposta da ferramenta de saída: se veio erro, o modelo vai reescrever a lição inteira.
                for b in m.content:
                    if isinstance(b, ToolResultBlock) and b.is_error:
                        log(f"[{sub_id}] saída estruturada recusada: {str(b.content)[:600]}")
        if res is None or res.is_error or res.structured_output is None:
            raise RuntimeError(f"{sub_id}: {getattr(res, 'subtype', None)} {getattr(res, 'errors', None)} {(getattr(res, 'result', '') or '')[:300]}")
        u = res.usage or {}
        usage_tot["input"] += u.get("input_tokens", 0)
        usage_tot["cache_write"] += u.get("cache_creation_input_tokens", 0)
        usage_tot["cache_read"] += u.get("cache_read_input_tokens", 0)
        usage_tot["output"] += u.get("output_tokens", 0)
        usage_tot["thinking"] += (u.get("output_tokens_details") or {}).get("thinking_tokens", 0)
        usage_tot["turns"] += res.num_turns
        usage_tot["custo_nominal"] += res.total_cost_usd or 0
        raw = res.structured_output
        L = inline_visuals(json.loads(json.dumps(raw)))
        errs = validate_lesson(L)
        log(f"[{sub_id}] sdk tentativa {attempt} usage={u} turnos={res.num_turns} custo={res.total_cost_usd} erros={errs}")
        if not errs:
            break
        # Só os visuais com erro voltam ao modelo; o resto da lição fica como está (custa uma fração da reescrita).
        bad = sorted(set(re.findall(r"visual (V\w+)", " ".join(errs))))
        if not bad or attempt == MAX_ATTEMPTS:
            continue
        cur = {v["id"]: v for v in raw.get("visuais", [])}
        fix_prompt = ("Estes visuais de uma lição de guitarra foram reprovados pelo validador automático, que calcula a "
                      "nota real de cada corda/casa. Corrija só o necessário (notas, casas, graus, digitações) mantendo a "
                      "ideia musical e o mesmo id, e devolva apenas estes visuais.\nERROS:\n- " + "\n- ".join(errs[:30]) +
                      "\n\nVISUAIS:\n" + json.dumps([cur[b] for b in bad if b in cur], ensure_ascii=False))
        fix_opts = ClaudeAgentOptions(model=MODEL, system_prompt=SYSTEM, tools=[], allowed_tools=[], setting_sources=[],
                                      strict_mcp_config=True, mcp_servers={}, plugins=[], max_turns=3, effort="medium",
                                      cwd=empty, output_format={"type": "json_schema", "schema": FIX_SCHEMA})
        fres = None
        async for m in query(prompt=fix_prompt, options=fix_opts):
            if isinstance(m, ResultMessage):
                fres = m
        if fres is None or fres.is_error or fres.structured_output is None:
            log(f"[{sub_id}] correção dos visuais falhou: {getattr(fres, 'subtype', None)}")
            continue
        fu = fres.usage or {}
        usage_tot["cache_write"] += fu.get("cache_creation_input_tokens", 0)
        usage_tot["cache_read"] += fu.get("cache_read_input_tokens", 0)
        usage_tot["input"] += fu.get("input_tokens", 0)
        usage_tot["output"] += fu.get("output_tokens", 0)
        usage_tot["turns"] += fres.num_turns
        usage_tot["custo_nominal"] += fres.total_cost_usd or 0
        for v in fres.structured_output.get("visuais", []):
            cur[v["id"]] = v
        raw = {**raw, "visuais": list(cur.values())}
        L = inline_visuals(json.loads(json.dumps(raw)))
        errs = validate_lesson(L)
        log(f"[{sub_id}] correção de {bad}: out={fu.get('output_tokens')} erros={errs}")
        if not errs:
            break
    L = resolve_sources(L, gids)
    L["_meta"] = {"subcategoria": sub_id, "modulo": {"id": c["id"], "nome": c["nome"]}, "nome": s["nome"], "modelo": MODEL,
                  "via": "agent-sdk", "effort": effort, "gerado_em": datetime.now().isoformat(timespec="seconds"),
                  "erros_restantes": errs, "tentativas": attempt, "uso": usage_tot}
    (OUT_APP / f"{sub_id}.json").write_text(json.dumps(L, ensure_ascii=False, indent=1), encoding="utf-8")
    return sub_id, usage_tot, errs


def cmd_proximas(args):
    import asyncio
    OUT_APP.mkdir(parents=True, exist_ok=True)
    pend = [i for i in trail_order() if not (OUT_APP / f"{i}.json").exists()]
    alvo = args.subs or pend[: args.n]
    if not alvo:
        print("Todas as lições já existem.")
        return
    print(f"Prontas: {61 - len(pend)}/61 · gerando agora: {', '.join(alvo)} · {MODEL} via Agent SDK (cota do plano) · effort {args.effort}", flush=True)
    t0 = time.time()

    async def run_all():
        # Em sequência: cada lição vê o que as anteriores da mesma rodada já cobriram (menos repetição).
        out = []
        for s in alvo:
            try:
                out.append(await sdk_generate(s, args.effort))
            except Exception as e:  # uma falha não derruba as outras
                out.append(e)
        return out

    results = asyncio.run(run_all())
    tot = {}
    for r in results:
        if isinstance(r, Exception):
            print(f"ERRO: {r}")
            continue
        sid, u, errs = r
        for k, v in u.items():
            tot[k] = tot.get(k, 0) + v
        print(f"{sid}: entrada {u['input'] + u['cache_write'] + u['cache_read']:,} tokens (cache: grava {u['cache_write']:,} · lê {u['cache_read']:,}) "
              f"· saída {u['output']:,} (raciocínio {u['thinking']:,}) · {u['turns']} turnos · US$ {u['custo_nominal']:.2f} nominal"
              + (f" · {len(errs)} ERROS RESTANTES" if errs else " · teoria ok"), flush=True)
    ids = write_registry()
    print(f"\nTotal: saída {tot.get('output', 0):,} tokens · US$ {tot.get('custo_nominal', 0):.2f} nominal · {time.time() - t0:.0f}s")
    print(f"Registro atualizado: {len(ids)} lições no app ({REGISTRY.relative_to(ROOT)}). Faltam {61 - len(ids)}.")


def cmd_validar(args):
    for p in args.arquivos:
        errs = validate_lesson(json.loads(Path(p).read_text(encoding="utf-8")))
        print(p, "ok" if not errs else f"{len(errs)} erros")
        for e in errs:
            print("  ", e)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("piloto")
    p.add_argument("--subs", nargs="+", required=True)
    p.add_argument("--effort", default="high")
    px = sub.add_parser("proximas")
    px.add_argument("--n", type=int, default=3)
    px.add_argument("--subs", nargs="+", help="ids específicos em vez das próximas da trilha")
    px.add_argument("--effort", default="high")
    v = sub.add_parser("validar")
    v.add_argument("arquivos", nargs="+")
    args = ap.parse_args()
    {"piloto": cmd_piloto, "validar": cmd_validar, "proximas": cmd_proximas}[args.cmd](args)


if __name__ == "__main__":
    main()
