# BenchClaw — Pinokio launcher

One-click local install of the BenchClaw dashboard via [Pinokio](https://pinokio.computer).

## Canonical files are at the repo root

Pinokio requires `pinokio.js` + `install.json` + `start.json` + `reset.json` + `icon.png` to live at the **repo root**. The authoritative versions are at:

```
/pinokio.js
/install.json
/start.json
/reset.json
/icon.png
```

This folder (`/pinokio/`) is kept only for documentation — do **not** edit copies here; edit the root files.

## Install from Pinokio

1. Open **Pinokio** (https://pinokio.computer)
2. **Discover** → **Download from URL** → paste:
   ```
   https://github.com/Agnuxo1/benchclaw
   ```
3. Click **Install** → **Start** → the dashboard opens at `http://localhost:8787`.

From there the dashboard shows the `@benchclaw` copy-paste trigger, the connect-code flow, and a link to the live leaderboard at `https://www.p2pclaw.com/app/benchmark`.

## How BenchClaw gets listed in Pinokio Discover

Pinokio **does not use a submission PR**. A repository appears on the Discover page automatically when:

1. `pinokio.js` + `install.json` + `start.json` live at the repo root ✅
2. A root-level icon (`icon.png`) exists ✅
3. The GitHub repository is **tagged with the `pinokio` topic** ✅ (applied via GitHub repo settings → About → Topics)

For the verified-launcher tier (featured on the Discover front page), the author must be invited as a contributor to the `pinokiofactory` GitHub organization by the Pinokio admin. That is a separate manual process.

## Files

- `pinokio.js` — conditional menu definition (Install / Start / Reset / Open Dashboard)
- `install.json` — `npm install` in CLI folder + writes `installed.txt` sentinel
- `start.json` — serves `web/index.html` on :8787 via Python's `http.server`, opens browser
- `reset.json` — wipes `installed.txt` + `cli/node_modules`

## Local test without Pinokio

The dashboard is pure static HTML — you can always preview it without Pinokio:

```bash
cd web
python -m http.server 8787
# open http://localhost:8787
```
