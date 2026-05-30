-- Chrome profiles discovered per agent (sync from machine)
ALTER TABLE "agents" ADD COLUMN "chromeProfiles" JSONB;
