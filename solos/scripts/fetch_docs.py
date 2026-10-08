"""Baixa artigos/PDFs e salva cada um como Markdown com frontmatter.

Uso: python -I solos/scripts/fetch_docs.py <lista.tsv> <pasta_saida>
Cada linha do TSV: url<TAB>tema<TAB>idioma   (linhas com # são ignoradas)
Arquivos já existentes são pulados, então dá para rodar de novo só com o que falhou.
"""
import hashlib
import io
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests
import trafilatura

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
}
MIN_CHARS = 600


def slug(url: str) -> str:
    p = urlparse(url)
    host = p.netloc.replace("www.", "").split(".")[0]
    tail = re.sub(r"[^\w-]+", "-", (p.path.strip("/").split("/")[-1] or p.query or "index").lower())
    tail = re.sub(r"\.(html?|aspx|php|pdf)$", "", tail).strip("-")[:60] or "index"
    return f"{host}--{tail}-{hashlib.md5(url.encode()).hexdigest()[:6]}"


def pdf_to_md(data: bytes) -> tuple[str, str]:
    import pymupdf

    doc = pymupdf.open(stream=io.BytesIO(data), filetype="pdf")
    pages = [f"<!-- página {i + 1} -->\n\n{page.get_text().strip()}" for i, page in enumerate(doc)]
    return (doc.metadata or {}).get("title") or "", "\n\n".join(pages)


def html_to_md(html: str, url: str) -> tuple[str, str, str, str]:
    md = trafilatura.extract(
        html, url=url, output_format="markdown", include_links=False, include_tables=True,
        include_formatting=True, favor_recall=True,
    ) or ""
    meta = trafilatura.extract_metadata(html, default_url=url)
    title = (meta.title if meta else "") or ""
    author = (meta.author if meta else "") or ""
    date = (meta.date if meta else "") or ""
    return title, author, date, md


def q(s: str) -> str:
    return '"' + (s or "").replace('"', "'").strip() + '"'


def main():
    lista, dest = Path(sys.argv[1]), Path(sys.argv[2])
    dest.mkdir(parents=True, exist_ok=True)
    ok, fail = 0, []
    for line in lista.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        url, tema, lang = (line.split("\t") + ["", ""])[:3]
        out = dest / f"{slug(url)}.md"
        if out.exists():
            continue
        try:
            r = requests.get(url, headers=HEADERS, timeout=40)
            r.raise_for_status()
            author = date = ""
            if url.lower().endswith(".pdf") or "pdf" in r.headers.get("content-type", ""):
                title, body = pdf_to_md(r.content)
                kind = "pdf"
            else:
                title, author, date, body = html_to_md(r.text, url)
                kind = "html"
            if len(body) < MIN_CHARS:
                raise ValueError(f"conteúdo curto demais ({len(body)} chars)")
            front = [
                "---", f"title: {q(title)}", f"url: {url}", f"site: {urlparse(url).netloc}",
                f"author: {q(author)}", f"date: {q(date)}", f"tema: {tema}", f"idioma: {lang}",
                f"tipo: {kind}", f"coletado_em: {time.strftime('%Y-%m-%d')}", "---", "",
                f"# {title or url}", "", f"Fonte: {url}", "",
            ]
            out.write_text("\n".join(front) + body.strip() + "\n", encoding="utf-8")
            ok += 1
            print(f"ok   {len(body):>7}  {url}")
        except Exception as e:
            fail.append(url)
            print(f"FAIL {url}: {e}")
    print(f"\n{ok} salvos, {len(fail)} falharam")


if __name__ == "__main__":
    main()
