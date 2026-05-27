"""Verify the rebundled HTML by decompressing each entry and running a syntax
sanity check on the JSX/JS sources (basic balance check on braces/parens since
we can't easily run Babel transforms here). Will report any obvious issues."""
import re, json, base64, gzip, sys, os

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Glass Terminal - Standalone.html')
with open(SRC, 'r', encoding='utf-8') as f:
    html = f.read()

m = re.search(r'<script type="__bundler/manifest">(.*?)</script>', html, re.DOTALL)
manifest = json.loads(m.group(1).strip())
print(f'manifest entries: {len(manifest)}')

ok = 0
fail = 0
for uid, entry in manifest.items():
    mime = entry['mime']
    blob = gzip.decompress(base64.b64decode(entry['data'])) if entry.get('compressed') else base64.b64decode(entry['data'])
    if 'font' in mime:
        ok += 1
        continue
    try:
        text = blob.decode('utf-8')
    except UnicodeDecodeError:
        ok += 1
        continue
    # very rough balance check
    issues = []
    pairs = [('{', '}'), ('(', ')'), ('[', ']')]
    for a, b in pairs:
        ca = text.count(a)
        cb = text.count(b)
        if abs(ca - cb) > 2:  # tolerate strings/regex
            issues.append(f'unbalanced {a}{b}: {ca}/{cb}')
    label = uid[:8]
    if issues:
        print(f'FAIL {label} {mime} len={len(text)}: {"; ".join(issues)}')
        fail += 1
    else:
        ok += 1
print(f'\n{ok} OK / {fail} FAIL out of {len(manifest)} entries')
