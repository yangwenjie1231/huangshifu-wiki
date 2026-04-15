import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin, type AuthenticatedRequest } from '../middleware/auth';
import { parseInteger, parseBoolean } from '../utils';
import { getEmbeddingModelName, getEmbeddingVectorSize } from '../vector/clipEmbedding';
import { getQdrantCollectionName } from '../vector/qdrantService';
import { enqueueMissingImageEmbeddings, syncImageEmbeddingBatch } from '../vector/embeddingSync';

const router = Router();
const prisma = new PrismaClient();
const prismaAny = prisma as any;

const IMAGE_EMBEDDING_BATCH_SIZE = Math.max(1, Number(process.env.IMAGE_EMBEDDING_BATCH_SIZE || 100));

router.get('/status', requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const [pending, processing, ready, failed] = await Promise.all([
      prisma.imageEmbedding.count({ where: { status: 'pending' } }),
      prisma.imageEmbedding.count({ where: { status: 'processing' } }),
      prisma.imageEmbedding.count({ where: { status: 'ready' } }),
      prisma.imageEmbedding.count({ where: { status: 'failed' } }),
    ]);

    const summary = {
      pending,
      processing,
      ready,
      failed,
      total: pending + processing + ready + failed,
    };

    res.json({
      modelName: getEmbeddingModelName(),
      vectorSize: getEmbeddingVectorSize(),
      qdrantCollection: getQdrantCollectionName(),
      summary,
    });
  } catch (error) {
    console.error('Fetch embeddings status error:', error);
    res.status(500).json({ error: '获取向量状态失败' });
  }
});

router.post('/enqueue-missing', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInteger(req.body?.limit, IMAGE_EMBEDDING_BATCH_SIZE, {
      min: 1,
      max: 2000,
    });
    const result = await enqueueMissingImageEmbeddings(prisma, limit);
    res.json({
      ...result,
      limit,
    });
  } catch (error) {
    console.error('Enqueue missing embeddings error:', error);
    res.status(500).json({ error: '补齐向量队列失败' });
  }
});

router.post('/sync-batch', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const galleryImageIdsRaw = Array.isArray(req.body?.galleryImageIds)
      ? req.body.galleryImageIds
      : [];
    const galleryImageIds = galleryImageIdsRaw
      .filter((item: unknown): item is string => typeof item === 'string')
      .map((item: string) => item.trim())
      .filter(Boolean);

    const limit = parseInteger(req.body?.limit, IMAGE_EMBEDDING_BATCH_SIZE, {
      min: 1,
      max: 500,
    });
    const includeFailed = parseBoolean(req.body?.includeFailed, false);
    const forceRebuild = parseBoolean(req.body?.forceRebuild, false);

    const result = await syncImageEmbeddingBatch(prisma, process.env.UPLOADS_PATH || 'uploads', {
      limit,
      includeFailed,
      forceRebuild,
      galleryImageIds,
    });

    res.json({
      ...result,
      limit,
      includeFailed,
      forceRebuild,
      modelName: getEmbeddingModelName(),
      vectorSize: getEmbeddingVectorSize(),
      qdrantCollection: getQdrantCollectionName(),
    });
  } catch (error) {
    console.error('Sync embeddings batch error:', error);
    res.status(500).json({ error: '批量生成向量失败' });
  }
});

router.get('/errors', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInteger(req.query.limit, 20, {
      min: 1,
      max: 200,
    });

    const failed = await prisma.imageEmbedding.findMany({
      where: {
        status: 'failed',
      },
      include: {
        galleryImage: {
          include: {
            gallery: {
              select: {
                id: true,
                title: true,
              },
            },
            asset: {
              select: {
                id: true,
                publicUrl: true,
                storageKey: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
    });

    res.json({
      items: failed.map((item) => ({
        id: item.id,
        galleryImageId: item.galleryImageId,
        galleryId: item.galleryImage.galleryId,
        galleryTitle: item.galleryImage.gallery.title,
        imageUrl: item.galleryImage.asset?.publicUrl || item.galleryImage.url,
        modelName: item.modelName,
        vectorSize: item.vectorSize,
        status: item.status,
        lastError: item.lastError,
        embeddedAt: item.embeddedAt ? item.embeddedAt.toISOString() : null,
        updatedAt: item.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Fetch embedding errors error:', error);
    res.status(500).json({ error: '获取向量失败记录失败' });
  }
});

router.post('/retry-failed', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInteger(req.body?.limit, IMAGE_EMBEDDING_BATCH_SIZE, {
      min: 1,
      max: 500,
    });

    const updated = await prisma.imageEmbedding.updateMany({
      where: {
        status: 'failed',
      },
      data: {
        status: 'pending',
        lastError: null,
      },
    });

    const result = await syncImageEmbeddingBatch(prisma, process.env.UPLOADS_PATH || 'uploads', {
      limit,
      includeFailed: true,
      forceRebuild: false,
    });

    res.json({
      resetCount: updated.count,
      ...result,
      limit,
    });
  } catch (error) {
    console.error('Retry failed embeddings error:', error);
    res.status(500).json({ error: '重试失败向量任务失败' });
  }
});

router.post('/rebuild-all', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInteger(req.body?.limit, IMAGE_EMBEDDING_BATCH_SIZE, {
      min: 1,
      max: 500,
    });

    const updated = await prisma.imageEmbedding.updateMany({
      data: {
        status: 'pending',
        lastError: null,
      },
    });

    const result = await syncImageEmbeddingBatch(prisma, process.env.UPLOADS_PATH || 'uploads', {
      limit,
      includeFailed: true,
      forceRebuild: true,
    });

    res.json({
      resetCount: updated.count,
      ...result,
      limit,
    });
  } catch (error) {
    console.error('Rebuild all embeddings error:', error);
    res.status(500).json({ error: '重建所有向量失败' });
  }
});

export function registerEmbeddingsRoutes(app: Router) {
  app.use('/api/embeddings', router);
}
