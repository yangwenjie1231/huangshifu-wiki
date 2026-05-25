ALTER TABLE "Post"
ADD COLUMN IF NOT EXISTS "dislikesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PostComment"
ALTER COLUMN "postId" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "PostDislike" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userUid" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostDislike_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PostDislike_userUid_postId_idx" ON "PostDislike"("userUid", "postId");
CREATE INDEX IF NOT EXISTS "PostDislike_userUid_createdAt_idx" ON "PostDislike"("userUid", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "PostDislike_postId_userUid_key" ON "PostDislike"("postId", "userUid");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PostDislike_postId_fkey'
  ) THEN
    ALTER TABLE "PostDislike"
    ADD CONSTRAINT "PostDislike_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PostDislike_userUid_fkey'
  ) THEN
    ALTER TABLE "PostDislike"
    ADD CONSTRAINT "PostDislike_userUid_fkey"
    FOREIGN KEY ("userUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
