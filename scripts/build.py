"""Generate direct, refresh-safe pages for GitHub Pages. No dependencies needed."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
slugs = re.findall(r"slug:'([^']+)'", (ROOT / 'assets/data.js').read_text())

def page(route='', title='Hawker favourites, without the wait'):
    prefix = '../' if route else './'
    return f'''<!doctype html>
<html lang="en-SG">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#183e31">
  <meta name="description" content="Browse your hawker favourites, choose a stall, and build your Queue Skip order.">
  <title>{title} · Queue Skip</title>
  <link rel="icon" href="{prefix}assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="{prefix}assets/style.css">
  <script src="{prefix}assets/data.js" defer></script>
  <script src="{prefix}assets/app.js" defer></script>
</head>
<body data-page="{route}" data-base="{prefix}">
  <a class="skip-link" href="#main">Skip to content</a>
  <div id="app"></div>
  <div id="toast" role="status" aria-live="polite"></div>
</body>
</html>
'''

(ROOT / 'index.html').write_text(page())
for slug in slugs + ['cart']:
    folder = ROOT / slug
    folder.mkdir(exist_ok=True)
    (folder / 'index.html').write_text(page(slug, 'Your cart' if slug == 'cart' else slug.replace('-', ' ').title()))
(ROOT / 'checkout').mkdir(exist_ok=True)
(ROOT / 'checkout/index.html').write_text('''<!doctype html>
<html lang="en-SG"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Checkout · Queue Skip</title></head><body></body></html>
''')
(ROOT / '.nojekyll').touch()
print(f'Built homepage, {len(slugs)} stall pages, cart, and blank checkout.')
