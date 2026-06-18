-- Whitelist chat/user Telegram cho từng bot
ALTER TABLE "telegram_bots" ADD COLUMN "allowedChatIds" JSONB;
ALTER TABLE "telegram_bots" ADD COLUMN "allowedUserIds" JSONB;
