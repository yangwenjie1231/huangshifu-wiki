-- CreateMigration: 20260509000000_add_missing_location_fields
-- Description: Add missing location fields and other columns to Post, WikiPage, and Gallery tables
-- This migration fixes the error: "The column Gallery.locationDetail does not exist"
-- Generated: 2026-05-09

-- ============================================================================
-- 1. POST TABLE - Add missing columns
-- ============================================================================

-- Add musicDocId field (foreign key to MusicTrack)
ALTER TABLE "Post" ADD COLUMN "musicDocId" TEXT;

-- Add albumDocId field (foreign key to Album)
ALTER TABLE "Post" ADD COLUMN "albumDocId" TEXT;

-- Add locationCode field (foreign key to Region)
ALTER TABLE "Post" ADD COLUMN "locationCode" TEXT;

-- Add locationDetail field for detailed address/location info
ALTER TABLE "Post" ADD COLUMN "locationDetail" TEXT;

-- Add isPinned field for pinning posts
ALTER TABLE "Post" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- Add dislikesCount field
ALTER TABLE "Post" ADD COLUMN "dislikesCount" INTEGER NOT NULL DEFAULT 0;

-- Add parentId to PostComment for threaded comments
ALTER TABLE "PostComment" ADD COLUMN "galleryId" TEXT;

-- Create indexes for Post table
CREATE INDEX IF NOT EXISTS "Post_musicDocId_idx" ON "Post"("musicDocId");
CREATE INDEX IF NOT EXISTS "Post_albumDocId_idx" ON "Post"("albumDocId");
CREATE INDEX IF NOT EXISTS "Post_locationCode_idx" ON "Post"("locationCode");
CREATE INDEX IF NOT EXISTS "Post_isPinned_idx" ON "Post"("isPinned");

-- Add foreign key constraints for Post table
ALTER TABLE "Post" ADD CONSTRAINT "Post_musicDocId_fkey" FOREIGN KEY ("musicDocId") REFERENCES "MusicTrack"("docId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_albumDocId_fkey" FOREIGN KEY ("albumDocId") REFERENCES "Album"("docId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_locationCode_fkey" FOREIGN KEY ("locationCode") REFERENCES "Region"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign key constraint for PostComment -> Gallery
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create index for PostComment.galleryId
CREATE INDEX IF NOT EXISTS "PostComment_galleryId_idx" ON "PostComment"("galleryId");

-- ============================================================================
-- 2. WIKIPAGE TABLE - Add missing columns
-- ============================================================================

-- Add titleKey field for unique title identifier
ALTER TABLE "WikiPage" ADD COLUMN "titleKey" TEXT NOT NULL DEFAULT '';

-- Add locationCode field (foreign key to Region)
ALTER TABLE "WikiPage" ADD COLUMN "locationCode" TEXT;

-- Add locationDetail field for detailed address/location info
ALTER TABLE "WikiPage" ADD COLUMN "locationDetail" TEXT;

-- Add isPinned field for pinning wiki pages
ALTER TABLE "WikiPage" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- Add likesCount field
ALTER TABLE "WikiPage" ADD COLUMN "likesCount" INTEGER NOT NULL DEFAULT 0;

-- Add dislikesCount field
ALTER TABLE "WikiPage" ADD COLUMN "dislikesCount" INTEGER NOT NULL DEFAULT 0;

-- Add favoritesCount field
ALTER TABLE "WikiPage" ADD COLUMN "favoritesCount" INTEGER NOT NULL DEFAULT 0;

-- Create unique index for titleKey
CREATE UNIQUE INDEX IF NOT EXISTS "WikiPage_titleKey_key" ON "WikiPage"("titleKey");

-- Create indexes for WikiPage table
CREATE INDEX IF NOT EXISTS "WikiPage_locationCode_idx" ON "WikiPage"("locationCode");
CREATE INDEX IF NOT EXISTS "WikiPage_isPinned_idx" ON "WikiPage"("isPinned");

-- Add foreign key constraint for WikiPage -> Region
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_locationCode_fkey" FOREIGN KEY ("locationCode") REFERENCES "Region"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- 3. GALLERY TABLE - Add missing columns
-- ============================================================================

-- Add copyright field for image copyright information
ALTER TABLE "Gallery" ADD COLUMN "copyright" TEXT;

-- Add published field for publish/unpublish functionality
ALTER TABLE "Gallery" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;

-- Add publishedAt field for publication timestamp
ALTER TABLE "Gallery" ADD COLUMN "publishedAt" TIMESTAMP(3);

-- Add locationCode field (foreign key to Region)
ALTER TABLE "Gallery" ADD COLUMN "locationCode" TEXT;

-- Add locationDetail field for detailed address/location info
ALTER TABLE "Gallery" ADD COLUMN "locationDetail" TEXT;

-- Create indexes for Gallery table
CREATE INDEX IF NOT EXISTS "Gallery_published_idx" ON "Gallery"("published", "updatedAt");
CREATE INDEX IF NOT EXISTS "Gallery_authorUid_idx" ON "Gallery"("authorUid");
CREATE INDEX IF NOT EXISTS "Gallery_locationCode_idx" ON "Gallery"("locationCode");

-- Add foreign key constraint for Gallery -> Region
ALTER TABLE "Gallery" ADD CONSTRAINT "Gallery_locationCode_fkey" FOREIGN KEY ("locationCode") REFERENCES "Region"("code") ON DELETE SET NULL ON UPDATE CASCADE;
