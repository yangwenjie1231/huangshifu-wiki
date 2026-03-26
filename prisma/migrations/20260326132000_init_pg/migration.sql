-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin', 'super_admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'banned');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('draft', 'pending', 'published', 'rejected');

-- CreateEnum
CREATE TYPE "ModerationTargetType" AS ENUM ('wiki', 'post');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('submit', 'approve', 'reject', 'rollback');

-- CreateEnum
CREATE TYPE "FavoriteTargetType" AS ENUM ('wiki', 'post', 'music');

-- CreateEnum
CREATE TYPE "UserBanAction" AS ENUM ('ban', 'unban');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('reply', 'like', 'review_result');

-- CreateEnum
CREATE TYPE "BrowsingTargetType" AS ENUM ('wiki', 'post', 'music');

-- CreateEnum
CREATE TYPE "UploadSessionStatus" AS ENUM ('open', 'finalized', 'expired');

-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('uploaded', 'ready', 'deleted');

-- CreateEnum
CREATE TYPE "EmbeddingStatus" AS ENUM ('pending', 'processing', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "MusicPlatform" AS ENUM ('netease', 'tencent', 'kugou', 'baidu', 'kuwo');

-- CreateEnum
CREATE TYPE "DisplayAlbumMode" AS ENUM ('none', 'linked', 'manual');

-- CreateEnum
CREATE TYPE "MusicCollectionType" AS ENUM ('album', 'playlist');

-- CreateEnum
CREATE TYPE "WikiBranchStatus" AS ENUM ('draft', 'pending_review', 'merged', 'rejected', 'conflict');

-- CreateEnum
CREATE TYPE "WikiPullRequestStatus" AS ENUM ('open', 'merged', 'rejected');

-- CreateTable
CREATE TABLE "User" (
    "uid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "photoURL" TEXT,
    "wechatOpenId" TEXT,
    "wechatUnionId" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "banReason" TEXT,
    "bannedAt" TIMESTAMP(3),
    "level" INTEGER NOT NULL DEFAULT 1,
    "bio" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("uid")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" JSONB,
    "authorUid" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'published',
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "hotScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorUid" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorPhoto" TEXT,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" JSONB,
    "relations" JSONB,
    "eventDate" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'published',
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "favoritesCount" INTEGER NOT NULL DEFAULT 0,
    "lastEditorUid" TEXT NOT NULL,
    "lastEditorName" TEXT NOT NULL,
    "mainBranchId" TEXT,
    "mergedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userUid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userUid" TEXT NOT NULL,
    "targetType" "FavoriteTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "targetType" "ModerationTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" "ModerationAction" NOT NULL,
    "operatorUid" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBanLog" (
    "id" TEXT NOT NULL,
    "targetUid" TEXT NOT NULL,
    "action" "UserBanAction" NOT NULL,
    "operatorUid" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBanLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiRevision" (
    "id" TEXT NOT NULL,
    "pageSlug" TEXT NOT NULL,
    "branchId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "slug" TEXT,
    "category" TEXT,
    "tags" JSONB,
    "relations" JSONB,
    "eventDate" TEXT,
    "editorUid" TEXT NOT NULL,
    "editorName" TEXT NOT NULL,
    "isAutoSave" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiBranch" (
    "id" TEXT NOT NULL,
    "pageSlug" TEXT NOT NULL,
    "editorUid" TEXT NOT NULL,
    "editorName" TEXT NOT NULL,
    "status" "WikiBranchStatus" NOT NULL DEFAULT 'draft',
    "latestRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiPullRequest" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "pageSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "WikiPullRequestStatus" NOT NULL DEFAULT 'open',
    "createdByUid" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "mergedAt" TIMESTAMP(3),
    "baseRevisionId" TEXT,
    "conflictData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiPullRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiPullRequestComment" (
    "id" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "authorUid" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiPullRequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "link" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gallery" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "authorUid" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "tags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gallery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadSession" (
    "id" TEXT NOT NULL,
    "ownerUid" TEXT NOT NULL,
    "status" "UploadSessionStatus" NOT NULL DEFAULT 'open',
    "maxFiles" INTEGER NOT NULL DEFAULT 50,
    "uploadedFiles" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "ownerUid" TEXT NOT NULL,
    "sessionId" TEXT,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'ready',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryImage" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "assetId" TEXT,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GalleryImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageEmbedding" (
    "id" TEXT NOT NULL,
    "galleryImageId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL DEFAULT 'Xenova/clip-vit-base-patch32',
    "vectorSize" INTEGER NOT NULL DEFAULT 512,
    "status" "EmbeddingStatus" NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "embeddedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Album" (
    "docId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "resourceType" "MusicCollectionType" NOT NULL DEFAULT 'album',
    "platform" "MusicPlatform" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "cover" TEXT NOT NULL,
    "description" TEXT,
    "platformUrl" TEXT,
    "tracks" JSONB,
    "defaultCoverSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("docId")
);

-- CreateTable
CREATE TABLE "MusicTrack" (
    "docId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "album" TEXT NOT NULL DEFAULT '',
    "cover" TEXT NOT NULL DEFAULT '',
    "audioUrl" TEXT NOT NULL DEFAULT '',
    "lyric" TEXT,
    "primaryPlatform" "MusicPlatform" NOT NULL DEFAULT 'netease',
    "enabledPlatform" "MusicPlatform",
    "neteaseId" TEXT,
    "tencentId" TEXT,
    "kugouId" TEXT,
    "baiduId" TEXT,
    "kuwoId" TEXT,
    "displayAlbumMode" "DisplayAlbumMode" NOT NULL DEFAULT 'linked',
    "manualAlbumName" TEXT,
    "defaultCoverSource" TEXT,
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicTrack_pkey" PRIMARY KEY ("docId")
);

-- CreateTable
CREATE TABLE "SongCover" (
    "id" TEXT NOT NULL,
    "songDocId" TEXT NOT NULL,
    "assetId" TEXT,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongCover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumCover" (
    "id" TEXT NOT NULL,
    "albumDocId" TEXT NOT NULL,
    "assetId" TEXT,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumCover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongAlbumRelation" (
    "id" TEXT NOT NULL,
    "songDocId" TEXT NOT NULL,
    "albumDocId" TEXT NOT NULL,
    "discNumber" INTEGER NOT NULL DEFAULT 1,
    "trackOrder" INTEGER NOT NULL DEFAULT 0,
    "isDisplay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongAlbumRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongInstrumentalRelation" (
    "id" TEXT NOT NULL,
    "songDocId" TEXT NOT NULL,
    "targetSongDocId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongInstrumentalRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageMap" (
    "id" TEXT NOT NULL,
    "md5" TEXT NOT NULL,
    "localUrl" TEXT NOT NULL,
    "weiboUrl" TEXT,
    "smmsUrl" TEXT,
    "superbedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userUid" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowsingHistory" (
    "id" TEXT NOT NULL,
    "userUid" TEXT NOT NULL,
    "targetType" "BrowsingTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowsingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchKeyword" (
    "keyword" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchKeyword_pkey" PRIMARY KEY ("keyword")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_wechatOpenId_key" ON "User"("wechatOpenId");

-- CreateIndex
CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");

-- CreateIndex
CREATE INDEX "User_wechatUnionId_idx" ON "User"("wechatUnionId");

-- CreateIndex
CREATE INDEX "Section_createdAt_idx" ON "Section"("createdAt");

-- CreateIndex
CREATE INDEX "Post_section_idx" ON "Post"("section");

-- CreateIndex
CREATE INDEX "Post_status_updatedAt_idx" ON "Post"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Post_updatedAt_idx" ON "Post"("updatedAt");

-- CreateIndex
CREATE INDEX "Post_hotScore_updatedAt_idx" ON "Post"("hotScore", "updatedAt");

-- CreateIndex
CREATE INDEX "PostComment_postId_createdAt_idx" ON "PostComment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "PostComment_parentId_idx" ON "PostComment"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiPage_slug_key" ON "WikiPage"("slug");

-- CreateIndex
CREATE INDEX "WikiPage_category_updatedAt_idx" ON "WikiPage"("category", "updatedAt");

-- CreateIndex
CREATE INDEX "WikiPage_status_updatedAt_idx" ON "WikiPage"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "WikiPage_eventDate_idx" ON "WikiPage"("eventDate");

-- CreateIndex
CREATE INDEX "WikiPage_mainBranchId_idx" ON "WikiPage"("mainBranchId");

-- CreateIndex
CREATE INDEX "PostLike_userUid_createdAt_idx" ON "PostLike"("userUid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostLike_postId_userUid_key" ON "PostLike"("postId", "userUid");

-- CreateIndex
CREATE INDEX "Favorite_targetType_targetId_idx" ON "Favorite"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Favorite_userUid_createdAt_idx" ON "Favorite"("userUid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userUid_targetType_targetId_key" ON "Favorite"("userUid", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "ModerationLog_targetType_targetId_createdAt_idx" ON "ModerationLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationLog_operatorUid_createdAt_idx" ON "ModerationLog"("operatorUid", "createdAt");

-- CreateIndex
CREATE INDEX "UserBanLog_targetUid_createdAt_idx" ON "UserBanLog"("targetUid", "createdAt");

-- CreateIndex
CREATE INDEX "UserBanLog_operatorUid_createdAt_idx" ON "UserBanLog"("operatorUid", "createdAt");

-- CreateIndex
CREATE INDEX "WikiRevision_pageSlug_createdAt_idx" ON "WikiRevision"("pageSlug", "createdAt");

-- CreateIndex
CREATE INDEX "WikiRevision_branchId_createdAt_idx" ON "WikiRevision"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "WikiBranch_pageSlug_status_idx" ON "WikiBranch"("pageSlug", "status");

-- CreateIndex
CREATE INDEX "WikiBranch_editorUid_idx" ON "WikiBranch"("editorUid");

-- CreateIndex
CREATE UNIQUE INDEX "WikiBranch_pageSlug_editorUid_key" ON "WikiBranch"("pageSlug", "editorUid");

-- CreateIndex
CREATE INDEX "WikiPullRequest_status_createdAt_idx" ON "WikiPullRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WikiPullRequest_pageSlug_status_idx" ON "WikiPullRequest"("pageSlug", "status");

-- CreateIndex
CREATE INDEX "WikiPullRequest_createdByUid_createdAt_idx" ON "WikiPullRequest"("createdByUid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WikiPullRequest_branchId_key" ON "WikiPullRequest"("branchId");

-- CreateIndex
CREATE INDEX "WikiPullRequestComment_prId_createdAt_idx" ON "WikiPullRequestComment"("prId", "createdAt");

-- CreateIndex
CREATE INDEX "WikiPullRequestComment_authorUid_createdAt_idx" ON "WikiPullRequestComment"("authorUid", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_active_createdAt_idx" ON "Announcement"("active", "createdAt");

-- CreateIndex
CREATE INDEX "Gallery_createdAt_idx" ON "Gallery"("createdAt");

-- CreateIndex
CREATE INDEX "UploadSession_ownerUid_status_expiresAt_idx" ON "UploadSession"("ownerUid", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_ownerUid_createdAt_idx" ON "MediaAsset"("ownerUid", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_sessionId_idx" ON "MediaAsset"("sessionId");

-- CreateIndex
CREATE INDEX "GalleryImage_galleryId_sortOrder_idx" ON "GalleryImage"("galleryId", "sortOrder");

-- CreateIndex
CREATE INDEX "GalleryImage_assetId_idx" ON "GalleryImage"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageEmbedding_galleryImageId_key" ON "ImageEmbedding"("galleryImageId");

-- CreateIndex
CREATE INDEX "ImageEmbedding_status_updatedAt_idx" ON "ImageEmbedding"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Album_id_key" ON "Album"("id");

-- CreateIndex
CREATE INDEX "Album_title_idx" ON "Album"("title");

-- CreateIndex
CREATE INDEX "Album_artist_idx" ON "Album"("artist");

-- CreateIndex
CREATE INDEX "Album_createdAt_idx" ON "Album"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Album_platform_sourceId_resourceType_key" ON "Album"("platform", "sourceId", "resourceType");

-- CreateIndex
CREATE UNIQUE INDEX "MusicTrack_id_key" ON "MusicTrack"("id");

-- CreateIndex
CREATE INDEX "MusicTrack_primaryPlatform_idx" ON "MusicTrack"("primaryPlatform");

-- CreateIndex
CREATE INDEX "MusicTrack_enabledPlatform_idx" ON "MusicTrack"("enabledPlatform");

-- CreateIndex
CREATE INDEX "MusicTrack_neteaseId_idx" ON "MusicTrack"("neteaseId");

-- CreateIndex
CREATE INDEX "MusicTrack_tencentId_idx" ON "MusicTrack"("tencentId");

-- CreateIndex
CREATE INDEX "MusicTrack_kugouId_idx" ON "MusicTrack"("kugouId");

-- CreateIndex
CREATE INDEX "MusicTrack_baiduId_idx" ON "MusicTrack"("baiduId");

-- CreateIndex
CREATE INDEX "MusicTrack_kuwoId_idx" ON "MusicTrack"("kuwoId");

-- CreateIndex
CREATE INDEX "MusicTrack_createdAt_idx" ON "MusicTrack"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SongCover_storageKey_key" ON "SongCover"("storageKey");

-- CreateIndex
CREATE INDEX "SongCover_songDocId_sortOrder_idx" ON "SongCover"("songDocId", "sortOrder");

-- CreateIndex
CREATE INDEX "SongCover_assetId_idx" ON "SongCover"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumCover_storageKey_key" ON "AlbumCover"("storageKey");

-- CreateIndex
CREATE INDEX "AlbumCover_albumDocId_sortOrder_idx" ON "AlbumCover"("albumDocId", "sortOrder");

-- CreateIndex
CREATE INDEX "AlbumCover_assetId_idx" ON "AlbumCover"("assetId");

-- CreateIndex
CREATE INDEX "SongAlbumRelation_albumDocId_discNumber_trackOrder_idx" ON "SongAlbumRelation"("albumDocId", "discNumber", "trackOrder");

-- CreateIndex
CREATE INDEX "SongAlbumRelation_songDocId_idx" ON "SongAlbumRelation"("songDocId");

-- CreateIndex
CREATE UNIQUE INDEX "SongAlbumRelation_songDocId_albumDocId_key" ON "SongAlbumRelation"("songDocId", "albumDocId");

-- CreateIndex
CREATE INDEX "SongInstrumentalRelation_targetSongDocId_idx" ON "SongInstrumentalRelation"("targetSongDocId");

-- CreateIndex
CREATE UNIQUE INDEX "SongInstrumentalRelation_songDocId_targetSongDocId_key" ON "SongInstrumentalRelation"("songDocId", "targetSongDocId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageMap_md5_key" ON "ImageMap"("md5");

-- CreateIndex
CREATE INDEX "Notification_userUid_isRead_createdAt_idx" ON "Notification"("userUid", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userUid_createdAt_idx" ON "Notification"("userUid", "createdAt");

-- CreateIndex
CREATE INDEX "BrowsingHistory_userUid_createdAt_idx" ON "BrowsingHistory"("userUid", "createdAt");

-- CreateIndex
CREATE INDEX "BrowsingHistory_userUid_targetType_createdAt_idx" ON "BrowsingHistory"("userUid", "targetType", "createdAt");

-- CreateIndex
CREATE INDEX "BrowsingHistory_targetType_targetId_createdAt_idx" ON "BrowsingHistory"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchKeyword_count_updatedAt_idx" ON "SearchKeyword"("count", "updatedAt");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_section_fkey" FOREIGN KEY ("section") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorUid_fkey" FOREIGN KEY ("authorUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_authorUid_fkey" FOREIGN KEY ("authorUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_lastEditorUid_fkey" FOREIGN KEY ("lastEditorUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userUid_fkey" FOREIGN KEY ("userUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userUid_fkey" FOREIGN KEY ("userUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_operatorUid_fkey" FOREIGN KEY ("operatorUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBanLog" ADD CONSTRAINT "UserBanLog_targetUid_fkey" FOREIGN KEY ("targetUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBanLog" ADD CONSTRAINT "UserBanLog_operatorUid_fkey" FOREIGN KEY ("operatorUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiRevision" ADD CONSTRAINT "WikiRevision_pageSlug_fkey" FOREIGN KEY ("pageSlug") REFERENCES "WikiPage"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiRevision" ADD CONSTRAINT "WikiRevision_editorUid_fkey" FOREIGN KEY ("editorUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiRevision" ADD CONSTRAINT "WikiRevision_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "WikiBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiBranch" ADD CONSTRAINT "WikiBranch_pageSlug_fkey" FOREIGN KEY ("pageSlug") REFERENCES "WikiPage"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiBranch" ADD CONSTRAINT "WikiBranch_editorUid_fkey" FOREIGN KEY ("editorUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPullRequest" ADD CONSTRAINT "WikiPullRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "WikiBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPullRequest" ADD CONSTRAINT "WikiPullRequest_pageSlug_fkey" FOREIGN KEY ("pageSlug") REFERENCES "WikiPage"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPullRequest" ADD CONSTRAINT "WikiPullRequest_createdByUid_fkey" FOREIGN KEY ("createdByUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPullRequest" ADD CONSTRAINT "WikiPullRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("uid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPullRequestComment" ADD CONSTRAINT "WikiPullRequestComment_prId_fkey" FOREIGN KEY ("prId") REFERENCES "WikiPullRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPullRequestComment" ADD CONSTRAINT "WikiPullRequestComment_authorUid_fkey" FOREIGN KEY ("authorUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gallery" ADD CONSTRAINT "Gallery_authorUid_fkey" FOREIGN KEY ("authorUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_ownerUid_fkey" FOREIGN KEY ("ownerUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerUid_fkey" FOREIGN KEY ("ownerUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "UploadSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryImage" ADD CONSTRAINT "GalleryImage_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryImage" ADD CONSTRAINT "GalleryImage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageEmbedding" ADD CONSTRAINT "ImageEmbedding_galleryImageId_fkey" FOREIGN KEY ("galleryImageId") REFERENCES "GalleryImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicTrack" ADD CONSTRAINT "MusicTrack_addedBy_fkey" FOREIGN KEY ("addedBy") REFERENCES "User"("uid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongCover" ADD CONSTRAINT "SongCover_songDocId_fkey" FOREIGN KEY ("songDocId") REFERENCES "MusicTrack"("docId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongCover" ADD CONSTRAINT "SongCover_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumCover" ADD CONSTRAINT "AlbumCover_albumDocId_fkey" FOREIGN KEY ("albumDocId") REFERENCES "Album"("docId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumCover" ADD CONSTRAINT "AlbumCover_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongAlbumRelation" ADD CONSTRAINT "SongAlbumRelation_songDocId_fkey" FOREIGN KEY ("songDocId") REFERENCES "MusicTrack"("docId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongAlbumRelation" ADD CONSTRAINT "SongAlbumRelation_albumDocId_fkey" FOREIGN KEY ("albumDocId") REFERENCES "Album"("docId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongInstrumentalRelation" ADD CONSTRAINT "SongInstrumentalRelation_songDocId_fkey" FOREIGN KEY ("songDocId") REFERENCES "MusicTrack"("docId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongInstrumentalRelation" ADD CONSTRAINT "SongInstrumentalRelation_targetSongDocId_fkey" FOREIGN KEY ("targetSongDocId") REFERENCES "MusicTrack"("docId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userUid_fkey" FOREIGN KEY ("userUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowsingHistory" ADD CONSTRAINT "BrowsingHistory_userUid_fkey" FOREIGN KEY ("userUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;
