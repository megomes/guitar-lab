# solos/ — base de conhecimento de solo e improvisação

Material bruto (RAW) e processado para a futura aba de **tutoriais, exercícios e dicas de solo e improvisação** do guitar-lab.

## Estrutura

```
solos/
├── raw/
│   ├── transcripts/      um .md por vídeo do YouTube (frontmatter + descrição + transcript com timestamps)
│   │   ├── _INDEX.md           tabela de todos os vídeos (título, canal, duração, idioma, origem)
│   │   └── _sem_transcript.md  vídeos sem legenda disponível no YouTube
│   ├── documentos/       um .md por artigo/PDF (frontmatter + texto extraído)
│   │   ├── _INDEX.md     tabela por tema
│   │   └── _fontes.tsv   lista de URLs (url, tema, idioma) usada pelo coletor
│   ├── apify/            JSON bruto dos datasets do actor johnvc/YoutubeTranscripts
│   └── pesquisa/         candidatos encontrados na busca do YouTube (base da curadoria)
├── processed/            (próxima etapa) conteúdo sintetizado para a aba
└── scripts/
    ├── apify_to_md.py    dataset do Apify → .md por vídeo
    ├── yt_search.py      busca no YouTube → JSON de candidatos
    ├── fetch_docs.py     _fontes.tsv → .md por documento (trafilatura / PyMuPDF)
    └── build_index.py    regenera os _INDEX.md
```

## Origem dos vídeos

O campo `source` no frontmatter de cada transcript diz de onde ele veio:

- `lista do usuário`: a primeira lista enviada, incluindo a playlist *Improvisation Level 1* da Your Guitar Academy.
- `lista do usuário (2ª leva)`: a segunda lista, incluindo a playlist *The Only Videos You Need To Solo and Play Creatively*.
- `pesquisa do Claude (YouTube)`: vídeos que eu curei a partir de cerca de 40 buscas em EN e PT, com filtro por duração e visualizações. Cobrem fundamentos, fraseado, notas-alvo e mudança de acordes, pentatônica e braço, blues, bend e vibrato, modos, jazz, ouvido e transcrição, e rotina de estudo.

## Observações

- A maioria das legendas é **gerada automaticamente**. O texto não tem pontuação e às vezes erra nomes de notas e termos (por exemplo, "beckham" no lugar de "backing"). O campo `auto_generated_captions` indica isso.
- Os transcripts estão no idioma original do vídeo (`language: en` ou `pt`).
- Para rodar os scripts de novo, execute a partir da raiz do projeto, por exemplo `python -I solos/scripts/build_index.py`.
