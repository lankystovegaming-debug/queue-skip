# Queue Skip

A hawker food ordering prototype, built as a static website for GitHub Pages.

## Pages

- `/` — six hawker stalls, category filters, and search by stall or dish.
- `/golden-grain/`, `/wok-and-roll/`, `/coconut-corner/`, `/prata-parade/`, `/kopi-kakis/`, `/sweet-lah/` — individual menus with sample SGD prices and a temporary five-minute waiting estimate.
- `/cart/` — browser-saved cart grouped by stall, with quantity changes, removal, and a calculated total.
- `/checkout/` — intentionally blank placeholder.

On this repository's GitHub Pages site, these paths sit under `/queue-skip/`. Each route has its own `index.html`, so direct visits and refreshes work without a routing server. GitHub Pages redirects directory paths to their trailing-slash versions.

## Local development

No package installation or build service is required. Serve the root directory:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`. Edit `assets/data.js` for stall names, menus, and prices (integer cents). After adding a stall or editing the HTML shell, regenerate the static pages:

```sh
python3 scripts/build.py
```

## GitHub Pages

In repository **Settings → Pages**, choose **Deploy from a branch**, select **main** and **/ (root)**, then save. The expected site URL is https://lankystovegaming-debug.github.io/queue-skip/.

## Prototype scope

Cart contents are stored in this browser's local storage, shared across stalls, and retained on refresh. Prices and waiting estimates are sample data. Checkout is blank; orders are not submitted and no payments are taken. Supabase is not connected yet. Food illustrations are original inline SVGs. Google Fonts are optional; system fonts are used if unavailable.
