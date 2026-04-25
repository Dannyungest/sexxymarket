# Million-Scale Readiness Checklist (First Implementation Pass)

This checklist tracks engineering work required for sustained high traffic (up to and beyond 1M users/products/orders over time).

## 1) Completed in this pass

- API warm-up ping on initial visit for:
  - `apps/storefront`
  - `apps/admin-portal`
  - `apps/merchant-portal`
- Retry + timeout hardening already applied in API clients (storefront/admin).
- New cursor-based feed endpoint:
  - `GET /api/catalog/products/feed?cursor=<id>&limit=<n>&categoryId=<id>`
- Cursor/limit pagination for high-growth endpoints:
  - `GET /api/orders/me`
  - `GET /api/orders/admin/all`
  - `GET /api/merchant/orders`
  - `GET /api/merchant/pending`
- Queue-ready boundary introduced:
  - `BackgroundJobsService` for non-blocking background jobs.
  - Manual-order receipt + merchant notification dispatch moved to background.
- Prisma index hardening first pass:
  - Added indexes on `Order`, `OrderItem`, `Product`, `MerchantProfile`, `User` hot paths.
  - Migration: `apps/api/prisma/migrations/20260425073500_scale_indexes_first_pass/migration.sql`
- Load test starter suite (k6):
  - `scripts/load/catalog-spike.k6.js`
  - `scripts/load/checkout-burst.k6.js`
  - `scripts/load/webhook-burst.k6.js`

## 2) Next required work (high priority)

- Replace in-memory background dispatch with durable queue workers (BullMQ + Redis streams/queues).
- Make all expensive list endpoints cursor-based and remove unbounded legacy list responses.
- Add response caching for catalog read routes:
  - API-level cache key strategy (`catalog:feed:<params>`)
  - CDN cache headers (`s-maxage`, `stale-while-revalidate`) for anonymous reads.
- Introduce search engine for catalog at 1M+ products:
  - Meilisearch/OpenSearch/Elasticsearch.
- Add webhook idempotency table to guarantee exactly-once fulfillment side effects.

## 3) Infrastructure rollout steps

- API hosting:
  - Avoid sleeping tier for production API.
  - Enable autoscaling with min instances >= 1.
- Database:
  - Upgrade to production-tier Postgres.
  - Use connection pooling (already compatible with Neon pooler URLs).
  - Add read replicas once read pressure grows.
- Redis:
  - Use production Upstash/Redis tier with sufficient throughput and memory.
- CDN:
  - Put storefront and public catalog behind CDN with cache-control policy.

## 4) Observability + SLO

- Add dashboards for:
  - P95/P99 latency by endpoint
  - Error rate by endpoint
  - Queue depth and job failure rate
  - DB slow query count and connection saturation
- Alerting baseline:
  - API error rate > 2%
  - P95 latency > 1.5s (sustained)
  - Queue retry spikes
  - DB CPU/connection saturation thresholds

## 5) How to run load tests

Install [k6](https://k6.io/docs/get-started/installation/), then run:

- Catalog read spike:
  - `k6 run scripts/load/catalog-spike.k6.js -e BASE_URL=https://api.sexxymarket.com/api`
- Checkout burst:
  - `k6 run scripts/load/checkout-burst.k6.js -e BASE_URL=https://api.sexxymarket.com/api -e TEST_PRODUCT_ID=<approved_product_id>`
- Webhook burst:
  - `k6 run scripts/load/webhook-burst.k6.js -e BASE_URL=https://api.sexxymarket.com/api -e FLW_SIGNATURE=<secret_hash>`

## 6) Acceptance targets for "million-scale-ready" claim

- No unbounded list queries on critical surfaces.
- P95 API latency under target at expected peak load.
- Durable queue with retry and dead-letter strategy for side effects.
- Proven successful recovery/failover drills.
- Capacity test reports archived with thresholds met.
