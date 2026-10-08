"""Converte um dataset do actor johnvc/YoutubeTranscripts (Apify) em um Markdown por vídeo.

Uso: python -I solos/scripts/apify_to_md.py <dataset.json> <pasta_saida> [origem]
O JSON pode ser a lista de itens ou o objeto {"items": [...]} devolvido pelo MCP.
"""
import json
import re
import sys
from pathlib import Path

PARAGRAPH_SECONDS = 30


def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    text = re.sub(r"[\s_-]+", "-", text).strip("-")
    return text[:70].strip("-")


def mmss(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60:02d}:{s % 60:02d}"


def paragraphs(snippets):
    """Agrupa os trechos de legenda em parágrafos de ~30s, com o timestamp do início."""
    out, buf, start = [], [], None
    for snip in snippets:
        text = snip["text"].replace("\n", " ").strip()
        if not text:
            continue
        if start is None:
            start = snip["start"]
        buf.append(text)
        if snip["start"] - start >= PARAGRAPH_SECONDS:
            out.append((start, " ".join(buf)))
            buf, start = [], None
    if buf:
        out.append((start, " ".join(buf)))
    return out


def yaml_str(value) -> str:
    return json.dumps("" if value is None else value, ensure_ascii=False)


def main():
    src, dest = Path(sys.argv[1]), Path(sys.argv[2])
    origem = sys.argv[3] if len(sys.argv) > 3 else "lista do usuário"
    data = json.loads(src.read_text(encoding="utf-8"))
    items = data["items"] if isinstance(data, dict) else data
    dest.mkdir(parents=True, exist_ok=True)
    written = 0
    for it in items:
        if not it.get("success") or not it.get("timestamped"):
            print(f"pulado {it.get('video_id')}: {it.get('error_message', 'sem transcript')}")
            continue
        vid = it["video_id"]
        name = f"{vid}--{slugify(it.get('title') or vid)}.md"
        lines = [
            "---",
            f"video_id: {vid}",
            f"title: {yaml_str(it.get('title'))}",
            f"channel: {yaml_str(it.get('channel_name'))}",
            f"channel_url: {yaml_str(it.get('channel_url'))}",
            f"url: https://www.youtube.com/watch?v={vid}",
            f"duration: {yaml_str(it.get('duration_human'))}",
            f"views: {it.get('view_count') or 0}",
            f"language: {it.get('language_code')}",
            f"auto_generated_captions: {str(bool(it.get('is_generated'))).lower()}",
            f"source: {yaml_str(origem)}",
            "---",
            "",
            f"# {it.get('title')}",
            "",
            f"**Canal:** {it.get('channel_name')} · **Duração:** {it.get('duration_human')} · "
            f"**Link:** https://www.youtube.com/watch?v={vid}",
            "",
        ]
        desc = (it.get("description") or "").strip()
        if desc:
            lines += ["## Descrição do vídeo", "", desc, ""]
        lines += ["## Transcript", ""]
        for start, text in paragraphs(it["timestamped"]):
            lines += [f"**[{mmss(start)}]** {text}", ""]
        (dest / name).write_text("\n".join(lines), encoding="utf-8")
        written += 1
    print(f"{written} arquivos escritos em {dest}")


if __name__ == "__main__":
    main()
