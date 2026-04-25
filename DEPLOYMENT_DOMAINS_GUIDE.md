# SexxyMarket Deployment and Domains Guide

This guide explains exactly how to deploy all services and connect every domain/subdomain.

## 1) Target Architecture

- `sexxymarket.com` -> Storefront (Vercel project: `apps/storefront`)
- `merchant.sexxymarket.com` -> Merchant Portal (Vercel project: `apps/merchant-portal`)
- `admin.sexxymarket.com` -> Admin Portal (Vercel project: `apps/admin-portal`)
- `api.sexxymarket.com` -> API (Render Web Service: `apps/api`)

## 2) Prerequisites

- GitHub repo with latest code pushed
- Domain purchased and DNS accessible (registrar DNS or Cloudflare DNS)
- Accounts created:
  - Vercel
  - Render
  - Neon (Postgres)
  - Upstash (Redis)
  - Flutterwave
  - Resend

## 3) Push Code First

From repo root:

```bash
git add .
git commit -m "Production hardening, metadata, icon, and deployment readiness"
git push
```

## 4) Deploy Storefront on Vercel

1. Open [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **Add New...** -> **Project**
3. Import your GitHub repo
4. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `apps/storefront`
5. Add environment variables:
   - `NEXT_PUBLIC_API_BASE_URL=https://api.sexxymarket.com`
   - `NEXT_PUBLIC_STOREFRONT_URL=https://sexxymarket.com`
6. Click **Deploy**
7. Open project -> **Settings** -> **Domains**
8. Add:
   - `sexxymarket.com`
   - `www.sexxymarket.com`

## 5) Deploy Merchant Portal on Vercel

1. Vercel Dashboard -> **Add New...** -> **Project**
2. Import same repo
3. **Root Directory:** `apps/merchant-portal`
4. Add env:
   - `NEXT_PUBLIC_API_BASE_URL=https://api.sexxymarket.com`
   - `NEXT_PUBLIC_STOREFRONT_URL=https://sexxymarket.com`
5. Deploy
6. Settings -> Domains -> add `merchant.sexxymarket.com`

## 6) Deploy Admin Portal on Vercel

1. Vercel Dashboard -> **Add New...** -> **Project**
2. Import same repo
3. **Root Directory:** `apps/admin-portal`
4. Add env:
   - `NEXT_PUBLIC_API_BASE_URL=https://api.sexxymarket.com`
5. Deploy
6. Settings -> Domains -> add `admin.sexxymarket.com`

## 7) Deploy API on Render (Detailed)

### A. Create the Render service

1. Open [https://dashboard.render.com](https://dashboard.render.com)
2. Click **New +** -> **Web Service**
3. Connect your GitHub account and select your repository
4. Configure service:
   - **Name:** `sexxymarket-api` (or your preferred name)
   - **Region:** choose closest to your customers (for example Frankfurt/London)
   - **Branch:** `main`
   - **Root Directory:** `apps/api`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start:prod`
5. Pick plan:
   - For serious production: use an always-on paid plan (recommended)
   - Free plan sleeps after inactivity and causes cold starts

### B. Add environment variables in Render

Open the service -> **Environment** and add:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `SESSION_SECRET`
- `FLUTTERWAVE_SECRET_KEY`
- `FLUTTERWAVE_PUBLIC_KEY`
- `FLUTTERWAVE_ENCRYPTION_KEY`
- `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
- `FLUTTERWAVE_REDIRECT_URL=https://sexxymarket.com/order/complete`
- `FLUTTERWAVE_API_BASE_URL=https://api.flutterwave.com`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `STOREFRONT_URL=https://sexxymarket.com`
- `NEXT_PUBLIC_STOREFRONT_URL=https://sexxymarket.com`
- `MERCHANT_PORTAL_URL=https://merchant.sexxymarket.com`
- `ADMIN_PORTAL_URL=https://admin.sexxymarket.com`
- `R2_PUBLIC_BASE_URL` (if used)
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

After saving variables, click **Manual Deploy** -> **Deploy latest commit**.

### C. Confirm service is healthy

1. Open the generated Render URL (something like `https://sexxymarket-api.onrender.com`)
2. Check root health response:
   - Should return JSON with service status
3. In Render -> **Logs**, confirm successful startup (no crash loop)

### D. Add production custom domain

1. Render service -> **Settings** -> **Custom Domains**
2. Click **Add Custom Domain**
3. Enter: `api.sexxymarket.com`
4. Render will show a target CNAME (example: `xxxxx.onrender.com`)
5. Add that CNAME in your DNS provider for host `api`
6. Wait for Render TLS certificate to become active

### E. (Optional but recommended) Seed admin user once

From Render **Shell** (or one-off job equivalent), run from `apps/api` context:

```bash
npm run prisma:seed
```

Use this once after confirming `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are set correctly.

### F. Production notes for Render

- Keep one always-on instance for stable login/checkout UX
- Monitor logs during first real payments and webhook callbacks
- If you stay on sleeping/free plans, cold starts are expected

## 8) DNS Setup (Important)

For each platform custom domain screen, copy the exact DNS values shown there and add them in your DNS provider.

Typical pattern:

- `@` (apex) -> Vercel A record (for `sexxymarket.com`)
- `www` -> CNAME to Vercel target
- `merchant` -> CNAME to Vercel target
- `admin` -> CNAME to Vercel target
- `api` -> CNAME to Render target

If DNS already has conflicting records for the same host (for example old `A` + new `CNAME` for `merchant`), remove conflicts.

## 9) Flutterwave Setup

In Flutterwave dashboard:

1. Go to **Settings** -> **Webhooks**
2. Webhook URL:
   - `https://api.sexxymarket.com/api/payments/webhooks/flutterwave`
3. Secret hash:
   - Must exactly match `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
4. Save

## 10) Post-Deploy Validation Checklist

- Open:
  - `https://sexxymarket.com`
  - `https://merchant.sexxymarket.com`
  - `https://admin.sexxymarket.com`
  - `https://api.sexxymarket.com/api` (or health endpoint)
- Confirm favicon/tab icon shows `sexxymarketlogo.png`
- Share storefront URL in WhatsApp/Telegram and verify preview metadata
- Run one real payment:
  - Checkout -> Flutterwave -> redirect to `/order/complete`
  - Receipt page loads
  - Customer receipt email arrives
  - Merchants with purchased lines receive merchant email with delivery details

## 11) Troubleshooting

### Browser still shows old icon

- Hard refresh: `Ctrl + F5`
- Open in private window
- Wait for new deploy to finish
- Clear browser site data for the domain

### `ERR_CONNECTION_REFUSED` to `localhost:4000`

- API is not running locally. Start API:
  - `cd apps/api`
  - `npm run dev`
- Confirm env:
  - `NEXT_PUBLIC_API_BASE_URL` is correct for current environment.

### Storefront can load but products are empty

- Check API logs
- Verify CORS settings and API URL
- Confirm DB is reachable from API runtime
