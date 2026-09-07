"""Local dev server for the Glass Terminal dashboard.

Serves the static bundle AND proxies Yahoo Finance requests so the live feed
works during development. The browser cannot call Yahoo directly (no CORS
header) and the three public CORS proxies the bundle ships with are all dead
as of Sep 2026 -- corsproxy.io now demands a paid API key, allorigins returns
520 and codetabs 522. Python has no CORS restriction, so we forward the call
here and hand the JSON back with a permissive header.

Usage:  py serve.py [port]        (default 3000)
"""
import os, sys, json, http.server, socketserver, urllib.parse, urllib.request, urllib.error

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3000

# Only these hosts may be proxied. Without an allowlist this endpoint would be
# an open proxy that any page in the browser could aim anywhere.
ALLOWED_HOSTS = {
    # price + technicals feed
    'query1.finance.yahoo.com',
    'query2.finance.yahoo.com',
    # news feeds (RSS/XML, used by the News tab)
    'news.google.com',
    'feeds.finance.yahoo.com',
}

# Yahoo answers 429 to a request with no browser User-Agent.
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0 Safari/537.36')


class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (ConnectionAbortedError, BrokenPipeError):
            pass  # browser navigated away mid-response

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/proxy':
            return self.handle_proxy(parsed)
        try:
            return super().do_GET()
        except (ConnectionAbortedError, BrokenPipeError):
            # Chrome aborts the favicon fetch routinely; don't dump a traceback.
            pass

    def handle_proxy(self, parsed):
        qs = urllib.parse.parse_qs(parsed.query)
        target = (qs.get('url') or [''])[0]
        if not target:
            return self._send_json(400, {'error': 'missing ?url='})

        host = urllib.parse.urlparse(target).hostname or ''
        if host not in ALLOWED_HOSTS:
            return self._send_json(403, {'error': f'host not allowed: {host}'})

        req = urllib.request.Request(target, headers={
            'User-Agent': UA,
            'Accept': 'application/json,text/plain,*/*',
        })
        try:
            with urllib.request.urlopen(req, timeout=12) as r:
                raw = r.read()
                # Pass the upstream type through -- the news feeds are RSS/XML,
                # and labelling them JSON breaks DOMParser on the client.
                ctype = r.headers.get('Content-Type') or 'application/json'
        except urllib.error.HTTPError as e:
            return self._send_json(e.code, {'error': f'upstream {e.code}'})
        except Exception as e:
            return self._send_json(502, {'error': f'{type(e).__name__}: {e}'})

        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        try:
            self.wfile.write(raw)
        except (ConnectionAbortedError, BrokenPipeError):
            pass

    def log_message(self, fmt, *args):
        # Keep the proxy chatter readable; skip the favicon 404 noise.
        if '/favicon.ico' in (args[0] if args else ''):
            return
        super().log_message(fmt, *args)


class Server(socketserver.ThreadingTCPServer):
    # Threaded: a blocking proxy call must not stall the static file serving.
    daemon_threads = True
    allow_reuse_address = True


with Server(('', PORT), H) as httpd:
    print(f'serving cwd={os.getcwd()} on port {PORT}', flush=True)
    print(f'  static  -> http://localhost:{PORT}/index.html', flush=True)
    print(f'  proxy   -> http://localhost:{PORT}/api/proxy?url=<yahoo url>', flush=True)
    httpd.serve_forever()
