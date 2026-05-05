ALTER TABLE "WikiPage" ADD COLUMN "titleKey" TEXT;

UPDATE "WikiPage"
SET "titleKey" = btrim("title");

ALTER TABLE "WikiPage" ALTER COLUMN "titleKey" SET NOT NULL;

CREATE UNIQUE INDEX "WikiPage_titleKey_key" ON "WikiPage"("titleKey");
