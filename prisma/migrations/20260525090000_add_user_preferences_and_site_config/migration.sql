ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "preferences" JSONB DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "SiteConfig" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SiteConfig_key_key" ON "SiteConfig"("key");
CREATE INDEX IF NOT EXISTS "SiteConfig_key_idx" ON "SiteConfig"("key");
