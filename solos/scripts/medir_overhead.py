"""Mede quantos tokens o Agent SDK põe em cada chamada além do nosso prompt, para cada combinação de opções.

Uso: python solos/scripts/medir_overhead.py [modelo]     (padrão: claude-haiku-5-5, o mais barato)
Cada variante faz UMA chamada mínima ("Responda apenas: OK"); o que aparecer de entrada é sobrecarga.
"""
import asyncio
import sys
import tempfile
from pathlib import Path

from claude_agent_sdk import ClaudeAgentOptions, ResultMessage, query

MODEL = sys.argv[1] if len(sys.argv) > 1 else "claude-haiku-5-5"
EMPTY = Path(tempfile.mkdtemp(prefix="sdk-vazio-"))
REPO = Path(__file__).resolve().parents[2] / "solos" / "processed"
SCHEMA = {"type": "object", "additionalProperties": False, "required": ["r"], "properties": {"r": {"type": "string"}}}

BASE = dict(model=MODEL, system_prompt="Você é um assistente.", tools=[], allowed_tools=[], max_turns=2)
VARIANTES = {
    "A. como estava (setting_sources=[], cwd no repo)": dict(setting_sources=[], cwd=str(REPO)),
    "B. + strict_mcp_config": dict(setting_sources=[], cwd=str(REPO), strict_mcp_config=True, mcp_servers={}),
    "C. + pasta vazia fora do repo": dict(setting_sources=[], cwd=str(EMPTY), strict_mcp_config=True, mcp_servers={}),
    "D. C + plugins=[] e skills=[] explícitos": dict(setting_sources=[], cwd=str(EMPTY), strict_mcp_config=True,
                                                     mcp_servers={}, plugins=[], skills=[]),
    "E. D + saída estruturada (JSON schema)": dict(setting_sources=[], cwd=str(EMPTY), strict_mcp_config=True,
                                                   mcp_servers={}, plugins=[], skills=[],
                                                   output_format={"type": "json_schema", "schema": SCHEMA}),
}


async def measure(name, extra):
    res = None
    async for m in query(prompt="Responda apenas: OK", options=ClaudeAgentOptions(**BASE, **extra)):
        if isinstance(m, ResultMessage):
            res = m
    u = res.usage or {}
    total_in = u.get("input_tokens", 0) + u.get("cache_creation_input_tokens", 0) + u.get("cache_read_input_tokens", 0)
    print(f"{name:<48} entrada {total_in:>7,} tokens (novo no cache {u.get('cache_creation_input_tokens', 0):>7,} · "
          f"lido do cache {u.get('cache_read_input_tokens', 0):>7,}) · saída {u.get('output_tokens', 0):>4} · "
          f"turnos {res.num_turns} · US$ {res.total_cost_usd or 0:.4f}", flush=True)
    return res.total_cost_usd or 0


async def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print(f"Modelo {MODEL}\n")
    total = 0.0
    for name, extra in VARIANTES.items():
        total += await measure(name, extra)
    print(f"\nTotal gasto na medição: US$ {total:.4f} (nominal)")


asyncio.run(main())
