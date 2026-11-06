# Queue Skip database security

- Public guests can read stalls and menu items only.
- An anonymous Supabase Auth identity is created invisibly at checkout. No email, password, or sign-in screen is needed.
- Every order belongs to `auth.uid()`. Orders, stall orders, and items all enforce ownership with RLS. Browser roles have SELECT only; direct writes are blocked.
- `private.place_guest_order` is the sole privileged write path. It is intentionally SECURITY DEFINER so untrusted browsers cannot set totals, prices, ownership, or preparation/payment status. It is in a non-exposed schema, checks `auth.uid()`, pins an empty search path, qualifies relation names, and revokes PUBLIC/anon execution. Its public API wrapper is SECURITY INVOKER.
- Order creation is atomic and uses a per-guest request UUID for idempotency. Server-side menu prices and availability are authoritative. Receipt prices and names are immutable snapshots.
- No card data is sent or saved. Online payment is a validation-only demo.
- The SDK persists a guest session in local storage. Losing that session loses access; a receipt reference alone never grants access.
- SDK and build dependencies are pinned and locked. The public frontend includes a publishable key only.

## Verification

Rollback SQL checks passed for ownership across two guests, no unauthenticated orders, direct-write rejection, price tampering, invalid carts, pickup validation, idempotency, atomic rollback, and receipt price snapshots.

The live SDK/API check also passed for public menus, actual anonymous identity creation, a multi-stall order, private receipt history, repeat requests, and rejected tampering. Test guests signed out before cleanup; their accounts and order rows were deleted. Unit checks verify that card fields are excluded from RPC payloads.

Browser visual verification was attempted twice but blocked by automatic access-review timeouts. No alternate browser-control path was used. The hosted API and build checks do not substitute for visual QA.

## Advisor results

Unnecessary PUBLIC/anon/authenticated execution on the pre-existing `public.rls_auto_enable` event-trigger helper was revoked. Its two execution warnings are resolved. No performance warnings were returned.

Supabase still reports anonymous-access notices for the three owner-private order tables. This is intentional for guest checkout; both SQL and API tests proved that guests cannot read another guest's rows. [Supabase anonymous-access policy guidance](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins).

The project also reports that leaked-password protection is disabled. Queue Skip does not accept passwords; this pre-existing setting was not changed. Review it before adding password sign-in: [Supabase password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
