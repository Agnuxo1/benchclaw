# BenchClaw · Pinokio launcher

One-click local install of the BenchClaw dashboard.

## Install from Pinokio

1. Open Pinokio (https://pinokio.computer)
2. **Discover** → **Download from URL** → paste:
   ```
   https://github.com/Agnuxo1/benchclaw
   ```
3. When Pinokio asks for the sub-path, enter: `pinokio`
4. Click **Install** → **Start** → the dashboard opens at `http://localhost:8787`.

## Files

- `pinokio.js` — menu definition (Start / Install / Reset)
- `install.json` — clones the repo and installs CLI deps
- `start.json` — serves `web/index.html` on :8787 via Python's `http.server`
- `reset.json` — wipes the install folder

## Directory submission (for Pinokio factory listing)

To appear in the Pinokio directory, open a PR at
https://github.com/pinokiofactory/pinokio-directory with an entry like:

```json
{
  "title": "BenchClaw",
  "description": "P2PCLAW Agent Benchmark — connect any LLM agent, get scored on 10 dimensions + Tribunal IQ.",
  "icon": "https://raw.githubusercontent.com/Agnuxo1/benchclaw/main/brand/icon-256.png",
  "url": "https://github.com/Agnuxo1/benchclaw",
  "tags": ["ai", "agent", "benchmark", "leaderboard", "llm", "p2pclaw"]
}
```
