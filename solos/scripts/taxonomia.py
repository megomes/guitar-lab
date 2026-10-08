"""Etapa 2: taxonomia. O Opus lê um resumo compacto de todas as fichas e propõe as categorias da aba.

Uso (da raiz do projeto):
  python solos/scripts/taxonomia.py entrada     só monta o arquivo de entrada e mostra o tamanho (grátis)
  python solos/scripts/taxonomia.py rodar       monta a entrada e chama o Opus via Agent SDK (cota do plano)

Saídas em solos/processed/02-taxonomia/:
  _entrada.md       exatamente o que o modelo leu (uma linha por ideia: tipo, nível, título, tags)
  taxonomia.json    proposta estruturada (fonte de verdade para a etapa 3)
  taxonomia.md      a mesma proposta, legível, para revisão
  _log.txt          custo, duração e erros
"""
import asyncio
import json
import sys
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

from claude_agent_sdk import ClaudeAgentOptions, ResultMessage, query

ROOT = Path(__file__).resolve().parents[2]
FICHAS = ROOT / "solos" / "processed" / "01-fichas" / "json"
OUT = ROOT / "solos" / "processed" / "02-taxonomia"
MODEL = "claude-opus-5-5"

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["principios", "categorias", "eixos_transversais", "lacunas", "observacoes"],
    "properties": {
        "principios": {"type": "string",
                       "description": "Como e por que a taxonomia foi organizada assim (5 a 10 frases)."},
        "categorias": {
            "type": "array",
            "items": {
                "type": "object", "additionalProperties": False,
                "required": ["id", "nome", "descricao", "subcategorias"],
                "properties": {
                    "id": {"type": "string", "description": "C01, C02, ..."},
                    "nome": {"type": "string"},
                    "descricao": {"type": "string"},
                    "subcategorias": {
                        "type": "array",
                        "items": {
                            "type": "object", "additionalProperties": False,
                            "required": ["id", "nome", "descricao", "inclui", "nao_inclui", "exemplos",
                                         "estimativa_ideias", "nivel_predominante"],
                            "properties": {
                                "id": {"type": "string", "description": "C01.1, C01.2, ..."},
                                "nome": {"type": "string"},
                                "descricao": {"type": "string"},
                                "inclui": {"type": "string", "description": "Critério objetivo do que entra aqui."},
                                "nao_inclui": {"type": "string",
                                               "description": "O que parece entrar mas vai para outra subcategoria (cite o id)."},
                                "exemplos": {"type": "array", "items": {"type": "string"},
                                             "description": "3 a 6 títulos de ideias reais da entrada que entram aqui."},
                                "estimativa_ideias": {"type": "integer"},
                                "nivel_predominante": {"type": "string",
                                                       "enum": ["iniciante", "intermediario", "avancado", "misto"]},
                            },
                        },
                    },
                },
            },
        },
        "eixos_transversais": {
            "type": "array",
            "description": "Dimensões que NÃO são categorias, mas filtros/tags aplicáveis a qualquer ideia (nível, estilo...).",
            "items": {
                "type": "object", "additionalProperties": False, "required": ["nome", "valores", "descricao"],
                "properties": {"nome": {"type": "string"}, "valores": {"type": "array", "items": {"type": "string"}},
                               "descricao": {"type": "string"}},
            },
        },
        "lacunas": {"type": "array", "items": {"type": "string"},
                    "description": "Assuntos importantes para solo/improvisação pouco cobertos pelo material."},
        "observacoes": {"type": "string", "description": "Sobreposições difíceis, decisões em aberto para o usuário."},
    },
}

SYSTEM_PROMPT = """Você é um professor de guitarra e designer instrucional. Vai organizar uma base de conhecimento sobre
SOLO e IMPROVISAÇÃO na guitarra, extraída de ~300 vídeos e artigos, que vai virar uma aba de um app de estudo
(tutoriais, exercícios e dicas). Escreva em português do Brasil.

Você recebe, para cada fonte, um resumo e a lista das ideias extraídas (tipo, nível, título, tags).
Proponha a TAXONOMIA: categorias e subcategorias onde cada ideia vai morar.

Critérios:
- Organize pelo que o aluno quer APRENDER/MELHORAR (ex.: fraseado, notas-alvo, braço, técnica expressiva),
  não pela fonte nem pelo formato. Tipo (dica/exercício/conceito...) e nível NÃO viram categorias: são eixos
  transversais. Estilo musical (blues, rock, jazz, MPB) também tende a ser eixo, salvo se houver massa crítica.
- Granularidade: 6 a 12 categorias, cada uma com 3 a 8 subcategorias. Cada subcategoria deve ter massa de conteúdo
  (idealmente 20 a 200 ideias) e ser coesa o bastante para virar uma lição ou um módulo.
- Critérios de inclusão objetivos e mutuamente exclusivos sempre que possível; quando houver zona cinzenta,
  diga em "nao_inclui" para onde vai.
- Toda ideia da entrada precisa ter um lugar. Inclua uma subcategoria para mentalidade/rotina de estudo e uma para
  recursos (backing tracks, livros), se houver material.
- Use os exemplos reais da entrada. Estime quantas ideias cabem em cada subcategoria contando pela entrada.
- Ordene categorias e subcategorias numa progressão pedagógica (do fundamento ao avançado)."""


def build_input() -> tuple[str, dict]:
    parts, stats = [], Counter()
    fichas = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(FICHAS.glob("*.json"))]
    for f in sorted(fichas, key=lambda f: (f["fonte"]["tipo"], f["fonte_id"])):
        fo = f["fonte"]
        parts.append(f"## {f['fonte_id']} | {fo['tipo']} | {fo.get('titulo')} | {fo.get('autor') or fo.get('site') or ''} "
                     f"| qualidade {f['qualidade_didatica']['nota']}\n{f['resumo']}")
        for i in f["ideias"]:
            parts.append(f"- [{i['tipo']}/{i['nivel'][:5]}] {i['titulo']} ({', '.join(i['tags'][:6])})")
            stats[i["tipo"]] += 1
        stats["_fontes"] += 1
    return "\n".join(parts), stats


def render_md(t: dict, meta: dict) -> str:
    lines = ["# Taxonomia proposta — solo e improvisação", "",
             f"_Gerada por {meta['modelo']} em {meta['gerado_em']} a partir de {meta['fontes']} fontes e "
             f"{meta['ideias']} ideias. Custo nominal US$ {meta['custo_usd']:.2f}._", "",
             "## Princípios", "", t["principios"], ""]
    for c in t["categorias"]:
        total = sum(s["estimativa_ideias"] for s in c["subcategorias"])
        lines += [f"## {c['id']} · {c['nome']} (~{total} ideias)", "", c["descricao"], ""]
        for s in c["subcategorias"]:
            lines += [f"### {s['id']} · {s['nome']} — ~{s['estimativa_ideias']} ideias · {s['nivel_predominante']}", "",
                      s["descricao"], "", f"- **Inclui:** {s['inclui']}", f"- **Não inclui:** {s['nao_inclui']}",
                      "- **Exemplos:** " + "; ".join(s["exemplos"]), ""]
    lines += ["## Eixos transversais (filtros, não categorias)", ""]
    for e in t["eixos_transversais"]:
        lines.append(f"- **{e['nome']}**: {', '.join(e['valores'])} — {e['descricao']}")
    lines += ["", "## Lacunas no material", ""] + [f"- {x}" for x in t["lacunas"]]
    lines += ["", "## Observações e decisões em aberto", "", t["observacoes"], ""]
    return "\n".join(lines)


def log(msg: str):
    with (OUT / "_log.txt").open("a", encoding="utf-8") as fh:
        fh.write(f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}\n")


async def run():
    text, stats = build_input()
    (OUT / "_entrada.md").write_text(text, encoding="utf-8")
    n_ideias = sum(v for k, v in stats.items() if not k.startswith("_"))
    print(f"Entrada: {stats['_fontes']} fontes, {n_ideias} ideias, {len(text):,} caracteres (~{len(text) // 3.5 / 1000:.0f}k tokens)")
    print(f"Chamando {MODEL} via Agent SDK... (alguns minutos)", flush=True)
    log(f"início: {len(text)} chars")
    t0 = time.time()
    options = ClaudeAgentOptions(model=MODEL, system_prompt=SYSTEM_PROMPT, tools=[], allowed_tools=[],
                                 setting_sources=[], strict_mcp_config=True, mcp_servers={}, max_turns=4, effort="high", cwd=str(OUT),
                                 output_format={"type": "json_schema", "schema": SCHEMA})
    result = None
    async for message in query(prompt="ENTRADA:\n\n" + text + "\n\nProponha a taxonomia.", options=options):
        if isinstance(message, ResultMessage):
            result = message
    if result is None or result.is_error or result.structured_output is None:
        detail = f"{getattr(result, 'subtype', None)} {getattr(result, 'errors', None)} {(getattr(result, 'result', '') or '')[:500]}"
        log(f"ERRO: {detail}")
        sys.exit(f"Falhou: {detail}")
    t = result.structured_output
    meta = {"modelo": MODEL, "gerado_em": datetime.now().isoformat(timespec="seconds"), "fontes": stats["_fontes"],
            "ideias": n_ideias, "custo_usd": result.total_cost_usd or 0.0, "segundos": round(time.time() - t0)}
    (OUT / "taxonomia.json").write_text(json.dumps({**t, "_meta": meta}, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "taxonomia.md").write_text(render_md(t, meta), encoding="utf-8")
    log(f"ok: {meta}")
    n_sub = sum(len(c["subcategorias"]) for c in t["categorias"])
    est = sum(s["estimativa_ideias"] for c in t["categorias"] for s in c["subcategorias"])
    print(f"Pronto em {meta['segundos']}s: {len(t['categorias'])} categorias, {n_sub} subcategorias "
          f"(estimativa somada: {est} de {n_ideias} ideias). Custo nominal US$ {meta['custo_usd']:.2f}.")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    OUT.mkdir(parents=True, exist_ok=True)
    cmd = sys.argv[1] if len(sys.argv) > 1 else "entrada"
    if cmd == "rodar":
        asyncio.run(run())
    else:
        text, stats = build_input()
        (OUT / "_entrada.md").write_text(text, encoding="utf-8")
        print(f"{stats['_fontes']} fontes · {len(text):,} chars (~{len(text) / 3.5 / 1000:.0f}k tokens) · {dict(stats)}")


if __name__ == "__main__":
    main()
