-- StationHub seed data (tương đương prisma/seed.ts)
-- Chạy trên Neon / PostgreSQL SAU KHI đã migrate schema.
--
-- Tài khoản:
--   admin@stationhub.com / admin123  (ADMIN)
--   user@stationhub.com  / user123   (USER trial)
--
-- Neon SQL Editor hoặc: psql $DATABASE_URL -f prisma/seed.sql

BEGIN;

-- ── Gói subscription ─────────────────────────────────────────────────────────

INSERT INTO subscription_plans (
  id, name, "priceVnd", "durationDays", "maxAgents",
  description, "isActive", "isTrial", "createdAt", "updatedAt"
) VALUES (
  '00000000-0000-4000-a000-000000000000',
  'Dùng thử',
  0,
  7,
  1,
  'Gói dùng thử miễn phí khi đăng ký tài khoản',
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  "priceVnd" = EXCLUDED."priceVnd",
  "durationDays" = EXCLUDED."durationDays",
  "maxAgents" = EXCLUDED."maxAgents",
  description = EXCLUDED.description,
  "isActive" = EXCLUDED."isActive",
  "isTrial" = EXCLUDED."isTrial",
  "updatedAt" = NOW();

INSERT INTO subscription_plans (
  id, name, "priceVnd", "durationDays", "maxAgents",
  description, "isActive", "isTrial", "createdAt", "updatedAt"
) VALUES (
  '00000000-0000-4000-a000-000000000001',
  'Gói tháng',
  199000,
  30,
  3,
  'Automation đầy đủ — tối đa 3 agent',
  true,
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  "priceVnd" = EXCLUDED."priceVnd",
  "durationDays" = EXCLUDED."durationDays",
  "maxAgents" = EXCLUDED."maxAgents",
  description = EXCLUDED.description,
  "isActive" = EXCLUDED."isActive",
  "isTrial" = EXCLUDED."isTrial",
  "updatedAt" = NOW();

-- Migrate legacy plan id (nếu DB cũ còn default-monthly-plan)
UPDATE users
SET "planId" = '00000000-0000-4000-a000-000000000001'
WHERE "planId" = 'default-monthly-plan';

UPDATE payments
SET "planId" = '00000000-0000-4000-a000-000000000001'
WHERE "planId" = 'default-monthly-plan';

DELETE FROM subscription_plans
WHERE id = 'default-monthly-plan';

-- ── Users (bcrypt cost 10 — khớp seed.ts) ────────────────────────────────────

INSERT INTO users (
  id,
  email,
  password,
  name,
  role,
  "isActive",
  "subscriptionStatus",
  "subscriptionExpiresAt",
  "planId",
  "trialUsedAt",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'admin@stationhub.com',
  '$2b$10$0LByxZzQtf4/ZV19inPZhOJom7v30qo7.zItSBywPV5M1/wSSRSoW',
  'Admin',
  'ADMIN',
  true,
  'ACTIVE',
  '2099-12-31 23:59:59.000',
  '00000000-0000-4000-a000-000000000001',
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  role = 'ADMIN',
  "subscriptionStatus" = 'ACTIVE',
  "subscriptionExpiresAt" = '2099-12-31 23:59:59.000',
  "planId" = '00000000-0000-4000-a000-000000000001',
  "updatedAt" = NOW();

INSERT INTO users (
  id,
  email,
  password,
  name,
  role,
  "isActive",
  "subscriptionStatus",
  "subscriptionExpiresAt",
  "planId",
  "trialUsedAt",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'user@stationhub.com',
  '$2b$10$Y0N6tVbwf6pFOrOI/YvBc.uhrKPtakbPwOiB9ibvsvLN/IukF5t8e',
  'Demo User',
  'USER',
  true,
  'TRIAL',
  NOW() + INTERVAL '7 days',
  '00000000-0000-4000-a000-000000000000',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  "planId" = '00000000-0000-4000-a000-000000000000',
  "updatedAt" = NOW();

COMMIT;
