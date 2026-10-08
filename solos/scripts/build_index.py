"""Gera os _INDEX.md de solos/raw/transcripts e solos/raw/documentos a partir do frontmatter.

Uso: python -I solos/scripts/build_index.py   (rodar da raiz do projeto)
"""
import json
import re
from pathlib import Path

RAW = Path("solos/raw")


def frontmatter(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---", text, re.S)
    meta = {}
    for line in (m.group(1) if m else "").splitlines():
        key, _, value = line.partition(": ")
        value = value.strip()
        if value.startswith('"'):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                value = value.strip('"')
        meta[key] = value
    meta["_chars"] = len(text)
    return meta


def cell(s) -> str:
    return str(s or "").replace("|", "/").replace("\n", " ")


def transcripts_index():
    folder = RAW / "transcripts"
    rows = sorted((frontmatter(p) | {"_file": p.name} for p in folder.glob("*.md") if not p.name.startswith(("_INDEX", "_sem_", "_fontes"))),
                  key=lambda m: (m.get("source", ""), m.get("language", ""), m.get("channel", "").lower()))
    total_chars = sum(r["_chars"] for r in rows)
    lines = [
        "# Índice de transcripts", "",
        f"{len(rows)} vídeos com transcript · ~{total_chars // 1000}k caracteres.",
        "Gerado por `solos/scripts/build_index.py`.", "",
        "| Vídeo | Canal | Duração | Idioma | Origem | Arquivo |", "|---|---|---|---|---|---|",
    ]
    for r in rows:
        lines.append(f"| [{cell(r.get('title'))}]({r.get('url')}) | {cell(r.get('channel'))} | {r.get('duration')} | "
                     f"{r.get('language')} | {cell(r.get('source'))} | [{r['_file'][:11]}]({r['_file']}) |")
    skipped = folder / "_sem_transcript.md"
    if skipped.exists():
        lines += ["", "Vídeos sem legenda disponível: ver [_sem_transcript.md](_sem_transcript.md)."]
    (folder / "_INDEX.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"transcripts: {len(rows)}")


def documentos_index():
    folder = RAW / "documentos"
    rows = sorted((frontmatter(p) | {"_file": p.name} for p in folder.glob("*.md") if not p.name.startswith(("_INDEX", "_sem_", "_fontes"))),
                  key=lambda m: (m.get("tema", ""), m.get("idioma", ""), m.get("site", "")))
    lines = [
        "# Índice de documentos", "",
        f"{len(rows)} documentos. Lista de URLs em [_fontes.tsv](_fontes.tsv). Gerado por `solos/scripts/build_index.py`.", "",
        "| Tema | Título | Site | Idioma | Tipo | Tamanho | Arquivo |", "|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        lines.append(f"| {r.get('tema')} | [{cell(r.get('title')) or r.get('url')}]({r.get('url')}) | {r.get('site')} | "
                     f"{r.get('idioma')} | {r.get('tipo')} | {r['_chars'] // 1000}k | [abrir]({r['_file']}) |")
    (folder / "_INDEX.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"documentos: {len(rows)}")


if __name__ == "__main__":
    transcripts_index()
    documentos_index()
