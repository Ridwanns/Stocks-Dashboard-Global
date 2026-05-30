"""Re-bundle modified source files back into the Glass Terminal standalone HTML.
Preserves the exact same bundler format the original used (gzip + base64 in JSON
manifest, with __bundler/manifest, __bundler/ext_resources, __bundler/template).
Only swaps the changed scripts; fonts and libs stay byte-identical.
NEW: also injects any src/ files that don't yet have manifest entries."""
import os, re, json, base64, gzip, shutil, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC_HTML = os.path.join(ROOT, 'Glass Terminal - Standalone.html')
OUT_HTML = os.path.join(ROOT, 'Glass Terminal - Standalone.html')
BACKUP   = os.path.join(ROOT, 'Glass Terminal - Standalone.backup.html')
SRC_DIR  = os.path.join(ROOT, 'src')

# Backup
if not os.path.exists(BACKUP):
    shutil.copy2(SRC_HTML, BACKUP)
    print(f'Backup -> {BACKUP}')

with open(SRC_HTML, 'r', encoding='utf-8') as f:
    html = f.read()

manifest_m = re.search(r'<script type="__bundler/manifest">(.*?)</script>', html, re.DOTALL)
manifest = json.loads(manifest_m.group(1).strip())

ext_choices = ('.jsx', '.js', '.woff2', '.bin')
swapped = 0

# ─── Update existing entries ────────────────────────────────────────
for uid, entry in manifest.items():
    for ext in ext_choices:
        path = os.path.join(SRC_DIR, uid + ext)
        if os.path.exists(path):
            with open(path, 'rb') as f:
                blob = f.read()
            compressed = entry.get('compressed', True)
            if compressed:
                data = base64.b64encode(gzip.compress(blob, compresslevel=9)).decode('ascii')
            else:
                data = base64.b64encode(blob).decode('ascii')
            new_entry = dict(entry)
            new_entry['data'] = data
            manifest[uid] = new_entry
            swapped += 1
            break
    else:
        pass  # keep original

# ─── Add NEW files from src/ that aren't in manifest ────────────────
existing_uids = set(manifest.keys())
added = 0
for fname in sorted(os.listdir(SRC_DIR)):
    if fname.startswith('_'):
        continue  # skip templates
    # extract UUID part
    base, ext = os.path.splitext(fname)
    if base in existing_uids:
        continue  # already handled
    if ext not in ('.js', '.jsx'):
        continue  # only auto-add scripts (not fonts etc.)

    path = os.path.join(SRC_DIR, fname)
    with open(path, 'rb') as f:
        blob = f.read()
    data = base64.b64encode(gzip.compress(blob, compresslevel=9)).decode('ascii')

    # Determine MIME type
    mime = 'text/jsx' if ext == '.jsx' else 'text/javascript'

    # Find a good insertion point: add as the second-to-last JS/JSX entry
    # so it loads before the main dashboard but after data files
    manifest[base] = {
        'mime': mime,
        'compressed': True,
        'data': data,
    }
    added += 1
    print(f'NEW: added {fname} to manifest')

new_manifest_json = json.dumps(manifest, separators=(',', ':'))
# Replace manifest script body
new_html = (
    html[:manifest_m.start(1)] + new_manifest_json + html[manifest_m.end(1):]
)

# ─── Also replace the __bundler/template section from _template.html ──
TEMPLATE_FILE = os.path.join(SRC_DIR, '_template.html')
if os.path.exists(TEMPLATE_FILE):
    with open(TEMPLATE_FILE, 'r', encoding='utf-8') as f:
        template_src = f.read()
    # The template is stored as a JSON string inside the script tag.
    # IMPORTANT: escape forward slashes so </script> inside the JSON string
    # doesn't prematurely close the <script type="__bundler/template"> tag.
    # The original bundler used / for this.
    template_json = json.dumps(template_src).replace('/', '\\u002F')
    template_m = re.search(
        r'(<script type="__bundler/template">)(.*?)(</script>)',
        new_html, re.DOTALL
    )
    if template_m:
        new_html = (
            new_html[:template_m.start(2)]
            + '\n' + template_json + '\n  '
            + new_html[template_m.end(2):]
        )
        print(f'Template section updated from {TEMPLATE_FILE}')
    else:
        print('WARNING: could not find __bundler/template section in HTML')
else:
    print(f'No _template.html found at {TEMPLATE_FILE}, template unchanged')

with open(OUT_HTML, 'w', encoding='utf-8') as f:
    f.write(new_html)
print(f'Rebundled {swapped} entries (+ {added} new) -> {OUT_HTML}')
print(f'File size: {os.path.getsize(OUT_HTML):,} bytes')

# Also emit index.html as a byte-identical copy so GitHub Pages / any static
# host serves the full app at "/" directly — no redirect page, no extra flash.
INDEX_HTML = os.path.join(ROOT, 'index.html')
with open(INDEX_HTML, 'w', encoding='utf-8') as f:
    f.write(new_html)
print(f'Wrote index.html (direct entry, no redirect) -> {INDEX_HTML}')
