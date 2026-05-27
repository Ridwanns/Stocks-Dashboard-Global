import re, json, os, sys, base64, gzip
src = 'Glass Terminal - Standalone.html'
with open(src, 'r', encoding='utf-8') as f:
    html = f.read()

m = re.search(r'<script type="__bundler/manifest">(.*?)</script>', html, re.DOTALL)
data = json.loads(m.group(1).strip())

# template gives us original filenames mapped from UUIDs
t = re.search(r'<script type="__bundler/template">(.*?)</script>', html, re.DOTALL)
template = json.loads(t.group(1).strip())

os.makedirs('src', exist_ok=True)
with open('src/_template.html', 'w', encoding='utf-8') as f:
    f.write(template)

# find script src mappings -- in the template, scripts reference uuids. We don't have the original filenames, so use uuids as names with detected extensions.
for uid, entry in data.items():
    mime = entry['mime']
    raw = entry['data']
    if entry.get('compressed'):
        blob = gzip.decompress(base64.b64decode(raw))
    else:
        blob = base64.b64decode(raw)
    ext = {
        'text/javascript': '.js',
        'application/javascript': '.js',
        'text/babel': '.jsx',
        'font/woff2': '.woff2',
    }.get(mime, '.bin')
    # heuristic: detect text/babel even if mime is text/javascript by content
    try:
        text = blob.decode('utf-8')
        if '<' in text[:2000] and 'return' in text and 'React' in text:
            ext = '.jsx'
    except:
        pass
    path = f'src/{uid}{ext}'
    with open(path, 'wb') as f:
        f.write(blob)
    size = len(blob)
    print(f'{uid} {mime} -> {path} ({size} bytes)')
