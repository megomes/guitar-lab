"""Busca no YouTube (página pública de resultados) e lista vídeos com canal, views e duração.

Uso: python -I solos/scripts/yt_search.py <saida.json> "query 1" "query 2" ...
"""
import json
import re
import sys
import urllib.parse
import urllib.request

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
}


def initial_data(html: str):
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html, re.S)
    return json.loads(m.group(1)) if m else {}


def walk(node):
    if isinstance(node, dict):
        if "videoRenderer" in node:
            yield node["videoRenderer"]
        for v in node.values():
            yield from walk(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk(v)


def text(obj):
    if not obj:
        return ""
    if "simpleText" in obj:
        return obj["simpleText"]
    return "".join(r.get("text", "") for r in obj.get("runs", []))


def views(s: str) -> int:
    digits = re.sub(r"[^\d]", "", s)
    return int(digits) if digits else 0


def search(query: str):
    url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(query)
    html = urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=30).read().decode("utf-8")
    for vr in walk(initial_data(html)):
        yield {
            "video_id": vr.get("videoId"),
            "title": text(vr.get("title")),
            "channel": text(vr.get("ownerText")),
            "views": views(text(vr.get("viewCountText"))),
            "duration": text(vr.get("lengthText")),
            "published": text(vr.get("publishedTimeText")),
            "query": query,
        }


def main():
    out, queries = sys.argv[1], sys.argv[2:]
    seen, results = set(), []
    for q in queries:
        try:
            for r in search(q):
                if r["video_id"] and r["video_id"] not in seen:
                    seen.add(r["video_id"])
                    results.append(r)
        except Exception as e:  # segue com as outras queries
            print(f"falhou '{q}': {e}", file=sys.stderr)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=1)
    print(f"{len(results)} vídeos únicos de {len(queries)} buscas")


if __name__ == "__main__":
    main()
