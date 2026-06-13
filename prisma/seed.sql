-- StationHub seed data (tương đương prisma/seed.ts)
-- Chạy trên Neon / PostgreSQL SAU KHI đã migrate schema.
--
-- Tài khoản:
--   trantuandoan04@gmail.com / Doandeptraivodichvutru  (ADMIN)
--
-- Neon SQL Editor hoặc: psql $DATABASE_URL -f prisma/seed.sql

BEGIN;

-- ── Gói subscription ─────────────────────────────────────────────────────────

INSERT INTO subscription_plans (
  id, name, "originalPriceVnd", "priceVnd", "durationDays", "maxAgents",
  description, "isActive", "isTrial", "createdAt", "updatedAt"
) VALUES (
  '00000000-0000-4000-a000-000000000000',
  'Dùng thử',
  0,
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
  "originalPriceVnd" = EXCLUDED."originalPriceVnd",
  "priceVnd" = EXCLUDED."priceVnd",
  "durationDays" = EXCLUDED."durationDays",
  "maxAgents" = EXCLUDED."maxAgents",
  description = EXCLUDED.description,
  "isActive" = EXCLUDED."isActive",
  "isTrial" = EXCLUDED."isTrial",
  "updatedAt" = NOW();

INSERT INTO subscription_plans (
  id, name, "originalPriceVnd", "priceVnd", "durationDays", "maxAgents",
  description, benefits, "isActive", "isTrial", "createdAt", "updatedAt"
) VALUES (
  '00000000-0000-4000-a000-000000000001',
  'Gói tháng',
  249000,
  199000,
  30,
  3,
  NULL,
  '["Automation đầy đủ","30 ngày sử dụng","Tối đa 3 agent đồng thời","Tự kích hoạt sau khi chuyển khoản"]'::jsonb,
  true,
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  "originalPriceVnd" = EXCLUDED."originalPriceVnd",
  "priceVnd" = EXCLUDED."priceVnd",
  "durationDays" = EXCLUDED."durationDays",
  "maxAgents" = EXCLUDED."maxAgents",
  description = EXCLUDED.description,
  benefits = EXCLUDED.benefits,
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
  'trantuandoan04@gmail.com',
  '$2b$10$O/PGPe8i4k9r7mGDc6NzJe5y8IzZZia6iA8xHP..gQCShsG60d2DG',
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
  password = EXCLUDED.password,
  role = 'ADMIN',
  "subscriptionStatus" = 'ACTIVE',
  "subscriptionExpiresAt" = '2099-12-31 23:59:59.000',
  "planId" = '00000000-0000-4000-a000-000000000001',
  "updatedAt" = NOW();

COMMIT;
