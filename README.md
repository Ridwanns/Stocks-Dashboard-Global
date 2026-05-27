# Ridwan · Chip Desk — Glass Terminal

Live semiconductor equity dashboard covering **NVDA · AMD · MU · TSM**.
Single-page React+Babel application bundled into one self-contained HTML file
with live price feed via Yahoo Finance (CORS-proxied) and Stooq fallback.

## Live data

- **Primary**: Yahoo Finance v8 chart endpoint, rotated through 3 CORS proxies
  (corsproxy.io, allorigins.win, codetabs.com)
- **Fallback**: Stooq CSV (no API key, ~15-min delay)
- **Refresh**: every 30 seconds, dispatched as `live-tick` events to the React
  tree — no page reload required
- **Optional realtime**: drop a Finnhub free-tier key in `90c7a459-…js` for
  sub-second quotes

## Local development

```bash
# From this folder
py serve.py 3000
# → http://localhost:3000/Glass%20Terminal%20-%20Standalone.html
```

## Editing the dashboard

Source JSX lives in `src/`. The HTML is a bundle of those files (base64+gzip
in a `<script type="__bundler/manifest">` tag).

After editing JSX:

```bash
py rebundle.py
```

This rewrites `Glass Terminal - Standalone.html` from the current `src/` tree
and updates the template section from `src/_template.html`. A one-time backup
is created at `Glass Terminal - Standalone.backup.html`.

Verify the bundle is well-formed:

```bash
py verify_bundle.py
```

## Deploy

### Netlify (drag-and-drop or Git)

The `netlify.toml` here is preconfigured:

- Root redirect `/` → `/Glass Terminal - Standalone.html`
- No-cache headers on the main HTML (so refresh always pulls latest)
- Permissive CSP so the live data fetch + Google Fonts + TradingView widgets
  all work

**Drag-and-drop**: zip this folder, drop on Netlify dashboard — done.

**Git deploy**: see below.

### GitHub

```bash
# from this folder
git init
git add .
git commit -m "Initial Glass Terminal dashboard"
git branch -M main
git remote add origin https://github.com/<your-user>/chip-desk.git
git push -u origin main
```

Then on Netlify: **Add new site → Import from Git → pick the repo**.
No build command needed (publish dir = `.`).

## File map

| File | Purpose |
| --- | --- |
| `Glass Terminal - Standalone.html` | Production bundle (deploy this) |
| `Glass Terminal - Standalone.backup.html` | One-shot backup (gitignored) |
| `src/_template.html` | HTML shell that the bundle wraps |
| `src/fd4ca74e-…jsx` | Main Dashboard + tabs (Overview, Chart, Technical, Financials) |
| `src/909f2151-…jsx` | TabQuant (DCF, Monte Carlo, factor model) |
| `src/90717615-…jsx` | TabDeepDive + supporting components |
| `src/9536740f-…js` | Per-ticker data (segments, quarterly, technicals, scenarios) |
| `src/90c7a459-…js` | Live feed + CORS proxy rotation |
| `src/54bfb3ba-…js` | Shared primitives (Panel, Kicker, Spark, CandleChart) |
| `src/049e714a-…jsx` | Hero / site shell |
| `src/cd7fd865-…js`  | Babel standalone (~3 MB, do not edit) |
| `rebundle.py` | JSX → HTML bundler |
| `extract.py` / `verify_bundle.py` | Bundle round-trip utilities |
| `serve.py` | Local dev server (port 3000) |

## Tech stack

- **React 18** + **Babel standalone** (in-browser JSX compile)
- **Three.js** (lightweight starfield behind hero)
- **JetBrains Mono · Space Grotesk · Instrument Serif** (Google Fonts)
- No build step — everything ships as static assets
