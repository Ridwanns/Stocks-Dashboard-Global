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

// ── Memo requests ───────────────────────────────────────────────────
// The form on the site posts an address here. This Worker holds the GitHub
// token and triggers the workflow, which renders the PDF and sends it from
// the Gmail account already configured. The token stays server-side: putting
// it in the page's JavaScript would let anyone read it and run workflows in
// the repository.
const REPO = 'Ridwanns/Stocks-Dashboard-Global';
const DISPATCH_EVENT = 'send-memo';

// A public form that mails a document to any address it is given is an open
// relay if left unguarded — someone can point it at a stranger repeatedly,
// and it is your Gmail account and your Actions minutes doing the work. These
// limits are per client IP.
const COOLDOWN_SECONDS = 600;   // one request per address-giver every 10 min
const DAILY_LIMIT = 5;

// Deliberately conservative: no display names, no quoted local parts, no
// addresses long enough to be a payload.
const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;

async function rateLimited(ip) {
  // Cache API rather than KV so the Worker needs no extra binding to deploy.
  // It is per-datacenter and therefore best-effort, not a hard guarantee —
  // enough to stop casual abuse, not a determined distributed attacker.
  const cache = caches.default;
  const key = (suffix) => new Request(`https://ratelimit.invalid/${encodeURIComponent(ip)}/${suffix}`);

  const recent = await cache.match(key('recent'));
  if (recent) return 'cooldown';

  let count = 0;
  const dayHit = await cache.match(key('day'));
  if (dayHit) count = parseInt(await dayHit.text(), 10) || 0;
  if (count >= DAILY_LIMIT) return 'daily';

  await cache.put(key('recent'), new Response('1', {
    headers: { 'Cache-Control': `max-age=${COOLDOWN_SECONDS}` },
  }));
  await cache.put(key('day'), new Response(String(count + 1), {
    headers: { 'Cache-Control': 'max-age=86400' },
  }));
  return null;
}

async function handleMemo(request, env, origin) {
  if (!origin) return jsonError('origin not allowed', 403, origin);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('expected JSON', 400, origin);
  }

  const email = String(body && body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return jsonError('that does not look like an email address', 400, origin);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const limit = await rateLimited(ip);
  if (limit === 'cooldown') {
    return jsonError('one memo per 10 minutes — try again shortly', 429, origin);
  }
  if (limit === 'daily') {
    return jsonError('daily limit reached', 429, origin);
  }

  if (!env.GITHUB_TOKEN) return jsonError('worker is missing GITHUB_TOKEN', 500, origin);

  const gh = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'chip-desk-memo-worker',
    },
    body: JSON.stringify({
      event_type: DISPATCH_EVENT,
      client_payload: { email },
    }),
  });

  if (gh.status !== 204) {
    const detail = (await gh.text()).slice(0, 200);
    return jsonError(`GitHub refused the trigger (${gh.status}) ${detail}`, 502, origin);
  }

  const headers = corsHeaders(origin);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify({
    ok: true,
    message: 'On its way — the memo takes a minute or two to build.',
  }), { status: 202, headers });
}

export default {
  async fetch(request, env) {
    const origin = allowOrigin(request.headers.get('Origin'));

    if (request.method === 'OPTIONS') {
      const h = corsHeaders(origin);
      h.set('Access-Control-Allow-Headers', 'Content-Type');
      return new Response(null, { status: 204, headers: h });
    }

    if (new URL(request.url).pathname === '/memo') {
      if (request.method !== 'POST') return jsonError('POST only', 405, origin);
      return handleMemo(request, env, origin);
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
