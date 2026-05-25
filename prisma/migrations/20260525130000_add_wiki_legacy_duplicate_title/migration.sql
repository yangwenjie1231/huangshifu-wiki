ALTER TABLE "WikiPage"
ADD COLUMN IF NOT EXISTS "legacyDuplicateTitle" TEXT;

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
