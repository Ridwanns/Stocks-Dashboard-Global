# Ridwan · Chip Desk — Glass Terminal

Live semiconductor equity dashboard covering **NVDA · AMD · MU · TSM · MRVL**,
plus 10 global indices on the overview globe. Single-page React+Babel
application bundled into one self-contained HTML file, with prices from the
Yahoo Finance v8 chart endpoint.

## Live data

- **Source**: Yahoo Finance v8 chart endpoint. The browser cannot call it
  directly (no CORS header), so every request goes through a proxy.
- **Locally**: `serve.py` exposes `/api/proxy?url=…`, which forwards to Yahoo
  from Python. It sends the `User-Agent` Yahoo requires — without one Yahoo
  answers `429`. Only `query1/query2.finance.yahoo.com` are allowed through, so
  the endpoint can't be used as an open proxy.
- **Deployed**: the bundle falls back to three public CORS proxies
  (corsproxy.io, allorigins.win, codetabs.com). **All three were dead when last
  checked (Sep 2026)** — corsproxy.io returns `401` and now requires a paid API
  key, allorigins `520`, codetabs `522`. Until a working proxy is in place, a
  deployed build shows the seeded static numbers, not live prices. A Netlify
  Function running the same logic as `serve.py` is the fix.
- **Refresh**: prices every 30s, indices every 45s, dispatched as `live-tick` /
  `idx-tick` events to the React tree — no page reload required.
- **Status**: `window.LIVE.feedStatus` is `CONNECTING` → `LIVE`, or `FALLBACK`
  when every proxy failed. `window.LIVE.proxy` names the leg that worked. The
  `LiveDot` component renders this, so the UI never claims "LIVE" over stale
  numbers.

There is **no** Stooq fallback and **no** Finnhub support in the code — earlier
versions of this README described both; neither was ever implemented.

## Local development

```bash
py serve.py 3000
```

Then open <http://localhost:3000/index.html>. Pass a different port as the
first argument if 3000 is taken (`py serve.py 3001`); `.claude/launch.json`
currently uses 3001.

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

Verify the bundle:

```bash
py verify_bundle.py
```

It checks that every payload decodes, that each entry still matches its `src/`
file byte for byte (so a forgotten `rebundle.py` is caught), that the template
and `index.html` are in sync, and that no script the template loads is missing
from the manifest. Exit code is non-zero on failure, so it can gate a deploy.

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
| `src/54bfb3ba-…js` | Shared primitives (Panel, Kicker, LiveDot, Spark, CandleChart) |
| `src/049e714a-…jsx` | Hero / site shell |
| `src/cd7fd865-…js`  | Babel standalone (~3 MB, do not edit) |
| `rebundle.py` | JSX → HTML bundler |
| `extract.py` | Unpacks a bundle back into `src/` |
| `verify_bundle.py` | Integrity + freshness check (non-zero exit on failure) |
| `serve.py` | Local dev server + `/api/proxy` Yahoo forwarder |

## Tech stack

- **React 18** + **Babel standalone** (in-browser JSX compile)
- **Three.js** (lightweight starfield behind hero)
- **JetBrains Mono · Space Grotesk · Instrument Serif** (Google Fonts)
- No build step — everything ships as static assets
