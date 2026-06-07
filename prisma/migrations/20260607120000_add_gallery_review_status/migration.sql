ALTER TABLE "Gallery"
ADD COLUMN "status" "ContentStatus" NOT NULL DEFAULT 'draft',
ADD COLUMN "reviewNote" TEXT,
ADD COLUMN "reviewedBy" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3);

UPDATE "Gallery"
SET "status" = CASE
  WHEN "published" = true THEN 'published'::"ContentStatus"
  ELSE 'draft'::"ContentStatus"
END;

CREATE INDEX "Gallery_status_authorUid_idx" ON "Gallery" ("status", "authorUid");
CREATE INDEX "Gallery_status_updatedAt_idx" ON "Gallery" ("status", "updatedAt");
CREATE INDEX "Gallery_status_createdAt_idx" ON "Gallery" ("status", "createdAt" DESC);
