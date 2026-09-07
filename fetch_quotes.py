"""Fetch a market snapshot from Yahoo Finance and write data/quotes.json.

Run by .github/workflows/refresh-quotes.yml on a schedule. GitHub Pages is
static and every public CORS proxy the bundle falls back to is dead, so the
deployed dashboard has no way to reach Yahoo from the browser. This runs on
GitHub's servers instead -- no CORS involved -- and commits a small JSON file
that the page then loads from its own origin.

The payload deliberately mirrors what parseChart() produces in
src/90c7a459-...js, so the client can hand it straight to updateTicker() and
get real sparklines, candles and technicals rather than a price-only patch.

Usage:  py fetch_quotes.py
"""
import json, os, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'data', 'quotes.json')

SYMBOLS = ['NVDA', 'AMD', 'MU', 'TSM', 'MRVL']

# id -> Yahoo symbol. Must match INDICES in src/90c7a459-...js.
INDICES = {
    'N225': '^N225', 'KS11': '^KS11', 'SSEC': '000001.SS', 'HSI': '^HSI',
    'JKSE': '^JKSE', 'FTSE': '^FTSE', 'GDAXI': '^GDAXI', 'GSPC': '^GSPC',
    'IXIC': '^IXIC', 'DJI': '^DJI',
}

# Yahoo answers 429 to a request with no browser User-Agent.
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0 Safari/537.36')

MAX_CANDLES = 130   # ~6 months of daily bars; enough for RSI/MACD/EMA50/Bollinger
CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range={rng}&interval=1d&includePrePost=false'


def get(url, tries=3):
    for attempt in range(tries):
        req = urllib.request.Request(url, headers={
            'User-Agent': UA, 'Accept': 'application/json,text/plain,*/*'})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            # 429 is Yahoo rate-limiting; back off and try again.
            if e.code == 429 and attempt < tries - 1:
                time.sleep(3 * (attempt + 1))
                continue
            print(f'  HTTP {e.code} for {url.split("/")[-1][:40]}')
            return None
        except Exception as e:
            if attempt < tries - 1:
                time.sleep(2)
                continue
            print(f'  {type(e).__name__}: {e}')
            return None
    return None


def parse_chart(payload):
    """Mirror of parseChart() in the client, including its previousClose rule."""
    try:
        result = payload['chart']['result'][0]
    except (TypeError, KeyError, IndexError):
        return None
    meta = result.get('meta') or {}
    ts = result.get('timestamp') or []
    q = ((result.get('indicators') or {}).get('quote') or [{}])[0]

    candles = []
    for i in range(len(ts)):
        o = (q.get('open') or [None] * len(ts))[i]
        h = (q.get('high') or [None] * len(ts))[i]
        l = (q.get('low') or [None] * len(ts))[i]
        c = (q.get('close') or [None] * len(ts))[i]
        v = (q.get('volume') or [None] * len(ts))[i]
        if o and c and o > 0 and c > 0:
            candles.append({
                't': ts[i] * 1000,
                'o': round(o, 2), 'h': round(h or o, 2),
                'l': round(l or o, 2), 'c': round(c, 2),
                'v': int(v or 0), 'up': c >= o,
            })
    candles = candles[-MAX_CANDLES:]

    # NEVER chartPreviousClose first -- that is the close from the start of the
    # range (6 months ago), which would make every change figure nonsense.
    prev = meta.get('previousClose')
    if not prev and len(candles) >= 2:
        prev = candles[-2]['c']
    if not prev:
        prev = meta.get('chartPreviousClose')

    price = meta.get('regularMarketPrice')
    if not price:
        return None

    return {
        'price': round(price, 2),
        'prevClose': round(prev, 2) if prev else None,
        'dayOpen': round(meta.get('regularMarketOpen') or (candles[-1]['o'] if candles else 0), 2),
        'dayHigh': round(meta.get('regularMarketDayHigh') or 0, 2),
        'dayLow': round(meta.get('regularMarketDayLow') or 0, 2),
        'volume': int(meta.get('regularMarketVolume') or 0),
        'candles': candles,
    }


def main():
    snapshot = {
        'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'source': 'Yahoo Finance v8 chart endpoint',
        'tickers': {},
        'indices': {},
    }

    print('Tickers:')
    for sym in SYMBOLS:
        data = parse_chart(get(CHART.format(sym=sym, rng='6mo')))
        if data:
            snapshot['tickers'][sym] = data
            print(f'  {sym:5} {data["price"]:>10.2f}  {len(data["candles"])} bars')
        else:
            print(f'  {sym:5} FAILED')
        time.sleep(0.4)   # be polite; avoids tripping the rate limiter

    print('Indices:')
    for iid, ysym in INDICES.items():
        data = parse_chart(get(CHART.format(sym=ysym, rng='5d')))
        if data and data['prevClose']:
            price, prev = data['price'], data['prevClose']
            snapshot['indices'][iid] = {
                'price': price,
                'prevClose': prev,
                'chg': round(price - prev, 2),
                'chgPct': round((price / prev - 1) * 100, 2),
            }
            print(f'  {iid:6} {price:>12,.2f}  {snapshot["indices"][iid]["chgPct"]:+.2f}%')
        else:
            print(f'  {iid:6} FAILED')
        time.sleep(0.4)

    if not snapshot['tickers']:
        print('\nNo ticker data at all -- refusing to overwrite the last good '
              'snapshot with an empty one.')
        return 1

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(snapshot, f, separators=(',', ':'))
        f.write('\n')

    size = os.path.getsize(OUT)
    print(f'\nWrote {OUT} ({size:,} bytes) — '
          f'{len(snapshot["tickers"])}/{len(SYMBOLS)} tickers, '
          f'{len(snapshot["indices"])}/{len(INDICES)} indices')
    return 0


if __name__ == '__main__':
    sys.exit(main())
