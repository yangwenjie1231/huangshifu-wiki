CREATE TABLE IF NOT EXISTS `User` (
  `uid` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `passwordHash` varchar(191) NOT NULL,
  `displayName` varchar(191) NOT NULL,
  `photoURL` varchar(191) DEFAULT NULL,
  `role` enum('user','admin','super_admin') NOT NULL DEFAULT 'user',
  `status` enum('active','banned') NOT NULL DEFAULT 'active',
  `banReason` text DEFAULT NULL,
  `bannedAt` datetime(3) DEFAULT NULL,
  `level` int NOT NULL DEFAULT 1,
  `bio` text NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `User_email_key` (`email`),
  KEY `User_status_createdAt_idx` (`status`,`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Section` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `description` varchar(191) NOT NULL DEFAULT '',
  `order` int NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `Section_createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Post` (
  `id` varchar(191) NOT NULL,
  `title` varchar(191) NOT NULL,
  `section` varchar(191) NOT NULL,
  `content` longtext NOT NULL,
  `tags` json DEFAULT NULL,
  `authorUid` varchar(191) NOT NULL,
  `status` enum('draft','pending','published','rejected') NOT NULL DEFAULT 'published',
  `reviewNote` text DEFAULT NULL,
  `reviewedBy` varchar(191) DEFAULT NULL,
  `reviewedAt` datetime(3) DEFAULT NULL,
  `hotScore` double NOT NULL DEFAULT 0,
  `viewCount` int NOT NULL DEFAULT 0,
  `likesCount` int NOT NULL DEFAULT 0,
  `commentsCount` int NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `Post_section_idx` (`section`),
  KEY `Post_status_updatedAt_idx` (`status`,`updatedAt`),
  KEY `Post_updatedAt_idx` (`updatedAt`),
  KEY `Post_hotScore_updatedAt_idx` (`hotScore`,`updatedAt`),
  CONSTRAINT `Post_authorUid_fkey` FOREIGN KEY (`authorUid`) REFERENCES `User` (`uid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Post_section_fkey` FOREIGN KEY (`section`) REFERENCES `Section` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PostComment` (
  `id` varchar(191) NOT NULL,
  `postId` varchar(191) NOT NULL,
  `authorUid` varchar(191) NOT NULL,
  `authorName` varchar(191) NOT NULL,
  `authorPhoto` varchar(191) DEFAULT NULL,
  `content` text NOT NULL,
  `parentId` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `PostComment_postId_createdAt_idx` (`postId`,`createdAt`),
  KEY `PostComment_parentId_idx` (`parentId`),
  CONSTRAINT `PostComment_authorUid_fkey` FOREIGN KEY (`authorUid`) REFERENCES `User` (`uid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PostComment_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `WikiPage` (
  `id` varchar(191) NOT NULL,
  `slug` varchar(191) NOT NULL,
  `title` varchar(191) NOT NULL,
  `category` varchar(191) NOT NULL,
  `content` longtext NOT NULL,
  `tags` json DEFAULT NULL,
  `eventDate` varchar(191) DEFAULT NULL,
  `status` enum('draft','pending','published','rejected') NOT NULL DEFAULT 'published',
  `reviewNote` text DEFAULT NULL,
  `reviewedBy` varchar(191) DEFAULT NULL,
  `reviewedAt` datetime(3) DEFAULT NULL,
  `viewCount` int NOT NULL DEFAULT 0,
  `favoritesCount` int NOT NULL DEFAULT 0,
  `lastEditorUid` varchar(191) NOT NULL,
  `lastEditorName` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `WikiPage_slug_key` (`slug`),
  KEY `WikiPage_category_updatedAt_idx` (`category`,`updatedAt`),
  KEY `WikiPage_status_updatedAt_idx` (`status`,`updatedAt`),
  KEY `WikiPage_eventDate_idx` (`eventDate`),
  CONSTRAINT `WikiPage_lastEditorUid_fkey` FOREIGN KEY (`lastEditorUid`) REFERENCES `User` (`uid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PostLike` (
  `id` varchar(191) NOT NULL,
  `postId` varchar(191) NOT NULL,
  `userUid` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `PostLike_postId_userUid_key` (`postId`,`userUid`),
  KEY `PostLike_userUid_createdAt_idx` (`userUid`,`createdAt`),
  CONSTRAINT `PostLike_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PostLike_userUid_fkey` FOREIGN KEY (`userUid`) REFERENCES `User` (`uid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Favorite` (
  `id` varchar(191) NOT NULL,
  `userUid` varchar(191) NOT NULL,
  `targetType` enum('wiki','post','music') NOT NULL,
  `targetId` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Favorite_userUid_targetType_targetId_key` (`userUid`,`targetType`,`targetId`),
  KEY `Favorite_targetType_targetId_idx` (`targetType`,`targetId`),
  KEY `Favorite_userUid_createdAt_idx` (`userUid`,`createdAt`),
  CONSTRAINT `Favorite_userUid_fkey` FOREIGN KEY (`userUid`) REFERENCES `User` (`uid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ModerationLog` (
  `id` varchar(191) NOT NULL,
  `targetType` enum('wiki','post') NOT NULL,
  `targetId` varchar(191) NOT NULL,
  `action` enum('submit','approve','reject','rollback') NOT NULL,
  `operatorUid` varchar(191) NOT NULL,
  `note` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ModerationLog_targetType_targetId_createdAt_idx` (`targetType`,`targetId`,`createdAt`),
  KEY `ModerationLog_operatorUid_createdAt_idx` (`operatorUid`,`createdAt`),
  CONSTRAINT `ModerationLog_operatorUid_fkey` FOREIGN KEY (`operatorUid`) REFERENCES `User` (`uid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `UserBanLog` (
  `id` varchar(191) NOT NULL,
  `targetUid` varchar(191) NOT NULL,
  `action` enum('ban','unban') NOT NULL,
  `operatorUid` varchar(191) NOT NULL,
  `note` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `UserBanLog_targetUid_createdAt_idx` (`targetUid`,`createdAt`),
  KEY `UserBanLog_operatorUid_createdAt_idx` (`operatorUid`,`createdAt`),
  CONSTRAINT `UserBanLog_targetUid_fkey` FOREIGN KEY (`targetUid`) REFERENCES `User` (`uid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `UserBanLog_operatorUid_fkey` FOREIGN KEY (`operatorUid`) REFERENCES `User` (`uid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `WikiRevision` (
  `id` varchar(191) NOT NULL,
  `pageSlug` varchar(191) NOT NULL,
  `title` varchar(191) NOT NULL,
  `content` longtext NOT NULL,
  `editorUid` varchar(191) NOT NULL,
  `editorName` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `WikiRevision_pageSlug_createdAt_idx` (`pageSlug`,`createdAt`),
  CONSTRAINT `WikiRevision_editorUid_fkey` FOREIGN KEY (`editorUid`) REFERENCES `User` (`uid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `WikiRevision_pageSlug_fkey` FOREIGN KEY (`pageSlug`) REFERENCES `WikiPage` (`slug`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Announcement` (
  `id` varchar(191) NOT NULL,
  `content` text NOT NULL,
  `link` varchar(191) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `Announcement_active_createdAt_idx` (`active`,`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Gallery` (
  `id` varchar(191) NOT NULL,
  `title` varchar(191) NOT NULL,
  `description` text NOT NULL,
  `authorUid` varchar(191) NOT NULL,
  `authorName` varchar(191) NOT NULL,
  `tags` json DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `Gallery_createdAt_idx` (`createdAt`),
  CONSTRAINT `Gallery_authorUid_fkey` FOREIGN KEY (`authorUid`) REFERENCES `User` (`uid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `GalleryImage` (
  `id` varchar(191) NOT NULL,
  `galleryId` varchar(191) NOT NULL,
  `url` text NOT NULL,
  `name` varchar(191) NOT NULL,
  `sortOrder` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `GalleryImage_galleryId_sortOrder_idx` (`galleryId`,`sortOrder`),
  CONSTRAINT `GalleryImage_galleryId_fkey` FOREIGN KEY (`galleryId`) REFERENCES `Gallery` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MusicTrack` (
  `docId` varchar(191) NOT NULL,
  `id` varchar(191) NOT NULL,
  `title` varchar(191) NOT NULL,
  `artist` varchar(191) NOT NULL,
  `album` varchar(191) NOT NULL,
  `cover` text NOT NULL,
  `audioUrl` text NOT NULL,
  `lyric` longtext DEFAULT NULL,
  `addedBy` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`docId`),
  UNIQUE KEY `MusicTrack_id_key` (`id`),
  KEY `MusicTrack_createdAt_idx` (`createdAt`),
  CONSTRAINT `MusicTrack_addedBy_fkey` FOREIGN KEY (`addedBy`) REFERENCES `User` (`uid`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ImageMap` (
  `id` varchar(191) NOT NULL,
  `md5` varchar(191) NOT NULL,
  `localUrl` text NOT NULL,
  `weiboUrl` text DEFAULT NULL,
  `smmsUrl` text DEFAULT NULL,
  `superbedUrl` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ImageMap_md5_key` (`md5`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Notification` (
  `id` varchar(191) NOT NULL,
  `userUid` varchar(191) NOT NULL,
  `type` enum('reply','like','review_result') NOT NULL,
  `payload` json NOT NULL,
  `isRead` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `Notification_userUid_isRead_createdAt_idx` (`userUid`,`isRead`,`createdAt`),
  KEY `Notification_userUid_createdAt_idx` (`userUid`,`createdAt`),
  CONSTRAINT `Notification_userUid_fkey` FOREIGN KEY (`userUid`) REFERENCES `User` (`uid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `BrowsingHistory` (
  `id` varchar(191) NOT NULL,
  `userUid` varchar(191) NOT NULL,
  `targetType` enum('wiki','post','music') NOT NULL,
  `targetId` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `BrowsingHistory_userUid_createdAt_idx` (`userUid`,`createdAt`),
  KEY `BrowsingHistory_userUid_targetType_createdAt_idx` (`userUid`,`targetType`,`createdAt`),
  KEY `BrowsingHistory_targetType_targetId_createdAt_idx` (`targetType`,`targetId`,`createdAt`),
  CONSTRAINT `BrowsingHistory_userUid_fkey` FOREIGN KEY (`userUid`) REFERENCES `User` (`uid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SearchKeyword` (
  `keyword` varchar(191) NOT NULL,
  `count` int NOT NULL DEFAULT 0,
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`keyword`),
  KEY `SearchKeyword_count_updatedAt_idx` (`count`,`updatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_post_hot_score := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Post' AND COLUMN_NAME = 'hotScore'
);
SET @sql := IF(
  @has_post_hot_score = 0,
  'ALTER TABLE `Post` ADD COLUMN `hotScore` double NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_post_view_count := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Post' AND COLUMN_NAME = 'viewCount'
);
SET @sql := IF(
  @has_post_view_count = 0,
  'ALTER TABLE `Post` ADD COLUMN `viewCount` int NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_wiki_view_count := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'WikiPage' AND COLUMN_NAME = 'viewCount'
);
SET @sql := IF(
  @has_wiki_view_count = 0,
  'ALTER TABLE `WikiPage` ADD COLUMN `viewCount` int NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_post_hot_score_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Post' AND INDEX_NAME = 'Post_hotScore_updatedAt_idx'
);
SET @sql := IF(
  @has_post_hot_score_index = 0,
  'CREATE INDEX `Post_hotScore_updatedAt_idx` ON `Post` (`hotScore`, `updatedAt`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
