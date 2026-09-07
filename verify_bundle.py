"""Verify the bundled HTML is intact and actually reflects the current src/ tree.

The previous version of this script counted { } ( ) [ ] characters and failed
anything off by more than 2. That is meaningless on minified libraries and on
JSX full of string literals -- it reported the 3 MB Babel build and the 1 MB
hero module as broken while they were perfectly fine, and it would happily pass
a bundle whose payload was stale. These checks are the ones that can actually
fail for a real reason:

  1. manifest parses and every entry base64-decodes + gunzips
  2. every script the template loads exists in the manifest
  3. each entry matches its src/ file byte for byte  <- catches a missed rebundle
  4. the embedded template matches src/_template.html
  5. index.html is byte-identical to the bundle

Exit code is non-zero if anything fails, so it can gate a deploy.
"""
import re, json, base64, gzip, sys, os

ROOT = os.path.dirname(os.path.abspath(__file__))
BUNDLE = os.path.join(ROOT, 'Glass Terminal - Standalone.html')
INDEX = os.path.join(ROOT, 'index.html')
SRC_DIR = os.path.join(ROOT, 'src')
EXTS = ('.jsx', '.js', '.woff2', '.bin')

problems = []
notes = []


def fail(msg):
    problems.append(msg)
    print(f'  FAIL  {msg}')


def ok(msg):
    print(f'  ok    {msg}')


with open(BUNDLE, 'r', encoding='utf-8') as f:
    html = f.read()

# ── 1. manifest integrity ────────────────────────────────────────────
print('\n[1] manifest + payload integrity')
m = re.search(r'<script type="__bundler/manifest">(.*?)</script>', html, re.DOTALL)
if not m:
    fail('no __bundler/manifest section found')
    sys.exit(1)
try:
    manifest = json.loads(m.group(1).strip())
except json.JSONDecodeError as e:
    fail(f'manifest is not valid JSON: {e}')
    sys.exit(1)

blobs = {}
for uid, entry in manifest.items():
    try:
        raw = base64.b64decode(entry['data'])
        blobs[uid] = gzip.decompress(raw) if entry.get('compressed') else raw
    except Exception as e:
        fail(f'{uid[:8]} payload will not decode: {type(e).__name__}: {e}')
if len(blobs) == len(manifest):
    total = sum(len(b) for b in blobs.values())
    ok(f'{len(manifest)} entries decoded ({total:,} bytes uncompressed)')

# ── 2. every script the template loads is present ────────────────────
print('\n[2] template script references')
t = re.search(r'<script type="__bundler/template">(.*?)</script>', html, re.DOTALL)
if not t:
    fail('no __bundler/template section found')
    template = ''
else:
    try:
        template = json.loads(t.group(1).strip())
    except json.JSONDecodeError as e:
        fail(f'template section is not valid JSON: {e}')
        template = ''

refs = re.findall(r'src="([0-9a-fA-F][0-9a-fA-F-]{7,})"', template)
missing = [r for r in refs if r not in manifest]
if missing:
    for r in missing:
        fail(f'template loads "{r}" but it is not in the manifest')
elif refs:
    ok(f'all {len(refs)} referenced scripts present')

unused = [u for u in manifest if u not in refs]
if unused:
    notes.append(f'{len(unused)} manifest entries not referenced by a <script> '
                 f'(fonts and assets loaded another way): '
                 f'{", ".join(u[:8] for u in sorted(unused)[:6])}'
                 f'{" ..." if len(unused) > 6 else ""}')

# ── 3. bundle matches src/ byte for byte ─────────────────────────────
print('\n[3] bundle vs src/ (is the bundle current?)')
def nl(b):
    """Normalize line endings. Some manifest entries were bundled with CRLF
    while src/ is LF, which is not a content difference and must not be
    reported as a stale bundle."""
    return b.replace(b'\r\n', b'\n')


checked = stale = eol_only = 0
for uid, blob in blobs.items():
    path = next((os.path.join(SRC_DIR, uid + e)
                 for e in EXTS if os.path.exists(os.path.join(SRC_DIR, uid + e))), None)
    if not path:
        continue
    checked += 1
    with open(path, 'rb') as f:
        disk = f.read()
    if disk == blob:
        continue
    if nl(disk) == nl(blob):
        eol_only += 1
        notes.append(f'{uid[:8]} matches {os.path.basename(path)} but differs in '
                     f'line endings (bundle CRLF, src LF) -- harmless, the next '
                     f'rebundle normalizes it')
        continue
    stale += 1
    fail(f'{uid[:8]} differs from {os.path.basename(path)} '
         f'(bundle {len(nl(blob)):,}B vs disk {len(nl(disk)):,}B, line endings ignored) '
         f'-- run: py rebundle.py')
if checked and not stale:
    suffix = f' ({eol_only} differing only in line endings)' if eol_only else ''
    ok(f'{checked} entries match their src/ file{suffix}')
if checked == 0:
    fail('no src/ files matched any manifest entry')

# ── 4. embedded template matches src/_template.html ──────────────────
print('\n[4] template vs src/_template.html')
tpl_file = os.path.join(SRC_DIR, '_template.html')
if not os.path.exists(tpl_file):
    notes.append('src/_template.html missing, skipped template comparison')
else:
    with open(tpl_file, 'r', encoding='utf-8') as f:
        disk_tpl = f.read()
    if disk_tpl != template:
        fail('embedded template differs from src/_template.html -- run: py rebundle.py')
    else:
        ok(f'template matches ({len(template):,} chars)')

# ── 5. index.html mirrors the bundle ─────────────────────────────────
print('\n[5] index.html mirror')
if not os.path.exists(INDEX):
    fail('index.html missing -- run: py rebundle.py')
else:
    with open(INDEX, 'r', encoding='utf-8') as f:
        if f.read() != html:
            fail('index.html differs from the bundle -- run: py rebundle.py')
        else:
            ok(f'identical to bundle ({os.path.getsize(INDEX):,} bytes)')

# ── summary ──────────────────────────────────────────────────────────
for n in notes:
    print(f'\n  note  {n}')

if problems:
    print(f'\n{len(problems)} problem(s) found.\n')
    sys.exit(1)
print('\nBundle verified: payload intact, current with src/, index.html in sync.\n')
