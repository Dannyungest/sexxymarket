# SexxyMarket Deployment and Domains Guide

This guide explains exactly how to deploy all services and connect every domain/subdomain.

## 1) Target Architecture

- `sexxymarket.com` -> Storefront (Vercel project: `apps/storefront`)
- `merchant.sexxymarket.com` -> Merchant Portal (Vercel project: `apps/merchant-portal`)
- `admin.sexxymarket.com` -> Admin Portal (Vercel project: `apps/admin-portal`)
- `api.sexxymarket.com` -> API (Railway service: `apps/api`)

## 2) Prerequisites

- GitHub repo with latest code pushed
- Domain purchased and DNS accessible (registrar DNS or Cloudflare DNS)
- Accounts created:
  - Vercel
  - Railway
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

## 7) Deploy API on Railway

1. Open [https://railway.app](https://railway.app)
2. Click **New Project** -> **Deploy from GitHub repo**
3. Select repository
4. Set service root to `apps/api`
5. Configure build/start:
   - Build command: `npm install && npm run build`
   - Start command: `npm run start:prod`
6. Add all required env vars in Railway service settings:
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
7. Deploy
8. Add custom domain in Railway: `api.sexxymarket.com`

## 8) DNS Setup (Important)

For each platform custom domain screen, copy the exact DNS values shown there and add them in your DNS provider.

Typical pattern:

- `@` (apex) -> Vercel A record (for `sexxymarket.com`)
- `www` -> CNAME to Vercel target
- `merchant` -> CNAME to Vercel target
- `admin` -> CNAME to Vercel target
- `api` -> CNAME to Railway target

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
- Confirm favicon/tab icon shows `sexxymarketlogo.PNG`
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
