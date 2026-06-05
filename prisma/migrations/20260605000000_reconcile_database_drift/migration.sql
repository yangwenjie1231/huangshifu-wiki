-- Reconcile objects that exist in the current database but were missing from
-- the replayable migration history. Keep this migration idempotent so existing
-- databases can mark it applied without data loss.

CREATE TABLE IF NOT EXISTS "Region" (
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "depth" INTEGER,
  "parentCode" TEXT,
  "path" TEXT,
  "type" TEXT,
  "year" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "Region_pkey" PRIMARY KEY ("code")
);

CREATE INDEX IF NOT EXISTS "Region_parentCode_idx" ON "Region"("parentCode");
CREATE INDEX IF NOT EXISTS "Region_level_idx" ON "Region"("level");
CREATE INDEX IF NOT EXISTS "Region_name_idx" ON "Region"("name");
CREATE INDEX IF NOT EXISTS "Region_fullName_idx" ON "Region"("fullName");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Region_parentCode_fkey'
  ) THEN
    ALTER TABLE "Region"
    ADD CONSTRAINT "Region_parentCode_fkey"
    FOREIGN KEY ("parentCode") REFERENCES "Region"("code")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "EditLock" (
  "id" TEXT NOT NULL,
  "collection" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EditLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EditLock_collection_recordId_key"
  ON "EditLock"("collection", "recordId");
CREATE INDEX IF NOT EXISTS "EditLock_userId_idx" ON "EditLock"("userId");
CREATE INDEX IF NOT EXISTS "EditLock_expiresAt_idx" ON "EditLock"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EditLock_userId_fkey'
  ) THEN
    ALTER TABLE "EditLock"
    ADD CONSTRAINT "EditLock_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("uid")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "MusicPlatformConfig" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "urlPattern" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT 'gray',
  "bgColor" TEXT NOT NULL DEFAULT 'gray-100',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MusicPlatformConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MusicPlatformConfig_key_key"
  ON "MusicPlatformConfig"("key");
CREATE INDEX IF NOT EXISTS "MusicPlatformConfig_key_idx" ON "MusicPlatformConfig"("key");
CREATE INDEX IF NOT EXISTS "MusicPlatformConfig_sortOrder_idx"
  ON "MusicPlatformConfig"("sortOrder");

ALTER TABLE "MusicTrack"
ADD COLUMN IF NOT EXISTS "customPlatformIds" JSONB;

CREATE INDEX IF NOT EXISTS "Post_musicDocId_updatedAt_idx"
  ON "Post"("musicDocId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Post_albumDocId_updatedAt_idx"
  ON "Post"("albumDocId", "updatedAt");
CREATE INDEX IF NOT EXISTS "PostComment_galleryId_createdAt_idx"
  ON "PostComment"("galleryId", "createdAt");
CREATE INDEX IF NOT EXISTS "Favorite_userUid_targetType_idx"
  ON "Favorite"("userUid", "targetType");
CREATE INDEX IF NOT EXISTS "Post_section_status_idx"
  ON "Post"("section", "status");
CREATE INDEX IF NOT EXISTS "Post_status_authorUid_idx"
  ON "Post"("status", "authorUid");
CREATE INDEX IF NOT EXISTS "Post_createdAt_idx"
  ON "Post"("createdAt");
CREATE INDEX IF NOT EXISTS "PostLike_userUid_postId_idx"
  ON "PostLike"("userUid", "postId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Post_locationCode_fkey'
  ) THEN
    ALTER TABLE "Post"
    ADD CONSTRAINT "Post_locationCode_fkey"
    FOREIGN KEY ("locationCode") REFERENCES "Region"("code")
    ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Gallery_locationCode_fkey'
  ) THEN
    ALTER TABLE "Gallery"
    ADD CONSTRAINT "Gallery_locationCode_fkey"
    FOREIGN KEY ("locationCode") REFERENCES "Region"("code")
    ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WikiPage_locationCode_fkey'
  ) THEN
    ALTER TABLE "WikiPage"
    ADD CONSTRAINT "WikiPage_locationCode_fkey"
    FOREIGN KEY ("locationCode") REFERENCES "Region"("code")
    ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;
END
$$;

ALTER TABLE "SiteConfig"
ALTER COLUMN "id" DROP DEFAULT;

ALTER TABLE "Region"
ALTER COLUMN "depth" DROP NOT NULL,
ALTER COLUMN "path" DROP NOT NULL;
