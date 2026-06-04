ALTER TABLE "User"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT;

ALTER TABLE "Section"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT;

ALTER TABLE "Post"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT;

ALTER TABLE "WikiPage"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT;

ALTER TABLE "Announcement"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT;

ALTER TABLE "Gallery"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT;

ALTER TABLE "Album"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT;

ALTER TABLE "MusicTrack"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT;

ALTER TABLE "ImageMap"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT;

CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX "Section_deletedAt_idx" ON "Section"("deletedAt");
CREATE INDEX "Post_deletedAt_idx" ON "Post"("deletedAt");
CREATE INDEX "WikiPage_deletedAt_idx" ON "WikiPage"("deletedAt");
CREATE INDEX "Announcement_deletedAt_idx" ON "Announcement"("deletedAt");
CREATE INDEX "Gallery_deletedAt_idx" ON "Gallery"("deletedAt");
CREATE INDEX "Album_deletedAt_idx" ON "Album"("deletedAt");
CREATE INDEX "MusicTrack_deletedAt_idx" ON "MusicTrack"("deletedAt");
CREATE INDEX "ImageMap_deletedAt_idx" ON "ImageMap"("deletedAt");
