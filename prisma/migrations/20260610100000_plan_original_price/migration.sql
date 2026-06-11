-- Giá gốc vs giá bán cho gói subscription
ALTER TABLE "subscription_plans" ADD COLUMN "originalPriceVnd" INTEGER;

UPDATE "subscription_plans" SET "originalPriceVnd" = "priceVnd" WHERE "originalPriceVnd" IS NULL;

ALTER TABLE "subscription_plans" ALTER COLUMN "originalPriceVnd" SET NOT NULL;
