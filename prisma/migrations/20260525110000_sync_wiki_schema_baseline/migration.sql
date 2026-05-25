ALTER TABLE "WikiPage"
ADD COLUMN IF NOT EXISTS "likesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "dislikesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "locationCode" TEXT,
ADD COLUMN IF NOT EXISTS "locationDetail" TEXT,
ADD COLUMN IF NOT EXISTS "titleKey" TEXT,
ADD COLUMN IF NOT EXISTS "hasLegacyDuplicateTitleKey" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "legacyDuplicateTitle" TEXT,
ADD COLUMN IF NOT EXISTS "lastEditorName" TEXT;

WITH ranked_titles AS (
  SELECT
    "id",
    "slug",
    BTRIM("title") AS normalized_title,
    ROW_NUMBER() OVER (
      PARTITION BY BTRIM("title")
      ORDER BY "createdAt", "id"
    ) AS duplicate_rank,
    EXISTS (
      SELECT 1
      FROM "WikiPage" AS existing
      WHERE BTRIM(existing."title") = BTRIM("WikiPage"."title")
        AND existing."titleKey" = BTRIM("WikiPage"."title")
    ) AS has_canonical_title_key
  FROM "WikiPage"
  WHERE "titleKey" IS NULL
)
UPDATE "WikiPage" AS page
SET
  "titleKey" = CASE
    WHEN ranked_titles.duplicate_rank = 1 AND NOT ranked_titles.has_canonical_title_key
      THEN ranked_titles.normalized_title
    ELSE ranked_titles.normalized_title || ' [' || ranked_titles."slug" || ']'
  END,
  "hasLegacyDuplicateTitleKey" = ranked_titles.duplicate_rank <> 1 OR ranked_titles.has_canonical_title_key
FROM ranked_titles
WHERE page."id" = ranked_titles."id";

UPDATE "WikiPage"
SET "hasLegacyDuplicateTitleKey" = true
WHERE "titleKey" = BTRIM("title") || ' [' || "slug" || ']';

UPDATE "WikiPage"
SET "legacyDuplicateTitle" = BTRIM("title")
WHERE "legacyDuplicateTitle" IS NULL
  AND "hasLegacyDuplicateTitleKey" = true
  AND "titleKey" = BTRIM("title") || ' [' || "slug" || ']';

UPDATE "WikiPage" AS page
SET "legacyDuplicateTitle" = revision_titles.legacy_duplicate_title
FROM (
  SELECT
    page."id",
    (
      SELECT BTRIM(revision."title")
      FROM "WikiRevision" AS revision
      WHERE revision."pageSlug" = page."slug"
        AND EXISTS (
          SELECT 1
          FROM "WikiPage" AS sibling
          WHERE sibling."slug" <> page."slug"
            AND sibling."titleKey" = BTRIM(revision."title")
        )
      ORDER BY revision."createdAt" ASC, revision."id" ASC
      LIMIT 1
    ) AS legacy_duplicate_title
  FROM "WikiPage" AS page
  WHERE page."legacyDuplicateTitle" IS NULL
    AND page."hasLegacyDuplicateTitleKey" = true
) AS revision_titles
WHERE page."id" = revision_titles."id"
  AND revision_titles.legacy_duplicate_title IS NOT NULL;

ALTER TABLE "WikiPage"
ALTER COLUMN "titleKey" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "WikiPage_titleKey_key" ON "WikiPage"("titleKey");
CREATE INDEX IF NOT EXISTS "WikiPage_isPinned_updatedAt_idx" ON "WikiPage"("isPinned", "updatedAt");

CREATE TABLE IF NOT EXISTS "WikiLike" (
  "id" TEXT NOT NULL,
  "pageSlug" TEXT NOT NULL,
  "userUid" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WikiLike_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WikiDislike" (
  "id" TEXT NOT NULL,
  "pageSlug" TEXT NOT NULL,
  "userUid" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WikiDislike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WikiLike_pageSlug_userUid_key" ON "WikiLike"("pageSlug", "userUid");
CREATE INDEX IF NOT EXISTS "WikiLike_userUid_createdAt_idx" ON "WikiLike"("userUid", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "WikiDislike_pageSlug_userUid_key" ON "WikiDislike"("pageSlug", "userUid");
CREATE INDEX IF NOT EXISTS "WikiDislike_userUid_createdAt_idx" ON "WikiDislike"("userUid", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WikiLike_pageSlug_fkey'
  ) THEN
    ALTER TABLE "WikiLike"
    ADD CONSTRAINT "WikiLike_pageSlug_fkey"
    FOREIGN KEY ("pageSlug") REFERENCES "WikiPage"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WikiLike_userUid_fkey'
  ) THEN
    ALTER TABLE "WikiLike"
    ADD CONSTRAINT "WikiLike_userUid_fkey"
    FOREIGN KEY ("userUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WikiDislike_pageSlug_fkey'
  ) THEN
    ALTER TABLE "WikiDislike"
    ADD CONSTRAINT "WikiDislike_pageSlug_fkey"
    FOREIGN KEY ("pageSlug") REFERENCES "WikiPage"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WikiDislike_userUid_fkey'
  ) THEN
    ALTER TABLE "WikiDislike"
    ADD CONSTRAINT "WikiDislike_userUid_fkey"
    FOREIGN KEY ("userUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
