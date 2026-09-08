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
import json, math, os, random, sys, time, urllib.request, urllib.error

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

# The client needs n >= 200 closes before it will compute EMA 200; at 130 it
# rendered "INSUFF DATA" permanently. 260 (~1 trading year) clears that with
# room to spare and is also the window the risk metrics below are measured on.
MAX_CANDLES = 260
CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range={rng}&interval=1d&includePrePost=false'

# ── Fundamentals ────────────────────────────────────────────────────
# Yahoo's quoteSummary endpoint now demands a crumb, but this timeseries one
# does not, and it carries every figure the dashboard was holding by hand.
FUND = ('https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/'
        'timeseries/{sym}?symbol={sym}&type={types}&period1=1500000000&period2=2000000000')

FUND_TYPES = ','.join([
    'quarterlyTotalRevenue', 'quarterlyNetIncome',
    'annualTotalRevenue', 'annualNetIncome', 'annualGrossProfit',
    'annualDilutedEPS', 'annualFreeCashFlow',
])

# Month each company's fiscal year ends, straight from SEC's fiscalYearEnd.
# Needed to label a period end as, say, FY2027 Q2 rather than "July 2026".
FISCAL_YEAR_END_MONTH = {'NVDA': 1, 'AMD': 12, 'MU': 9, 'MRVL': 1, 'TSM': 12}

# TSMC reports in New Taiwan dollars. Comparing its TWD revenue against USD
# figures reads as a ~4000% jump, so it must be converted before display.
FX_SYMBOL = 'https://query1.finance.yahoo.com/v8/finance/chart/{pair}=X?range=5d&interval=1d'


NEWS = ('https://query1.finance.yahoo.com/v1/finance/search?q={sym}'
        '&quotesCount=0&newsCount=15&enableFuzzyQuery=false')

# ── Quant model ─────────────────────────────────────────────────────
# Everything below is arithmetic on the observed price series: volatility,
# drawdown, VaR/CVaR, Sharpe, Sortino, beta, correlation, and a GBM Monte
# Carlo. The DCF assumptions, fair-value weights and peer multiples are
# deliberately NOT touched -- those are judgement calls, not measurements.
BENCHMARK = '%5EGSPC'      # S&P 500, for beta
RISK_FREE = '%5EIRX'       # 13-week T-bill, quoted in percent
EQUITY_RISK_PREMIUM = 0.055   # matches the WACC block already in the dashboard
TRADING_DAYS = 252
MC_SIMS = 10000


def log_returns(closes):
    return [math.log(closes[i] / closes[i - 1])
            for i in range(1, len(closes)) if closes[i - 1] > 0 and closes[i] > 0]


def stdev(xs):
    if len(xs) < 2:
        return 0.0
    m = sum(xs) / len(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))


def percentile(sorted_xs, p):
    if not sorted_xs:
        return None
    k = (len(sorted_xs) - 1) * p
    lo, hi = math.floor(k), math.ceil(k)
    if lo == hi:
        return sorted_xs[int(k)]
    return sorted_xs[lo] * (hi - k) + sorted_xs[hi] * (k - lo)


def max_drawdown(closes):
    peak, worst = closes[0], 0.0
    for c in closes:
        peak = max(peak, c)
        worst = min(worst, c / peak - 1)
    return worst


def quant_metrics(closes, mkt_returns, basket_returns, rf_annual):
    """Risk figures + a GBM Monte Carlo, all from the observed series."""
    r = log_returns(closes)
    if len(r) < 60:
        return None
    sd = stdev(r)
    vol = sd * math.sqrt(TRADING_DAYS)
    mean_annual = sum(r) / len(r) * TRADING_DAYS

    downside = [x for x in r if x < 0]
    dstd = stdev(downside) * math.sqrt(TRADING_DAYS) if len(downside) > 1 else 0.0

    sharpe = (mean_annual - rf_annual) / vol if vol else 0.0
    sortino = (mean_annual - rf_annual) / dstd if dstd else 0.0

    ordered = sorted(r)
    var95 = percentile(ordered, 0.05)
    tail = [x for x in ordered if x <= var95]
    cvar95 = sum(tail) / len(tail) if tail else var95

    def pair_beta(a, b):
        n = min(len(a), len(b))
        if n < 60:
            return None
        a, b = a[-n:], b[-n:]
        ma, mb = sum(a) / n, sum(b) / n
        cov = sum((a[i] - ma) * (b[i] - mb) for i in range(n)) / (n - 1)
        var = sum((x - mb) ** 2 for x in b) / (n - 1)
        return cov / var if var else None

    def pair_corr(a, b):
        n = min(len(a), len(b))
        if n < 60:
            return None
        a, b = a[-n:], b[-n:]
        sa, sb = stdev(a), stdev(b)
        if not sa or not sb:
            return None
        ma, mb = sum(a) / n, sum(b) / n
        cov = sum((a[i] - ma) * (b[i] - mb) for i in range(n)) / (n - 1)
        return cov / (sa * sb)

    beta = pair_beta(r, mkt_returns) if mkt_returns else None
    corr = pair_corr(r, basket_returns) if basket_returns else None

    # Expected return via CAPM rather than an invented number, so the drift
    # is tied to the measured beta and the live risk-free rate.
    mu = (rf_annual + beta * EQUITY_RISK_PREMIUM) if beta is not None else mean_annual

    s0 = closes[-1]
    rng = random.Random(42)          # fixed seed: same inputs -> same output,
    finals = []                      # so a rerun doesn't churn the committed file
    drift = (mu - 0.5 * vol ** 2)
    for _ in range(MC_SIMS):
        finals.append(s0 * math.exp(drift + vol * rng.gauss(0, 1)))
    finals.sort()

    p = lambda q: percentile(finals, q)
    above = lambda x: sum(1 for f in finals if f > x) / len(finals) * 100

    return {
        'vol': vol, 'meanAnnual': mean_annual, 'sharpe': sharpe, 'sortino': sortino,
        'maxDD': max_drawdown(closes), 'var95': var95, 'cvar95': cvar95,
        'beta': beta, 'corr': corr, 'mu': mu, 'price': s0, 'rf': rf_annual,
        'mc': {
            'p5': p(0.05), 'p25': p(0.25), 'p50': p(0.50),
            'p75': p(0.75), 'p95': p(0.95),
            'mean': sum(finals) / len(finals),
            'pAboveCurrent': above(s0), 'pAbove25pct': above(s0 * 1.25),
        },
    }


def quant_payload(m):
    """Shape the metrics into the arrays the Quant tab already renders."""
    pct = lambda x: f'{x * 100:.1f}%'
    usd = lambda x: f'${x:,.0f}'
    tone_neg = 'r'
    risk = []
    if m['beta'] is not None:
        risk.append(['Beta (vs S&P 500, 1Y daily)', f'{m["beta"]:.2f}', ''])
    risk += [
        ['Annualized Volatility', pct(m['vol']), 'y'],
        ['Sharpe Ratio (1Y)', f'{m["sharpe"]:.2f}', 'g' if m['sharpe'] > 0 else 'r'],
        ['Sortino Ratio (1Y)', f'{m["sortino"]:.2f}', 'g' if m['sortino'] > 0 else 'r'],
        ['Max Drawdown (1Y)', pct(m['maxDD']), tone_neg],
        ['VaR (95%, 1-Day)', pct(m['var95']), tone_neg],
        ['CVaR (95%, 1-Day)', pct(m['cvar95']), tone_neg],
    ]
    if m['corr'] is not None:
        risk.append(['Correlation w/ Basket', f'{m["corr"]:.2f}', ''])

    mc = m['mc']
    return {
        'risk': risk,
        'mcParams': [
            ['Current Price', f'${m["price"]:,.2f}', 'a'],
            ['Expected Return (CAPM)', pct(m['mu']), 'g' if m['mu'] > 0 else 'r'],
            ['Annual Volatility (σ)', pct(m['vol']), ''],
            ['Risk-Free Rate', pct(m['rf']), ''],
            ['Time Horizon', f'{TRADING_DAYS} trading days', ''],
            ['Simulations', f'{MC_SIMS:,}', ''],
            ['Model', 'GBM', ''],
        ],
        'mcResults': [
            {'label': '5th · worst', 'px': round(mc['p5']), 'tone': 'r'},
            {'label': '25th', 'px': round(mc['p25']), 'tone': 'y'},
            {'label': '50th · median', 'px': round(mc['p50']), 'tone': 'a'},
            {'label': '75th', 'px': round(mc['p75']), 'tone': 'g'},
            {'label': '95th · best', 'px': round(mc['p95']), 'tone': 'g'},
        ],
        'mcSummary': [
            ['Mean Price', usd(mc['mean']), 'a', True],
            ['Probability > Current', f'{mc["pAboveCurrent"]:.0f}%',
             'g' if mc['pAboveCurrent'] >= 50 else 'y'],
            ['Probability > +25%', f'{mc["pAbove25pct"]:.0f}%', 'y'],
        ],
    }


def fetch_news(sym):
    """Same endpoint the client's fetchNews uses, fetched server-side.

    Without this the News tab on Pages spends ~66s walking every dead proxy
    before it gives up, so it just reads "Fetching headlines…" indefinitely.
    """
    d = get(NEWS.format(sym=sym))
    out = []
    for n in (d or {}).get('news', []) or []:
        title = (n.get('title') or '').strip()
        if not title:
            continue
        tickers = n.get('relatedTickers') or []
        pub = n.get('publisher') or ''
        ts = n.get('providerPublishTime')
        out.append({
            'title': title,
            'link': n.get('link') or '#',
            'publisher': pub,
            'date': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(ts)) if ts else '',
            'desc': pub + (' · ' + ', '.join(tickers[:4]) if tickers else ''),
        })
    return out[:12]


def fiscal_label(sym, iso_date):
    """'2026-07-31' -> 'Q2·27' for a January fiscal-year end."""
    y, m = int(iso_date[:4]), int(iso_date[5:7])
    fye = FISCAL_YEAR_END_MONTH.get(sym, 12)
    fy = y + 1 if m > fye else y
    start = fye % 12 + 1                      # first month of the fiscal year
    q = ((m - start) % 12) // 3 + 1
    return f'Q{q}·{fy % 100:02d}'


def money(v):
    a = abs(v)
    if a >= 1e12: return f'${v/1e12:.2f}T'
    if a >= 1e9:  return f'${v/1e9:.1f}B'
    if a >= 1e6:  return f'${v/1e6:.1f}M'
    return f'${v:,.0f}'


def series(payload, key):
    for r in (payload or {}).get('timeseries', {}).get('result', []):
        if key in r:
            rows = [x for x in r[key] if x]
            if rows:
                return rows
    return []


def val(row, fx):
    """Reported value in USD. Applies fx when the filing currency isn't USD."""
    raw = (row.get('reportedValue') or {}).get('raw')
    if raw is None:
        return None
    return raw * fx if row.get('currencyCode') == 'TWD' else raw


def get_fx(pair='TWDUSD'):
    d = get(FX_SYMBOL.format(pair=pair))
    try:
        return d['chart']['result'][0]['meta']['regularMarketPrice']
    except (TypeError, KeyError, IndexError):
        return None


def fetch_fundamentals(sym, fx):
    payload = get(FUND.format(sym=sym, types=FUND_TYPES))
    if not payload:
        return None

    qrev = series(payload, 'quarterlyTotalRevenue')
    qni = {r['asOfDate']: val(r, fx) for r in series(payload, 'quarterlyNetIncome')}
    quarterly = []
    for r in qrev[-6:]:
        rev = val(r, fx)
        ni = qni.get(r['asOfDate'])
        if rev is None:
            continue
        quarterly.append({
            'q': fiscal_label(sym, r['asOfDate']),
            'rev': round(rev / 1e9, 1),
            'ni': round(ni / 1e9, 2) if ni is not None else None,
            'end': r['asOfDate'],
        })

    def last(key):
        rows = series(payload, key)
        return val(rows[-1], fx) if rows else None

    rev_fy, ni_fy = last('annualTotalRevenue'), last('annualNetIncome')
    gp, fcf = last('annualGrossProfit'), last('annualFreeCashFlow')
    eps = last('annualDilutedEPS')     # per-share: never currency-converted below

    eps_rows = series(payload, 'annualDilutedEPS')
    eps_raw = (eps_rows[-1].get('reportedValue') or {}).get('raw') if eps_rows else None

    fundamentals = {}
    if rev_fy: fundamentals['revFy'] = money(rev_fy)
    if ni_fy:  fundamentals['ni'] = money(ni_fy)
    if fcf:    fundamentals['fcf'] = money(fcf)
    if gp and rev_fy: fundamentals['gm'] = f'{gp / rev_fy * 100:.1f}%'
    if eps_raw is not None:
        # EPS is per share in the filing currency; convert TWD ADR-style figures
        # the same way as the totals so it stays consistent with revFy.
        e = eps_raw * fx if (eps_rows and eps_rows[-1].get('currencyCode') == 'TWD') else eps_raw
        fundamentals['eps'] = f'${e:.2f}'

    if not quarterly and not fundamentals:
        return None
    return {'quarterly': quarterly, 'fundamentals': fundamentals,
            'asOf': qrev[-1]['asOfDate'] if qrev else None}


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
        data = parse_chart(get(CHART.format(sym=sym, rng='2y')))
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

    print('Fundamentals:')
    fx = get_fx('TWDUSD')
    if fx:
        print(f'  TWD->USD rate {fx} (for TSM, which reports in TWD)')
    else:
        print('  WARNING: no TWD->USD rate; skipping TSM fundamentals rather '
              'than publishing TWD figures labelled as dollars')
    snapshot['fx'] = {'TWDUSD': fx} if fx else {}

    for sym in SYMBOLS:
        if sym == 'TSM' and not fx:
            continue
        f = fetch_fundamentals(sym, fx or 1.0)
        if f:
            snapshot.setdefault('fundamentals', {})[sym] = f
            q = f['quarterly'][-1] if f['quarterly'] else None
            print(f'  {sym:5} {len(f["quarterly"])} quarters'
                  + (f', latest {q["q"]} rev {q["rev"]}B' if q else '')
                  + f', FY rev {f["fundamentals"].get("revFy", "-")}')
        else:
            print(f'  {sym:5} FAILED')
        time.sleep(0.4)

    print('Quant model:')
    # Risk-free: ^IRX is quoted in percent (3.757 means 3.757%).
    irx = parse_chart(get(CHART.format(sym=RISK_FREE, rng='5d')))
    rf = (irx['price'] / 100.0) if irx and irx.get('price') else 0.0425
    print(f'  risk-free {rf*100:.2f}% (13-week T-bill)'
          + ('' if irx else ' [fallback, ^IRX unavailable]'))

    bench = parse_chart(get(CHART.format(sym=BENCHMARK, rng='2y')))
    bench_map = {c['t']: c['c'] for c in bench['candles']} if bench else {}

    # date -> close, per ticker, so returns can be aligned on shared sessions
    close_maps = {s: {c['t']: c['c'] for c in snapshot['tickers'][s]['candles']}
                  for s in snapshot['tickers']}

    def aligned(a_map, b_map):
        days = sorted(set(a_map) & set(b_map))
        if len(days) < 61:
            return [], []
        return (log_returns([a_map[d] for d in days]),
                log_returns([b_map[d] for d in days]))

    for sym in SYMBOLS:
        cm = close_maps.get(sym)
        if not cm:
            continue
        closes = [cm[d] for d in sorted(cm)]

        stock_r, mkt_r = aligned(cm, bench_map) if bench_map else ([], [])

        # "Basket" = the equal-weighted average return of the other four names,
        # which is what the correlation line is meant to measure against.
        peers = [close_maps[o] for o in close_maps if o != sym]
        basket_r = []
        if peers:
            shared = sorted(set(cm).intersection(*[set(p) for p in peers]))
            if len(shared) > 61:
                series_r = [log_returns([p[d] for d in shared]) for p in peers]
                n = min(len(x) for x in series_r)
                basket_r = [sum(x[i] for x in series_r) / len(series_r) for i in range(n)]
                stock_vs_basket = log_returns([cm[d] for d in shared])
            else:
                stock_vs_basket = []
        else:
            stock_vs_basket = []

        m = quant_metrics(closes, mkt_r if mkt_r else None,
                          basket_r if basket_r else None, rf)
        if not m:
            print(f'  {sym:5} skipped (not enough history)')
            continue
        # correlation must compare the stock over the SAME shared sessions
        if basket_r and stock_vs_basket:
            n = min(len(stock_vs_basket), len(basket_r))
            a, b = stock_vs_basket[-n:], basket_r[-n:]
            sa, sb = stdev(a), stdev(b)
            if sa and sb:
                ma, mb = sum(a) / n, sum(b) / n
                cov = sum((a[i] - ma) * (b[i] - mb) for i in range(n)) / (n - 1)
                m['corr'] = cov / (sa * sb)

        snapshot.setdefault('quant', {})[sym] = quant_payload(m)
        print(f'  {sym:5} vol {m["vol"]*100:.1f}%  beta '
              + (f'{m["beta"]:.2f}' if m['beta'] is not None else '  n/a')
              + f'  maxDD {m["maxDD"]*100:.1f}%  median {m["mc"]["p50"]:.0f}')

    print('News:')
    for sym in SYMBOLS:
        items = fetch_news(sym)
        if items:
            snapshot.setdefault('news', {})[sym] = items
            print(f'  {sym:5} {len(items)} headlines — {items[0]["title"][:52]}')
        else:
            print(f'  {sym:5} none')
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
