"""Build the weekly memo from data/quotes.json and optionally email it.

No subscriber list, no signup form, no database -- the workflow runs on a
schedule and sends one email to one address. The dashboard's "Subscribe"
panel never did anything anyway: it had no submit handler.

Writes memos/<date>.html either way, so there is an archive even when no
mail credentials are configured.

The memo goes out as an HTML email with the same memo attached as a PDF,
rendered by headless Chromium so the attachment matches the web version.

Usage:
    py build_memo.py                          # build the HTML only
    py build_memo.py --pdf                    # also render the PDF
    py build_memo.py --send                   # build, render, email
    py build_memo.py --send --to a@x.com,b@y.com   # to specific addresses

Email needs three environment variables, supplied by GitHub Secrets:
    GMAIL_USER          the sending Gmail address
    GMAIL_APP_PASSWORD  a 16-character App Password (NOT the account password)
    MEMO_TO             recipient; defaults to GMAIL_USER
"""
import json, os, smtplib, ssl, sys, time
from email.message import EmailMessage

ROOT = os.path.dirname(os.path.abspath(__file__))
SNAPSHOT = os.path.join(ROOT, 'data', 'quotes.json')
MEMO_DIR = os.path.join(ROOT, 'memos')

BG, CARD, EDGE = '#0a0e1a', '#111827', '#1f2937'
TEXT, DIM = '#e2e8f0', '#94a3b8'
GREEN, RED, AMBER, ACCENT = '#34d399', '#fb7185', '#fbbf24', '#8b5cf6'

NAMES = {'NVDA': 'NVIDIA', 'AMD': 'Advanced Micro Devices', 'MU': 'Micron',
         'TSM': 'Taiwan Semiconductor', 'MRVL': 'Marvell'}
INDEX_NAMES = {'N225': 'Nikkei 225', 'KS11': 'KOSPI', 'SSEC': 'SSE Composite',
               'HSI': 'Hang Seng', 'JKSE': 'IDX Composite', 'FTSE': 'FTSE 100',
               'GDAXI': 'DAX', 'GSPC': 'S&P 500', 'IXIC': 'NASDAQ', 'DJI': 'Dow Jones'}


def rsi(closes, period=14):
    if len(closes) < period + 1:
        return None
    gains = losses = 0.0
    for i in range(1, period + 1):
        d = closes[i] - closes[i - 1]
        gains += max(d, 0.0)
        losses += max(-d, 0.0)
    ag, al = gains / period, losses / period
    for i in range(period + 1, len(closes)):
        d = closes[i] - closes[i - 1]
        ag = (ag * (period - 1) + max(d, 0.0)) / period
        al = (al * (period - 1) + max(-d, 0.0)) / period
    if al == 0:
        return 100.0
    return 100 - 100 / (1 + ag / al)


def change_over(closes, bars):
    if len(closes) <= bars:
        return None
    return (closes[-1] / closes[-1 - bars] - 1) * 100


def tone(v):
    return GREEN if (v or 0) >= 0 else RED


def sign(v, dp=2):
    return f'{v:+.{dp}f}'


def row(label, value, color=TEXT, small=False):
    size = 11 if small else 13
    return (f'<tr><td style="padding:4px 0;color:{DIM};font-size:{size}px">{label}</td>'
            f'<td align="right" style="padding:4px 0;color:{color};font-size:{size}px;'
            f'font-family:ui-monospace,Menlo,Consolas,monospace">{value}</td></tr>')


def build(snap):
    ts = snap.get('generatedAt', '')
    today = time.strftime('%d %B %Y', time.gmtime())
    parts = []

    parts.append(f'''<div style="background:{BG};padding:28px 18px;font-family:
-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:640px;margin:0 auto">
<div style="color:{ACCENT};font-size:11px;letter-spacing:2px;font-family:ui-monospace,
Menlo,Consolas,monospace">RIDWAN · CHIP DESK</div>
<div style="color:{TEXT};font-size:30px;font-weight:600;margin:6px 0 2px">Weekly memo</div>
<div style="color:{DIM};font-size:12px;margin-bottom:22px">{today} · data as of {ts}</div>''')

    # ── Tickers ──────────────────────────────────────────────────────
    for sym, t in snap.get('tickers', {}).items():
        closes = [c['c'] for c in t.get('candles', [])]
        w1 = change_over(closes, 5)
        m1 = change_over(closes, 21)
        r = rsi(closes)
        day = ((t['price'] / t['prevClose'] - 1) * 100) if t.get('prevClose') else None
        q = (snap.get('quant', {}) or {}).get(sym, {})
        qrisk = {k: v for k, v, *_ in q.get('risk', [])}
        f = ((snap.get('fundamentals', {}) or {}).get(sym, {}) or {}).get('quarterly', [])
        last_q = f[-1] if f else None

        parts.append(f'''<div style="background:{CARD};border:1px solid {EDGE};
border-radius:6px;padding:16px;margin-bottom:12px">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td><span style="color:{TEXT};font-size:20px;font-weight:600">{sym}</span>
<span style="color:{DIM};font-size:12px"> · {NAMES.get(sym, sym)}</span></td>
<td align="right"><span style="color:{TEXT};font-size:20px;font-family:ui-monospace,
Menlo,Consolas,monospace">{t["price"]:,.2f}</span>
<span style="color:{tone(day)};font-size:13px"> {sign(day or 0)}%</span></td>
</tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px">''')

        if w1 is not None:
            parts.append(row('1 week', f'{sign(w1)}%', tone(w1)))
        if m1 is not None:
            parts.append(row('1 month', f'{sign(m1)}%', tone(m1)))
        if r is not None:
            state = 'overbought' if r > 70 else 'oversold' if r < 30 else 'neutral'
            col = RED if r > 70 else GREEN if r < 30 else AMBER
            parts.append(row('RSI (14)', f'{r:.1f} · {state}', col))
        for key in ('Annualized Volatility', 'Max Drawdown (1Y)'):
            if key in qrisk:
                parts.append(row(key, qrisk[key], AMBER, small=True))
        if last_q:
            parts.append(row(f'Revenue {last_q["q"]}', f'${last_q["rev"]}B', TEXT, small=True))
        parts.append('</table></div>')

    # ── Indices ──────────────────────────────────────────────────────
    idx = snap.get('indices', {})
    if idx:
        parts.append(f'''<div style="background:{CARD};border:1px solid {EDGE};
border-radius:6px;padding:16px;margin-bottom:12px">
<div style="color:{ACCENT};font-size:10px;letter-spacing:1.5px;margin-bottom:10px;
font-family:ui-monospace,Menlo,Consolas,monospace">GLOBAL MARKETS</div>
<table width="100%" cellpadding="0" cellspacing="0">''')
        for k, v in idx.items():
            parts.append(row(INDEX_NAMES.get(k, k),
                             f'{v["price"]:,.2f}  {sign(v["chgPct"])}%', tone(v['chgPct'])))
        parts.append('</table></div>')

    # ── Headlines ────────────────────────────────────────────────────
    news = snap.get('news', {})
    if news:
        parts.append(f'''<div style="background:{CARD};border:1px solid {EDGE};
border-radius:6px;padding:16px;margin-bottom:12px">
<div style="color:{ACCENT};font-size:10px;letter-spacing:1.5px;margin-bottom:10px;
font-family:ui-monospace,Menlo,Consolas,monospace">HEADLINES</div>''')
        for sym, items in news.items():
            for n in items[:2]:
                parts.append(f'''<div style="margin-bottom:9px">
<span style="color:{ACCENT};font-size:10px;font-family:ui-monospace,Menlo,Consolas,
monospace">{sym}</span>
<a href="{n["link"]}" style="color:{TEXT};font-size:12px;text-decoration:none">
 {n["title"]}</a>
<div style="color:{DIM};font-size:10px">{n.get("publisher", "")}</div></div>''')
        parts.append('</div>')

    parts.append(f'''<div style="color:{DIM};font-size:10px;line-height:1.6;
margin-top:18px;border-top:1px solid {EDGE};padding-top:14px">
Generated automatically from the Chip Desk dashboard ·
<a href="https://ridwanns.github.io/Stocks-Dashboard-Global/"
style="color:{ACCENT};text-decoration:none">open the dashboard</a><br>
For informational purposes only · not investment advice.
</div></div></div>''')
    return ''.join(parts)


def render_pdf(html_path):
    """Render the memo to PDF with headless Chromium, if it's installed.

    Playwright is only present on the runner (the workflow installs it), so
    locally this returns None and the mail goes out as HTML alone rather than
    failing. Chromium is used rather than a Python PDF library because the
    memo is styled HTML and this keeps the PDF identical to the web version.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('  playwright not installed — sending without a PDF attachment')
        return None

    pdf_path = os.path.splitext(html_path)[0] + '.pdf'
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.goto('file://' + os.path.abspath(html_path).replace('\\', '/'))
            page.pdf(path=pdf_path, format='A4', print_background=True,
                     margin={'top': '14mm', 'bottom': '14mm',
                             'left': '10mm', 'right': '10mm'})
            browser.close()
    except Exception as e:
        print(f'  PDF render failed ({type(e).__name__}: {e}) — sending HTML only')
        return None

    print(f'  Rendered {pdf_path} ({os.path.getsize(pdf_path):,} bytes)')
    return pdf_path


def recipients():
    """--to wins, then MEMO_TO, then the sending account. Comma-separated."""
    raw = ''
    if '--to' in sys.argv:
        i = sys.argv.index('--to')
        if i + 1 < len(sys.argv):
            raw = sys.argv[i + 1]
    raw = raw or os.environ.get('MEMO_TO') or os.environ.get('GMAIL_USER') or ''
    return [a.strip() for a in raw.split(',') if a.strip()]


def send(html, subject, pdf_path=None):
    user = (os.environ.get('GMAIL_USER') or '').strip()
    # Google shows App Passwords as "abcd efgh ijkl mnop", and pasting that
    # verbatim gives 19 characters, which Gmail rejects with 535. They never
    # contain spaces, so stripping them is safe and saves a round trip.
    pw = (os.environ.get('GMAIL_APP_PASSWORD') or '').replace(' ', '').strip()
    to = recipients()
    if not user or not pw:
        print('GMAIL_USER / GMAIL_APP_PASSWORD not set — built the file but sent nothing.')
        return False
    if not to:
        print('No recipient — pass --to, or set MEMO_TO.')
        return False

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = user
    msg['To'] = ', '.join(to)
    msg.set_content('This memo is formatted in HTML. Open it in an HTML-capable client.')
    msg.add_alternative(html, subtype='html')

    if pdf_path and os.path.exists(pdf_path):
        with open(pdf_path, 'rb') as f:
            msg.add_attachment(f.read(), maintype='application', subtype='pdf',
                               filename=os.path.basename(pdf_path))

    # Gmail rejects a bad App Password with a bare 535, which surfaced as an
    # unhandled traceback and a red job with nothing actionable in it.
    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=ssl.create_default_context()) as s:
            s.login(user, pw)
            s.send_message(msg)
    except smtplib.SMTPAuthenticationError as e:
        masked = (user[:2] + '***@' + user.split('@')[-1]) if '@' in user else '***'
        print('Gmail refused the login.')
        print(f'  GMAIL_USER      {masked}')
        print(f'  password length {len(pw)} characters '
              f'(an App Password is exactly 16, no spaces)')
        print(f'  server said     {e.smtp_code} {e.smtp_error.decode("utf-8", "replace")[:160]}')
        print('Usual causes: spaces left in the App Password, the account password '
              'used instead of an App Password, or GMAIL_USER not being the account '
              'that created it.')
        return False
    except (smtplib.SMTPException, OSError) as e:
        print(f'Could not send: {type(e).__name__}: {e}')
        return False

    print(f'Sent to {", ".join(to)}')
    return True


def main():
    if not os.path.exists(SNAPSHOT):
        print(f'No snapshot at {SNAPSHOT}; run fetch_quotes.py first.')
        return 1
    with open(SNAPSHOT, encoding='utf-8') as f:
        snap = json.load(f)

    html = build(snap)
    os.makedirs(MEMO_DIR, exist_ok=True)
    stamp = time.strftime('%Y-%m-%d', time.gmtime())
    path = os.path.join(MEMO_DIR, f'{stamp}.html')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'Wrote {path} ({os.path.getsize(path):,} bytes)')

    pdf = render_pdf(path) if '--pdf' in sys.argv or '--send' in sys.argv else None

    if '--send' in sys.argv:
        ok = send(html, f'Chip Desk — weekly memo, {time.strftime("%d %b %Y", time.gmtime())}', pdf)
        # Report the failure, but the memo file is already written and the
        # workflow still archives it.
        if not ok:
            return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
