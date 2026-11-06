# Queue Skip

A school canteen pre-ordering prototype, built as a static website for GitHub Pages.

## Pages

- `/` — seven canteen stalls, category filters, and search by stall or dish.
- `/golden-grain/`, `/wok-and-roll/`, `/coconut-corner/`, `/prata-parade/`, `/kopi-kakis/`, `/sweet-lah/` — individual menus with sample SGD prices and a temporary five-minute waiting estimate.
- `/cart/` — browser-saved cart grouped by stall, with quantity changes, removal, and a calculated total.
- `/checkout/` — student name and class, pickup date/time, optional notes, grouped order summary, an editable pre-order review, and a confirmation dialog.

On this repository's GitHub Pages site, these paths sit under `/queue-skip/`. Each route has its own `index.html`, so direct visits and refreshes work without a routing server. GitHub Pages redirects directory paths to their trailing-slash versions.

- `/receipts/` — all confirmed demo receipts in this browser tab, with links to each order.
- `/fresh-squeeze/` — fruit cups, juices, and a banana smoothie.
- `/order-confirmation/` — selected demo receipt in this browser tab, with order reference, items, total, student details, pickup instructions, payment method, and notes.

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

Cart contents are stored in this browser's local storage, shared across stalls, and retained on refresh. Prices and waiting estimates are sample data. Checkout validates required fields and a pickup time at least five minutes ahead in Singapore time. The top navigation stays visible while scrolling. Student details stay in page memory until confirmation. Accepting the confirmation dialog adds a demo receipt to this tab’s session history and clears the cart. Refreshing the receipt retains its details; direct visits without a receipt show an empty state. Receipts exclude the cardholder name, full card number, expiry, and security code; online demo receipts contain only the last four digits. Payment options include pay at pickup and a demo online card form. Test card details are validated locally (16 numeric digits with automatic spaces, current/future MM/YY expiry, name, and 3–4 digit security code), never saved or sent, and only the last four digits appear in the review. Use the built-in test card button. Run `node tests/payment.cjs` for card validation and `node tests/orders.cjs` for receipt checks. Both payment choices are placeholders; orders are not submitted and no payments are taken. Supabase is not connected yet. Food illustrations are original inline SVGs. Google Fonts are optional; system fonts are used if unavailable.
