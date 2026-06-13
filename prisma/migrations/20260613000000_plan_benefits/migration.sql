-- Quyền lợi tùy chỉnh theo gói (admin chỉnh, hiển thị Billing)
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "benefits" JSONB;
