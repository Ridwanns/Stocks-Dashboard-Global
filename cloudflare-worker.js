// ════════════════════════════════════════════════════════════════════
// Glass Terminal — CORS proxy (Cloudflare Worker)
//
// GitHub Pages serves static files only, so serve.py's /api/proxy cannot
// run there. Yahoo Finance sends no Access-Control-Allow-Origin header, so
// the browser cannot call it directly either, and the three public CORS
// proxies the bundle falls back to are all dead (401 / 520 / 522 as of
// Sep 2026). This Worker does the same job as serve.py's endpoint, on
// Cloudflare's free tier, so the deployed dashboard gets live prices.
//
// ── Deploy ──────────────────────────────────────────────────────────
//   1. dash.cloudflare.com → Workers & Pages → Create → Worker
//   2. Name it (e.g. chip-desk-proxy), Deploy, then "Edit code"
//   3. Replace the sample with this file, Deploy again
//   4. Copy the URL it gives you (https://<name>.<subdomain>.workers.dev)
//   5. Put it in src/9536740f-…js as LIVE.workerProxy, then: py rebundle.py
//
// Free tier is 100,000 requests/day. The dashboard polls prices every 30s
// and indices every 45s — roughly 2,900 requests/day per open tab, so the
// quota is comfortable. Responses are cached for 20s at the edge, which
// also keeps Yahoo from rate-limiting a page that several people open.
// ════════════════════════════════════════════════════════════════════

// Only these upstreams may be fetched. Without this the Worker would be an
// open proxy that anyone could point anywhere, on your quota.
const ALLOWED_HOSTS = new Set([
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'news.google.com',
  'feeds.finance.yahoo.com',
]);

// Only these pages may use the Worker. Add your custom domain here if you
// point one at the dashboard later.
const ALLOWED_ORIGINS = [
  'https://ridwanns.github.io',
];
const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Yahoo answers 429 to a request with no browser User-Agent.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function allowOrigin(origin) {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (LOCALHOST.test(origin)) return origin;
  return null;
}

function corsHeaders(origin) {
  const h = new Headers();
  if (origin) h.set('Access-Control-Allow-Origin', origin);
  h.set('Vary', 'Origin');
  h.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  h.set('Access-Control-Max-Age', '86400');
  return h;
}

function jsonError(message, status, origin) {
  const h = corsHeaders(origin);
  h.set('Content-Type', 'application/json');
  return new Response(JSON.stringify({ error: message }), { status, headers: h });
}

export default {
  async fetch(request) {
    const origin = allowOrigin(request.headers.get('Origin'));

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'GET') {
      return jsonError('method not allowed', 405, origin);
    }

    const target = new URL(request.url).searchParams.get('url');
    if (!target) return jsonError('missing ?url=', 400, origin);

    let upstreamUrl;
    try {
      upstreamUrl = new URL(target);
    } catch {
      return jsonError('malformed url', 400, origin);
    }
    if (upstreamUrl.protocol !== 'https:') {
      return jsonError('https only', 400, origin);
    }
    if (!ALLOWED_HOSTS.has(upstreamUrl.hostname)) {
      return jsonError('host not allowed: ' + upstreamUrl.hostname, 403, origin);
    }

    let upstream;
    try {
      upstream = await fetch(upstreamUrl.toString(), {
        headers: { 'User-Agent': UA, 'Accept': 'application/json,text/plain,*/*' },
        cf: { cacheTtl: 20, cacheEverything: true },
      });
    } catch (e) {
      return jsonError('upstream unreachable: ' + e.message, 502, origin);
    }

    const headers = corsHeaders(origin);
    // Pass the upstream type through — the news feeds are RSS/XML, and
    // labelling them JSON breaks DOMParser on the client.
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
    headers.set('Cache-Control', 'public, max-age=20');

    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
