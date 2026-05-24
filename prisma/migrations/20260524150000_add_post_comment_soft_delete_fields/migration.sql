-- Add soft-delete markers for threaded post/gallery comments
ALTER TABLE "PostComment"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT;

CREATE INDEX "PostComment_deletedAt_idx" ON "PostComment"("deletedAt");
