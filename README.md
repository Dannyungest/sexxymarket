# Sexxy Market

Production-oriented multi-vendor adult wellness marketplace for Nigeria:

- Storefront: `sexxymarket.com`
- Merchant Portal: `merchant.sexxymarket.com`
- Admin Portal: `admin.sexxymarket.com`
- API: `api.sexxymarket.com`

## Stack

- Monorepo: Turborepo + npm workspaces
- Frontend: Next.js (`apps/storefront`, `apps/merchant-portal`, `apps/admin-portal`)
- Backend: NestJS + Prisma + PostgreSQL (`apps/api`)
- Cache/rate limiting: Redis
- Payments: Flutterwave hosted checkout link + webhook confirmation

## Key Features

- Guest and account checkout
- Category browsing, cart, and checkout
- Free nationwide delivery (NGN 0 delivery fee)
- Verified-purchase reviews
- Merchant onboarding + admin approval
- Merchant verification/KYC with document uploads
- Merchant tiers (`STANDARD` manual listing approval, `TRUSTED` auto-publish)
- Merchant agreement with 10% platform commission
- Multi-admin role support (ADMIN, SUPER_ADMIN)
- 18+ legal pages and policy notices

## Required Environment Variables

Use `.env.example` at the repo root as a template and copy to `.env` before running anything that loads env. Variable names are case-sensitive. Each line must be a single `KEY="value"` pair. Do not wrap comments, prose, or parentheses in the value (broken lines break dotenv).

### Full checklist (API + all apps)

| Variable | Used for |
|----------|-----------|
| `DATABASE_URL` | Prisma / PostgreSQL connection string. |
| `REDIS_URL` | Rate limiting; must be a URL such as `redis://...` or `rediss://...`, not a shell command. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT signing. Use long random strings. |
| `SESSION_SECRET` | Server-side session / signing. |
| `FLUTTERWAVE_SECRET_KEY` / `FLUTTERWAVE_PUBLIC_KEY` / `FLUTTERWAVE_ENCRYPTION_KEY` | Flutterwave v4. |
| `FLUTTERWAVE_WEBHOOK_SECRET_HASH` | Must match the **Secret hash** in the Flutterwave dashboard (and what the webhook sends as `verif-hash` or signature verification). |
| `FLUTTERWAVE_REDIRECT_URL` | **Full URL** where the buyer is sent after payment (see Flutterwave section below). Defaults in code to `http://localhost:3000` if unset. |
| `FLUTTERWAVE_API_BASE_URL` | Usually `https://api.flutterwave.com`. |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Transactional email (Resend; see below). **From** address must use a domain you verify in Resend. |
| `R2_PUBLIC_BASE_URL` | Public file URLs (e.g. product or KYC documents). |
| `NEXT_PUBLIC_API_BASE_URL` | Base URL the Next.js apps use to call the API (e.g. `http://localhost:4000`). |
| `NEXT_PUBLIC_STOREFRONT_URL` | Where the **merchant portal** and emails link for storefront pages such as **verify email** (default `http://localhost:3000` in code if unset). Set in production to `https://sexxymarket.com`. |
| `STOREFRONT_URL` | Server-side links in the API (notifications, verification links). **Production:** `https://sexxymarket.com` (or your real storefront origin). **Local:** `http://localhost:3000`. |
| `MERCHANT_PORTAL_URL` | Links to the merchant app from emails or other server logic. **Production:** e.g. `https://merchant.sexxymarket.com`. **Local:** `http://localhost:3001`. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Only for `prisma:seed` (local/dev). Change in production. |

`ADMIN_PORTAL_URL` is optional for future admin features; add it if you add admin-only links in email templates.

### Resend setup (email verification, notifications)

1. Create a free or paid account at [resend.com](https://resend.com) and open the **API Keys** page.
2. **Create** an API key and set `RESEND_API_KEY` in `.env` (treat it like a password; do not commit the real value).
3. In **Domains**, add your sending domain and complete DNS (SPF, DKIM, etc., as Resend instructs) **or** use Resend’s testing domain for dev only.
4. Set `RESEND_FROM_EMAIL` to an address on a **verified** domain, for example `noreply@sexxymarket.com` in production. For a quick local test, use whatever Resend allows in their quick-start docs for unverified test sends, if available, and a fixed From they document.
5. Without a valid key and a From address Resend can send for, logins that trigger emails will fail at the provider.

### Base URLs: local vs `sexxymarket.com`

- **Local:** `STOREFRONT_URL=http://localhost:3000`, `MERCHANT_PORTAL_URL=http://localhost:3001`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`, and `NEXT_PUBLIC_STOREFRONT_URL` matching the storefront origin so verification links in the merchant app point at the right host.
- **Production:** set `STOREFRONT_URL`, `MERCHANT_PORTAL_URL`, `NEXT_PUBLIC_STOREFRONT_URL`, and all `NEXT_PUBLIC_*` in each deployed app to the real `https://…` origins (no trailing slash inconsistency in notification builders if the code appends paths).

### Common `.env` mistakes

- `REDIS_URL` pasted from `redis-cli` help text or split across lines — use a single connection URL only.
- `FLUTTERWAVE_REDIRECT_URL` containing notes in parentheses, or a path on a new line in the same file — the value must be one valid URL.
- Mismatch between dashboard **Secret hash** and `FLUTTERWAVE_WEBHOOK_SECRET_HASH` — webhooks will be rejected.
- Omitted or wrong `STOREFRONT_URL` / `MERCHANT_PORTAL_URL` — email links to verify or to portals go to the wrong host.

## Account lifecycle (product flows for QA)

These are the **intended** onboarding orders (password change and email verification use flags from `GET /api/auth/me` on both storefront and merchant portal where applicable).

1. **Storefront, self-serve customer:** Register (no session until the user acts) → use the **verification link in email** (opens the storefront) → sign in on **Account** → place orders and checkout as normal.
2. **Storefront, customer created by admin:** Admin provides a temp password and an unverified email → the user **signs in** on the storefront account page → **changes password** (required) → then **verifies email** (link or resend) → then checkout is allowed in line with an verified email.
3. **Merchant portal, self-serve:** Register a **customer** on the merchant registration page (no `accessToken` on register) → **verify email** on the **storefront** (same link pattern as all users) → return to the portal → **sign in** and **submit the merchant application** (JWT after login).
4. **Merchant, created by admin:** **Sign in** to the merchant portal → if required, **set a new password** (temporary password flow) → then **verify email** (resend/refresh as needed) until `emailVerified` is true → full dashboard and APIs that expect a verified user.

## Flutterwave v4 Webhook Setup (Dashboard Click-by-Click)

Reference docs:
- [Flutterwave Webhooks](https://developer.flutterwave.com/docs/webhooks)
- [Flutterwave Getting Started](https://developer.flutterwave.com/docs/getting-started)

**Webhook URL** (set in the Flutterwave dashboard) must point at the **API** app’s global prefix `api` and the payments path:

- **Local (tunnel to your machine):** `https://<your-tunnel-host>/api/payments/webhooks/flutterwave`
- **Production:** `https://api.sexxymarket.com/api/payments/webhooks/flutterwave`

**Redirect URL** (`FLUTTERWAVE_REDIRECT_URL` in the API’s environment): where Flutterwave sends the customer **after** hosted checkout. The [payments service](apps/api/src/payments/payments.service.ts) passes this as `redirect_url` to Flutterwave. It must be a full URL with scheme and host, for example:

- **Local:** `http://localhost:3000` (root or a path the storefront uses after return, e.g. `http://localhost:3000/cart` if you implement handling there)
- **Production:** `https://sexxymarket.com/...` (use the storefront route you want buyers to see after payment; must match a real public URL)

**Important:** the dashboard **Secret hash** and `FLUTTERWAVE_WEBHOOK_SECRET_HASH` in `.env` must be the **same** string.

Steps:
1. Sign in to [Flutterwave Dashboard](https://dashboard.flutterwave.com/login).
2. In the left menu, click **Settings**.
3. Click **Webhooks**.
4. In **Webhook URL**, paste the local tunnel URL or production URL above.
5. In **Secret Hash**, enter a long random string.
6. Click all webhook event checkboxes (especially payment completion events).
7. Click **Save**.
8. Copy the exact Secret Hash value into `.env` as:
   - `FLUTTERWAVE_WEBHOOK_SECRET_HASH="<your-secret-hash>"`

Important (implementation):
- This code verifies `flutterwave-signature` (HMAC SHA256 over raw body) and also supports `verif-hash` fallback.
- Only successful events with matching order reference, amount, and currency (`NGN`) mark orders as paid.

## DATABASE_URL Guide (Neon) - Exact Steps

Neon URL: [https://console.neon.tech](https://console.neon.tech)

1. Open [Neon Console](https://console.neon.tech) and click **Sign up** (or **Log in**).
2. Click **Create project**.
3. Fill:
   - **Project name**: `sexxymarket-prod`
   - **Postgres version**: leave default
   - **Region**: choose nearest to Nigeria users (for example `eu-west`)
4. Click **Create project**.
5. After project creation, Neon shows a connection modal:
   - Click **Connection Details**.
   - Ensure **Role** is selected (usually `neondb_owner`).
   - Ensure **Database** is selected (usually `neondb`).
6. Click **Copy connection string**.
7. In your `.env`, set:
   - `DATABASE_URL="postgresql://..."`
8. Optional but recommended:
   - In Neon sidebar click **Branches** -> keep `main` for production.
   - Click **Settings** -> **Project settings** -> enable IP allowlist if required by your host.

## REDIS_URL Guide (Upstash) - Exact Steps

Upstash URL: [https://console.upstash.com](https://console.upstash.com)

1. Open [Upstash Console](https://console.upstash.com) and click **Sign up** (or **Log in**).
2. In dashboard, click **Create Database**.
3. Fill:
   - **Name**: `sexxymarket-redis`
   - **Type**: `Regional`
   - **Region**: nearest practical region to app backend
4. Click **Create**.
5. Open the new Redis database.
6. Click **Details** tab.
7. Find **Endpoint** and **Password**.
8. Click **Connect** or **REST/TLS connection** section.
9. Copy the full TLS Redis URL (format like `rediss://default:<password>@<host>:<port>`).
10. In your `.env`, set:
    - `REDIS_URL="rediss://default:..."`

## Local Run

1. Copy env file:
   - `copy .env.example .env` (Windows)
2. Install dependencies:
   - `npm install`
3. Start local DB + Redis:
   - `docker compose up -d postgres redis`
4. Prisma client:
   - `npm run prisma:generate --workspace=api`
5. Run migrations:
   - `npm run prisma:migrate --workspace=api`
6. Seed admin + categories:
   - `npm run prisma:seed --workspace=api`
7. Start all apps (Turborepo) from the repo root:
   - `npm run dev`

Local URLs:
- Storefront: `http://localhost:3000`
- Merchant Portal: `http://localhost:3001`
- Admin Portal: `http://localhost:3002`
- API: `http://localhost:4000`

### Stop and restart local dev (after env or code changes)

- **One terminal (recommended):** press **Ctrl+C** in the same window where `npm run dev` (or `turbo dev`) is running. When all children stop, run `npm run dev` again from the repo root.
- **Many terminals / stuck processes (Windows):** use Task Manager to end stray `node.exe` processes, or close the terminal tabs, then start again with `npm run dev`.
- **Run apps separately (if you are not using Turborepo in one go):** start the API with `npm run dev --workspace=api`, then each Next app in its own terminal, for example `npm run dev --workspace=storefront` and the same for `merchant-portal` and `admin-portal`, matching the scripts in the root and each app’s `package.json`.

Restart the API and any Next app after changing `NEXT_PUBLIC_*` or other env, since values are read when the process starts.

## Production Deployment Assets

- Dockerfiles: `infra/docker`
- Reverse proxy template: `infra/nginx/sexxymarket.conf`
- Terraform baseline: `infra/terraform`
- CI workflow: `.github/workflows/ci.yml`

## Security Baseline Included

- Input validation + whitelist blocking
- JWT auth + RBAC guards
- Security headers (`helmet`)
- Rate limiting
- Password hashing with Argon2
- Payment webhook signature verification
- Order paid-state checks (status + amount + currency + reference)

## Commission Recommendation

10% is a fair launch rate. For long-term merchant retention, use tiered commissions as volume grows.

## Product Configuration v2 (Options + Variants + Media Upload)

The product system now supports configurable option groups and structured variant combinations for professional catalog operations.

### Admin authoring model

- Option groups define selection axes such as `Color`, `Size`, `Dimension`, and `Pack`.
- Each option has values (for example `Red`, `White`, `Black` or `S`, `M`, `L`, `XL`).
- Variants are explicit combinations with:
  - `sku`
  - `extraPriceNgn`
  - `stock`
  - `isActive`
  - `selections[]` (`optionName` + `value`)
- Product-level variation guidance is supported via `variationGuide` and option-level guidance via `guideText`.

### Direct image upload flow (admin)

1. `POST /api/admin/uploads/product-image/init`
   - body: `{ fileName, mimeType?, sizeBytes? }`
   - returns `uploadUrl`, `publicUrl`, `key`, and upload headers.
2. Client uploads binary directly to `uploadUrl` (usually `PUT`).
3. `POST /api/admin/uploads/product-image/complete`
   - body: `{ key, fileName, mimeType?, sizeBytes?, altText? }`
   - returns canonical media metadata including final public URL.
4. Persist that media in product payload (`media[]`) when creating/updating products.

### Storefront variant behavior

- PDP supports option-group selection and resolves the active variant combination.
- Price and stock update dynamically based on variant (`base price + extraPriceNgn`).
- Cart lines are keyed by `productId + variantId`, so multiple variants of one product can coexist.
- Checkout/order payload sends `variantId` for each line item.

### Inventory policy

- For variant-based orders, stock is decremented from `ProductVariant.stock`.
- For non-variant lines, stock is decremented from `Product.stock`.
- This applies to storefront checkout and admin manual order paths for consistency.

### Migration / backward compatibility notes

- Existing products without option groups continue to work as default products.
- Legacy `label` variants are still accepted and rendered.
- New schema tables (`ProductOption`, `ProductOptionValue`, `ProductVariantValue`) are additive and designed for phased rollout.
