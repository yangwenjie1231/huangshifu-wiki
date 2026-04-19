import { EmbeddingStatus, PrismaClient } from '@prisma/client';

import { getEmbeddingModelName, getEmbeddingVectorSize } from './clipEmbedding';

/**
 * 从 Markdown 内容中提取图片 URL
 * 支持格式: ![alt](/uploads/...), ![alt](https://...)
 */
function extractImagesFromMarkdown(content: string): string[] {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const imageUrls: string[] = [];
  // Markdown 图片语法: ![alt](url)
  const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  let match;
  while ((match = markdownImageRegex.exec(content)) !== null) {
    const url = match[2]?.trim();
    if (url) {
      imageUrls.push(url);
    }
  }

  return imageUrls;
}

/**
 * 从 Wiki Markdown 内容中提取所有图片 URL
 * 支持格式: ![alt](/uploads/...), ![alt](https://...)
 * @param wikiContent - Wiki 页面的 Markdown 内容
 * @returns 图片 URL 数组
 */
export function extractWikiImages(wikiContent: string): string[] {
  return extractImagesFromMarkdown(wikiContent);
}

/**
 * 从 Post Markdown 内容中提取所有图片 URL
 * 与 extractWikiImages 逻辑相同
 * @param postContent - Post 的 Markdown 内容
 * @returns 图片 URL 数组
 */
export function extractPostImages(postContent: string): string[] {
  return extractImagesFromMarkdown(postContent);
}

/**
 * 根据 Wiki 页面 slug 列表，提取图片并创建向量任务
 * 使用 upsert 避免重复创建
 * @param prisma - PrismaClient 实例
 * @param wikiPageSlugs - Wiki 页面 slug 列表
 * @returns 创建的任务数量 { requested: 请求数量, queued: 实际创建数量 }
 */
export async function enqueueWikiImageEmbeddings(
  prisma: PrismaClient,
  wikiPageSlugs: string[]
): Promise<{ requested: number; queued: number }> {
  const uniqueSlugs = Array.from(new Set(wikiPageSlugs.map((slug) => slug.trim()).filter(Boolean)));
  if (uniqueSlugs.length === 0) {
    return { requested: 0, queued: 0 };
  }

  // 获取所有 Wiki 页面的内容
  const wikiPages = await prisma.wikiPage.findMany({
    where: {
      slug: { in: uniqueSlugs },
    },
    select: {
      slug: true,
      content: true,
    },
  });

  let queued = 0;
  const modelName = getEmbeddingModelName();
  const vectorSize = getEmbeddingVectorSize();

  for (const page of wikiPages) {
    const imageUrls = extractWikiImages(page.content);

    for (const imageUrl of imageUrls) {
      await prisma.wikiImageEmbedding.upsert({
        where: {
          wikiPageSlug_imageUrl: {
            wikiPageSlug: page.slug,
            imageUrl,
          },
        },
        update: {
          status: EmbeddingStatus.pending,
          lastError: null,
        },
        create: {
          wikiPageSlug: page.slug,
          imageUrl,
          modelName,
          vectorSize,
          status: EmbeddingStatus.pending,
        },
      });
      queued += 1;
    }
  }

  return { requested: uniqueSlugs.length, queued };
}

/**
 * 根据 Post ID 列表，提取图片并创建向量任务
 * 使用 upsert 避免重复创建
 * @param prisma - PrismaClient 实例
 * @param postIds - Post ID 列表
 * @returns 创建的任务数量 { requested: 请求数量, queued: 实际创建数量 }
 */
export async function enqueuePostImageEmbeddings(
  prisma: PrismaClient,
  postIds: string[]
): Promise<{ requested: number; queued: number }> {
  const uniqueIds = Array.from(new Set(postIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { requested: 0, queued: 0 };
  }

  // 获取所有 Post 的内容
  const posts = await prisma.post.findMany({
    where: {
      id: { in: uniqueIds },
    },
    select: {
      id: true,
      content: true,
    },
  });

  let queued = 0;
  const modelName = getEmbeddingModelName();
  const vectorSize = getEmbeddingVectorSize();

  for (const post of posts) {
    const imageUrls = extractPostImages(post.content);

    for (const imageUrl of imageUrls) {
      await prisma.postImageEmbedding.upsert({
        where: {
          postId_imageUrl: {
            postId: post.id,
            imageUrl,
          },
        },
        update: {
          status: EmbeddingStatus.pending,
          lastError: null,
        },
        create: {
          postId: post.id,
          imageUrl,
          modelName,
          vectorSize,
          status: EmbeddingStatus.pending,
        },
      });
      queued += 1;
    }
  }

  return { requested: uniqueIds.length, queued };
}

/**
 * 查找所有 Wiki 页面，提取未创建向量任务的图片
 * 批量创建向量任务
 * @param prisma - PrismaClient 实例
 * @param limit - 限制处理的 Wiki 页面数量
 * @returns 创建的任务数量 { requested: 请求数量, queued: 实际创建数量 }
 */
export async function enqueueMissingWikiImageEmbeddings(
  prisma: PrismaClient,
  limit: number
): Promise<{ requested: number; queued: number }> {
  // 获取所有 Wiki 页面
  const wikiPages = await prisma.wikiPage.findMany({
    select: {
      slug: true,
      content: true,
    },
    take: limit,
    orderBy: {
      updatedAt: 'asc',
    },
  });

  if (wikiPages.length === 0) {
    return { requested: 0, queued: 0 };
  }

  // 收集所有图片 URL 和对应的 slug
  const imageTasks: Array<{ wikiPageSlug: string; imageUrl: string }> = [];

  for (const page of wikiPages) {
    const imageUrls = extractWikiImages(page.content);
    for (const imageUrl of imageUrls) {
      imageTasks.push({
        wikiPageSlug: page.slug,
        imageUrl,
      });
    }
  }

  if (imageTasks.length === 0) {
    return { requested: 0, queued: 0 };
  }

  // 查找已存在的 embedding 记录
  const existingEmbeddings = await prisma.wikiImageEmbedding.findMany({
    where: {
      OR: imageTasks.map((task) => ({
        wikiPageSlug: task.wikiPageSlug,
        imageUrl: task.imageUrl,
      })),
    },
    select: {
      wikiPageSlug: true,
      imageUrl: true,
    },
  });

  // 构建已存在记录的集合
  const existingSet = new Set(
    existingEmbeddings.map((e) => `${e.wikiPageSlug}:${e.imageUrl}`)
  );

  // 过滤出需要创建的任务
  const newTasks = imageTasks.filter(
    (task) => !existingSet.has(`${task.wikiPageSlug}:${task.imageUrl}`)
  );

  if (newTasks.length === 0) {
    return { requested: wikiPages.length, queued: 0 };
  }

  const modelName = getEmbeddingModelName();
  const vectorSize = getEmbeddingVectorSize();

  // 批量创建新的 embedding 记录
  await prisma.wikiImageEmbedding.createMany({
    data: newTasks.map((task) => ({
      wikiPageSlug: task.wikiPageSlug,
      imageUrl: task.imageUrl,
      modelName,
      vectorSize,
      status: EmbeddingStatus.pending,
    })),
    skipDuplicates: true,
  });

  return {
    requested: wikiPages.length,
    queued: newTasks.length,
  };
}

/**
 * 查找所有 Post，提取未创建向量任务的图片
 * 批量创建向量任务
 * @param prisma - PrismaClient 实例
 * @param limit - 限制处理的 Post 数量
 * @returns 创建的任务数量 { requested: 请求数量, queued: 实际创建数量 }
 */
export async function enqueueMissingPostImageEmbeddings(
  prisma: PrismaClient,
  limit: number
): Promise<{ requested: number; queued: number }> {
  // 获取所有 Post
  const posts = await prisma.post.findMany({
    select: {
      id: true,
      content: true,
    },
    take: limit,
    orderBy: {
      updatedAt: 'asc',
    },
  });

  if (posts.length === 0) {
    return { requested: 0, queued: 0 };
  }

  // 收集所有图片 URL 和对应的 postId
  const imageTasks: Array<{ postId: string; imageUrl: string }> = [];

  for (const post of posts) {
    const imageUrls = extractPostImages(post.content);
    for (const imageUrl of imageUrls) {
      imageTasks.push({
        postId: post.id,
        imageUrl,
      });
    }
  }

  if (imageTasks.length === 0) {
    return { requested: 0, queued: 0 };
  }

  // 查找已存在的 embedding 记录
  const existingEmbeddings = await prisma.postImageEmbedding.findMany({
    where: {
      OR: imageTasks.map((task) => ({
        postId: task.postId,
        imageUrl: task.imageUrl,
      })),
    },
    select: {
      postId: true,
      imageUrl: true,
    },
  });

  // 构建已存在记录的集合
  const existingSet = new Set(
    existingEmbeddings.map((e) => `${e.postId}:${e.imageUrl}`)
  );

  // 过滤出需要创建的任务
  const newTasks = imageTasks.filter(
    (task) => !existingSet.has(`${task.postId}:${task.imageUrl}`)
  );

  if (newTasks.length === 0) {
    return { requested: posts.length, queued: 0 };
  }

  const modelName = getEmbeddingModelName();
  const vectorSize = getEmbeddingVectorSize();

  // 批量创建新的 embedding 记录
  await prisma.postImageEmbedding.createMany({
    data: newTasks.map((task) => ({
      postId: task.postId,
      imageUrl: task.imageUrl,
      modelName,
      vectorSize,
      status: EmbeddingStatus.pending,
    })),
    skipDuplicates: true,
  });

  return {
    requested: posts.length,
    queued: newTasks.length,
  };
}
