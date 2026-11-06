# Queue Skip

A school canteen pre-ordering prototype hosted on GitHub Pages, with menus, orders, and private guest receipts stored in Supabase project `cysaladzzshykauneppq` (Singapore).

## Guest checkout

There is no sign-in screen. Browsing does not create an account. On first confirmation, Supabase silently creates an anonymous guest identity and the SDK keeps that session in the browser. Orders are visible only to their owner. Other tabs in the same browser can reopen saved receipts; clearing browser data or using another device loses access to that guest identity. Earlier tab-only demo receipts remain visible in their original tab.

The cart stays in local storage. Confirmation calls `place_guest_order`, which validates quantities, availability, pickup time, and expected total; calculates prices from the database; creates the order, stall orders, and line items in one transaction; and returns a receipt. A request UUID prevents duplicate orders on retries. Failed requests leave the cart intact. Receipt item names and prices are snapshots, so later menu edits do not change old receipts.

This is still a prototype: **stalls are not notified and no payment is processed.** Card fields are validated only in the page. Card number, cardholder, expiry, security code, and even last-four digits are excluded from the network request and database. Only the chosen demo payment method is saved.

## Pages

- `/` — seven canteen stalls, category filters, and dish search.
- `/golden-grain/`, `/wok-and-roll/`, `/coconut-corner/`, `/prata-parade/`, `/kopi-kakis/`, `/sweet-lah/`, `/fresh-squeeze/` — stall menus, prices in SGD, and temporary waiting estimates.
- `/cart/` — quantities, removal, and totals grouped by stall.
- `/checkout/` — student name/class, pickup date/time, notes, demo payment, review, and confirmation.
- `/receipts/` — this browser's guest order history plus earlier local demo receipts.
- `/order-confirmation/?order=QS-...` — receipt details after saving an order.

Routes sit under `/queue-skip/` on GitHub Pages. Each route has an `index.html`, so direct visits and refreshes work.

## Development

```sh
npm ci --ignore-scripts
npm run build
npm test
python3 -m http.server 8000
```

The checked-in `assets/vendor/database.js` bundles the pinned official Supabase SDK. `npm run build` regenerates that bundle and HTML with content-versioned assets. GitHub Pages serves the repository root; no server or build step is required on the host.

`client/database.js` contains only the project URL and a browser-safe **publishable** key. Never put a Supabase secret or service-role key in this repository. See [database security notes](supabase/SECURITY.md).

## Database development

The initial migration is in `supabase/migrations/`. It contains the schema, policies, protected order transaction, menu seed, and helper-permission hardening. It was tested before its version was recorded as applied on the hosted project. CLI migration history matches the local migration. A Docker-based shadow schema comparison could not run because Docker is not running here.

Tables: `stalls`, `menu_items`, `orders`, `stall_orders`, `order_items`. The private order function is behind an authenticated, security-invoker API wrapper. Read policies use the guest's `auth.uid()`. Browser roles have no direct insert/update/delete privileges on order tables.

Edit live menus through Supabase's Table Editor. `assets/data.js` is the initial seed and cart-compatibility catalogue, not the live source of prices. To deliberately re-seed the initial menu:

```sh
node scripts/seed-database.cjs
supabase db query --linked --project-ref cysaladzzshykauneppq --file supabase/seed.sql
```

The command examples use installed CLI v2.114.0. Inspect `--help` when using another version. Do not blindly push generated default configuration to an existing project: `config push` can apply unrelated auth/storage defaults.

Run rollback-only database checks:

```sh
supabase db query --linked --project-ref cysaladzzshykauneppq --file supabase/verify.sql
```

`tests/integration.cjs` is an opt-in live API test, not part of `npm test`. It creates two throw-away guests, tests multi-stall ordering and privacy, signs them out, and writes narrowly scoped cleanup SQL to `/private/tmp/queue-skip-cleanup.sql`. After running it, execute that cleanup file against this same test project. Never run it against another project.

## Publishing

GitHub **Settings → Pages → Deploy from a branch → main → / (root)**.

Live URL: https://lankystovegaming-debug.github.io/queue-skip/
