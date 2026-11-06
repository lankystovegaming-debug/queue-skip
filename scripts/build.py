"""Generate direct, refresh-safe pages for GitHub Pages. No dependencies needed."""
from pathlib import Path
from hashlib import sha256
import re

ROOT = Path(__file__).resolve().parent.parent
slugs = re.findall(r"slug:'([^']+)'", (ROOT / 'assets/data.js').read_text())

def page(route='', title='Canteen favourites, without the wait'):
    prefix = '../' if route else './'
    def asset(name):
        digest = sha256((ROOT / 'assets' / name).read_bytes()).hexdigest()[:12]
        return f'{prefix}assets/{name}?v={digest}'
    return f'''<!doctype html>
<html lang="en-SG">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#183e31">
  <meta name="description" content="Pre-order your school canteen favourites and make more of your break with Queue Skip.">
  <title>{title} · Queue Skip</title>
  <link rel="icon" href="{prefix}assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="{asset('style.css')}">
  <script src="{asset('data.js')}" defer></script>
  <script src="{asset('payment.js')}" defer></script>
  <script src="{asset('orders.js')}" defer></script>
  <script src="{asset('app.js')}" defer></script>
</head>
<body data-page="{route}" data-base="{prefix}">
  <a class="skip-link" href="#main">Skip to content</a>
  <div id="app"></div>
  <div id="toast" role="status" aria-live="polite"></div>
</body>
</html>
'''

(ROOT / 'index.html').write_text(page())
for slug in slugs + ['cart', 'checkout', 'order-confirmation', 'receipts']:
    folder = ROOT / slug
    folder.mkdir(exist_ok=True)
    (folder / 'index.html').write_text(page(slug, 'Your cart' if slug == 'cart' else slug.replace('-', ' ').title()))
(ROOT / '.nojekyll').touch()
print(f'Built homepage, {len(slugs)} stall pages, cart, checkout, and order confirmation.')
