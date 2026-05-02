-- Drop denormalized author snapshot columns from PostComment.
-- 评论改为渲染时通过 authorUid 关联 User 表读取最新昵称/头像，
-- 不再写入快照、也不再需要在用户改资料时 updateMany 同步。

ALTER TABLE "PostComment" DROP COLUMN "authorName";
ALTER TABLE "PostComment" DROP COLUMN "authorPhoto";

-- 新查询模式会按 authorUid + createdAt 反查用户的所有评论
-- （Profile.tsx 的"我的评论"页签等），加索引提速。
CREATE INDEX "PostComment_authorUid_createdAt_idx" ON "PostComment"("authorUid", "createdAt");
