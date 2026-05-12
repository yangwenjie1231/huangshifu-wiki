// 帖子热度分数计算与刷新

import { prisma } from './config';

export function calculatePostHotScore(post: {
  likesCount: number;
  commentsCount: number;
  viewCount?: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  const now = Date.now();
  const anchor = post.updatedAt && post.updatedAt > post.createdAt ? post.updatedAt : post.createdAt;
  const hoursSince = Math.max(0, (now - anchor.getTime()) / (1000 * 60 * 60));
  const timeDecay = 6 / (1 + (hoursSince / 24));
  const score = post.likesCount * 3 + post.commentsCount * 2 + (post.viewCount ?? 0) * 0.2 + timeDecay;
  return Number(score.toFixed(3));
}

export async function refreshPostHotScore(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      likesCount: true,
      commentsCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!post) return 0;

  const viewCountRow = await prisma.$queryRaw<Array<{ viewCount: number }>>`
    SELECT "viewCount" AS "viewCount"
    FROM "Post"
    WHERE "id" = ${postId}
    LIMIT 1
  `;
  const viewCount = Number(viewCountRow[0]?.viewCount || 0);

  const hotScore = calculatePostHotScore({
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    viewCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  });

  await prisma.$executeRaw`UPDATE "Post" SET "hotScore" = ${hotScore} WHERE "id" = ${postId}`;
  return hotScore;
}
