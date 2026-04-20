# AiMenu POS

Tablet-first Expo / react-native-web app for restaurant staff. Runs on iPad
(native) and on `pos.aimenu.ge` (web, which is the default deployment).

## Sibling apps

See `~/Telos/restaurant-frontend/CLAUDE.md` for cross-app notes shared with
the customer frontend and Django backend. Short version:

| App | Path | DO app id | Deploy trigger |
| --- | --- | --- | --- |
| Backend | `~/Telos/restaurant_platform` | `3076a3a7-33de-4587-949c-1cf87ac5fbed` | Auto on push |
| Customer | `~/Telos/restaurant-frontend` | `757f027d-ad10-4dd3-be1b-a955842ebc87` | Auto on push |
| **POS (this)** | `~/Telos/aimenu-pos` | `00d9f4f3-73c1-4d32-bff9-158f3cda290f` | **Manual** — `doctl apps create-deployment <id>` |

## Deploying

The POS spec uses `git:` as the source (not `github:`), so **DO does NOT
auto-deploy on push**. After merging to main:

```bash
set -a; . ~/Telos/restaurant-frontend/.env; set +a
DIGITALOCEAN_ACCESS_TOKEN="$DIGITALOCEAN_TOKEN" doctl apps create-deployment 00d9f4f3-73c1-4d32-bff9-158f3cda290f
```

Check status:

```bash
doctl apps list-deployments 00d9f4f3-73c1-4d32-bff9-158f3cda290f --format ID,Phase,Progress
```

Static-site build normally takes 2–4 min.

## Stack

- Expo 54 + Expo Router (typed routes).
- TanStack Query for all data fetching/mutations.
- Reanimated + gesture-handler (used for minor transitions; kanban DnD uses
  `@hello-pangea/dnd` on web).
- Axios with JWT auth + single-flight refresh (`src/api/client.ts`).
- AsyncStorage for token + locale + restaurant slug persistence.
- i18n in `src/i18n/index.ts` (ka / en dictionaries inline, not JSON).

## Auth + tenant header

`src/api/client.ts` injects two headers on every request:

- `Authorization: Bearer <access>` — from `tokenStore`
- `X-Restaurant: <slug>` — from `restaurantStore`

The restaurant slug is collected on login (third field alongside email +
password) and editable in Settings. Backend's
`apps/core/middleware/tenant.py` uses the header to resolve `request.restaurant`.

**Required backend CORS setup:** `x-restaurant` must be in
`CORS_ALLOW_HEADERS` (`config/settings/base.py`). If the browser throws a
CORS error on anything that hits a dashboard endpoint, this is the first
thing to check.

The login path is **`/api/v1/auth/login/`** (not `/token/` — that one 404s
and the browser shows it as CORS; refresh is at `/api/v1/auth/token/refresh/`).

## Polling + freshness

`app/_layout.tsx` sets:

- `refetchOnWindowFocus: 'always'` + `refetchOnReconnect: 'always'`.
- RN AppState → `focusManager.setFocused(...)` so the iPad refetches on
  app regain.

Per-screen intervals (`refetchIntervalInBackground: false` everywhere):

| Screen | Interval |
| --- | --- |
| Orders board | 5 s |
| Orders history | 30 s |
| Order detail | 10 s |
| Reservations today / pending | 10 s |
| Reservations upcoming / history | 30 s |
| Reservation detail | 15 s |

Cross-invalidation the UI relies on:

- Accept / reject / seat / no-show / cancel reservation → invalidate
  `['orders-board']` (backend hides orders whose reservation is still
  pending; acceptance unblocks them).
- Any order status change → invalidate `['reservations-today']` and
  `['reservations-upcoming']` (their list cards render
  `pre_order_summary.total`).

## Drag-and-drop

On web + tablet, the orders kanban uses **`@hello-pangea/dnd`**. On native
it falls back to non-DnD columns; staff advance orders via the detail
screen buttons. The earlier Pan+Reanimated approach was dropped because
`measureInWindow` gave unreliable bounds for column detection on
react-native-web.

## Generated API client

`npm run generate:api` runs `@gordela/api-generator` against
`https://admin.aimenu.ge/api/schema/`. Env vars in `.env`:

```
API_URL=https://admin.aimenu.ge
SWAGGER_PATH=/api/schema
API_NAMESPACE=Api
OUTPUT_DIR=./src/api/generated
```

The generator expects a `src/api/axios.ts` default export — we re-export
`api` from `client.ts` (which has the interceptors).

**Gotcha:** DRF APIViews without `@extend_schema(request=<Serializer>)`
produce no-arg generated functions. POS keeps thin wrappers
(e.g. `src/api/loyalty.ts`) around those; prefer fixing the backend
annotation so the wrapper can be removed later.

## Printing

Receipt printing uses `expo-print` on native (lazy-imported) and a hidden
iframe + `window.print()` on web. See `src/lib/printReceipt.ts`.

## i18n is in-file

Unlike the customer frontend (JSON dictionaries), POS dictionaries live
directly in `src/i18n/index.ts`. Keep the ka + en shapes identical or
TypeScript complains about the Dict type union.

## Common gotchas

- **React error #310 (hooks called in different order):** don't put `useMemo`
  after an early-return loading branch. All hooks must run on every render.
- **Gesture / Pan DnD:** don't reintroduce Pan-based DnD; `@hello-pangea/dnd`
  is the chosen path.
- **Dragging between columns on narrow screens:** the kanban only runs on
  `isTablet = width >= 1024`. Below that, the list view is used; no DnD.
- **Expo-print on web:** expo-print has no web implementation. The code
  path is `Platform.OS === 'web'` → iframe; native → lazy import expo-print.
- **Pigment CSS is not used here** (that's the customer frontend). POS uses
  `StyleSheet.create`.
