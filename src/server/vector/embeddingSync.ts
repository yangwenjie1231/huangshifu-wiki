import fs from 'fs';
import path from 'path';

import { EmbeddingStatus, PrismaClient } from '@prisma/client';

import { generateImageEmbedding, getEmbeddingModelName, getEmbeddingVectorSize } from './clipEmbedding';
import { upsertImageEmbeddingPoint } from './qdrantService';

type SyncOptions = {
  limit: number;
  includeFailed?: boolean;
  forceRebuild?: boolean;
  galleryImageIds?: string[];
};

type SyncResult = {
  requested: number;
  picked: number;
  ready: number;
  failed: number;
  skipped: number;
  details: Array<{ galleryImageId: string; status: 'ready' | 'failed' | 'skipped'; reason?: string }>;
};

type GalleryImageRecord = {
  id: string;
  galleryId: string;
  url: string;
  name: string;
  asset: {
    storageKey: string;
    publicUrl: string;
    fileName: string;
  } | null;
};

const FNV64_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;
const MAX_SAFE_POINT_ID = BigInt(Number.MAX_SAFE_INTEGER);

function toUniqueIds(ids: string[] | undefined) {
  if (!ids || ids.length === 0) return [];
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

function extractStorageKeyFromUploadUrl(url: string) {
  if (!url) return null;

  if (url.startsWith('/uploads/')) {
    return decodeURIComponent(url.slice('/uploads/'.length));
  }

  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith('/uploads/')) {
      return decodeURIComponent(parsed.pathname.slice('/uploads/'.length));
    }
  } catch {
    return null;
  }

  return null;
}

function resolveUploadPathByStorageKey(storageKey: string, uploadsDir: string) {
  const normalized = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
  const base = path.resolve(uploadsDir);
  const target = path.resolve(base, normalized);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    return null;
  }
  return target;
}

function resolveLocalImagePath(galleryImage: GalleryImageRecord, uploadsDir: string) {
  if (galleryImage.asset?.storageKey) {
    return resolveUploadPathByStorageKey(galleryImage.asset.storageKey, uploadsDir);
  }

  const directUrlStorageKey = extractStorageKeyFromUploadUrl(galleryImage.url);
  if (directUrlStorageKey) {
    return resolveUploadPathByStorageKey(directUrlStorageKey, uploadsDir);
  }

  if (galleryImage.asset?.publicUrl) {
    const publicUrlStorageKey = extractStorageKeyFromUploadUrl(galleryImage.asset.publicUrl);
    if (publicUrlStorageKey) {
      return resolveUploadPathByStorageKey(publicUrlStorageKey, uploadsDir);
    }
  }

  return null;
}

export function buildQdrantPointId(galleryImageId: string) {
  const bytes = Buffer.from(galleryImageId, 'utf8');
  let hash = FNV64_OFFSET_BASIS;

  for (const value of bytes) {
    hash ^= BigInt(value);
    hash *= FNV64_PRIME;
    hash &= 0xffffffffffffffffn;
  }

  const reduced = hash % MAX_SAFE_POINT_ID;
  const pointId = Number(reduced);
  return pointId > 0 ? pointId : 1;
}

export async function enqueueGalleryImageEmbeddings(prisma: PrismaClient, galleryImageIds: string[]) {
  const uniqueIds = toUniqueIds(galleryImageIds);
  if (uniqueIds.length === 0) {
    return { requested: 0, queued: 0 };
  }

  let queued = 0;
  for (const galleryImageId of uniqueIds) {
    await prisma.imageEmbedding.upsert({
      where: { galleryImageId },
      update: {
        status: EmbeddingStatus.pending,
        lastError: null,
      },
      create: {
        galleryImageId,
        modelName: getEmbeddingModelName(),
        vectorSize: getEmbeddingVectorSize(),
        status: EmbeddingStatus.pending,
      },
    });
    queued += 1;
  }

  return { requested: uniqueIds.length, queued };
}

export async function enqueueMissingImageEmbeddings(prisma: PrismaClient, limit: number) {
  const pending = await prisma.galleryImage.findMany({
    where: {
      embedding: null,
    },
    select: {
      id: true,
    },
    take: limit,
    orderBy: {
      sortOrder: 'asc',
    },
  });

  if (pending.length === 0) {
    return { requested: 0, queued: 0 };
  }

  await prisma.imageEmbedding.createMany({
    data: pending.map((item) => ({
      galleryImageId: item.id,
      modelName: getEmbeddingModelName(),
      vectorSize: getEmbeddingVectorSize(),
      status: EmbeddingStatus.pending,
    })),
    skipDuplicates: true,
  });

  return {
    requested: pending.length,
    queued: pending.length,
  };
}

export async function syncImageEmbeddingBatch(
  prisma: PrismaClient,
  uploadsDir: string,
  options: SyncOptions,
): Promise<SyncResult> {
  const limit = Math.max(1, options.limit);
  const galleryImageIds = toUniqueIds(options.galleryImageIds);

  if (galleryImageIds.length > 0) {
    await enqueueGalleryImageEmbeddings(prisma, galleryImageIds);
  }

  if (options.forceRebuild && galleryImageIds.length > 0) {
    await prisma.imageEmbedding.updateMany({
      where: {
        galleryImageId: { in: galleryImageIds },
      },
      data: {
        status: EmbeddingStatus.pending,
        lastError: null,
      },
    });
  }

  const acceptedStatuses: EmbeddingStatus[] = [EmbeddingStatus.pending];
  if (options.includeFailed || options.forceRebuild) {
    acceptedStatuses.push(EmbeddingStatus.failed);
  }

  const candidates = await prisma.imageEmbedding.findMany({
    where: {
      status: { in: acceptedStatuses },
      ...(galleryImageIds.length > 0 ? { galleryImageId: { in: galleryImageIds } } : {}),
    },
    include: {
      galleryImage: {
        include: {
          asset: {
            select: {
              storageKey: true,
              publicUrl: true,
              fileName: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: 'asc',
    },
    take: limit,
  });

  if (candidates.length === 0) {
    return {
      requested: limit,
      picked: 0,
      ready: 0,
      failed: 0,
      skipped: 0,
      details: [],
    };
  }

  await prisma.imageEmbedding.updateMany({
    where: {
      id: { in: candidates.map((item) => item.id) },
    },
    data: {
      status: EmbeddingStatus.processing,
      lastError: null,
    },
  });

  const result: SyncResult = {
    requested: limit,
    picked: candidates.length,
    ready: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  for (const item of candidates) {
    const galleryImage = item.galleryImage as GalleryImageRecord;
    const localPath = resolveLocalImagePath(galleryImage, uploadsDir);

    if (!localPath) {
      const reason = '无法定位本地图片文件';
      await prisma.imageEmbedding.update({
        where: { id: item.id },
        data: {
          status: EmbeddingStatus.failed,
          lastError: reason,
        },
      });
      result.failed += 1;
      result.details.push({ galleryImageId: item.galleryImageId, status: 'failed', reason });
      continue;
    }

    let imageBuffer: Buffer;
    try {
      imageBuffer = await fs.promises.readFile(localPath);
    } catch (error) {
      const reason = `读取图片失败: ${(error as Error).message}`;
      await prisma.imageEmbedding.update({
        where: { id: item.id },
        data: {
          status: EmbeddingStatus.failed,
          lastError: reason,
        },
      });
      result.failed += 1;
      result.details.push({ galleryImageId: item.galleryImageId, status: 'failed', reason });
      continue;
    }

    try {
      const vector = await generateImageEmbedding(imageBuffer);
      await upsertImageEmbeddingPoint({
        pointId: buildQdrantPointId(item.galleryImageId),
        vector,
        payload: {
          galleryImageId: item.galleryImageId,
          galleryId: galleryImage.galleryId,
          imageUrl: galleryImage.asset?.publicUrl || galleryImage.url,
          imageName: galleryImage.asset?.fileName || galleryImage.name,
          updatedAt: new Date().toISOString(),
        },
      });

      await prisma.imageEmbedding.update({
        where: { id: item.id },
        data: {
          status: EmbeddingStatus.ready,
          lastError: null,
          embeddedAt: new Date(),
          modelName: getEmbeddingModelName(),
          vectorSize: getEmbeddingVectorSize(),
        },
      });

      result.ready += 1;
      result.details.push({ galleryImageId: item.galleryImageId, status: 'ready' });
    } catch (error) {
      const reason = `生成向量失败: ${(error as Error).message}`;
      await prisma.imageEmbedding.update({
        where: { id: item.id },
        data: {
          status: EmbeddingStatus.failed,
          lastError: reason,
        },
      });
      result.failed += 1;
      result.details.push({ galleryImageId: item.galleryImageId, status: 'failed', reason });
    }
  }

  return result;
}
