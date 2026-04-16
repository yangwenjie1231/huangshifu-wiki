import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth';
import {
  parseInteger,
  parseBoolean,
  parseMinSimilarityScore,
  extractBase64Payload,
  normalizeKeyword,
  increaseSearchKeywordCount,
  buildWikiVisibilityWhere,
  buildPostVisibilityWhere,
  toWikiResponse,
  toPostResponse,
  toGalleryResponse,
  toMusicResponse,
  toAlbumResponse,
  toEmbeddingPayload,
  parseDate,
} from '../utils';
import { prisma } from '../prisma';
import { getEmbeddingModelName, getEmbeddingVectorSize, generateImageEmbedding, generateTextEmbedding } from '../vector/clipEmbedding';
import { getQdrantCollectionName, searchImageEmbeddingPoints } from '../vector/qdrantService';
import { createUploadStorageInfo } from '../uploadPath';

const router = Router();

const IMAGE_SEARCH_RESULT_LIMIT = Math.max(1, Number(process.env.IMAGE_SEARCH_RESULT_LIMIT || 24));

const searchImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, file, cb) => {
      const info = createUploadStorageInfo(process.env.UPLOADS_PATH || 'uploads', 'search', file.originalname);
      (file as Express.Multer.File & { uploadInfo?: ReturnType<typeof createUploadStorageInfo> }).uploadInfo = info;
      cb(null, info.absoluteDir);
    },
    filename: (_req, file, cb) => {
      const info = (file as Express.Multer.File & { uploadInfo?: ReturnType<typeof createUploadStorageInfo> }).uploadInfo;
      cb(null, info?.fileName || file.originalname);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);
    const ALLOWED_IMAGE_MIME_TYPES = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp',
    ]);
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext) || !ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
      cb(new Error('仅支持 JPG、PNG、WEBP、GIF、BMP 图片上传'));
      return;
    }
    cb(null, true);
  },
});

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const type = typeof req.query.type === 'string' ? req.query.type : 'all';
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const startDate = typeof req.query.startDate === 'string' ? parseDate(req.query.startDate) : null;
    const endDate = typeof req.query.endDate === 'string' ? parseDate(req.query.endDate) : null;
    const tagsParam = typeof req.query.tags === 'string' ? req.query.tags : '';
    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()).filter(Boolean) : [];

    const wantsWiki = type === 'all' || type === 'wiki';
    const wantsPosts = type === 'all' || type === 'posts';
    const wantsGalleries = type === 'all' || type === 'galleries';
    const wantsMusic = type === 'all' || type === 'music';
    const wantsAlbums = type === 'all' || type === 'albums';

    if (q) {
      increaseSearchKeywordCount(q);
    }

    const wikiVisibilityWhere = buildWikiVisibilityWhere(req.authUser);
    const postVisibilityWhere = buildPostVisibilityWhere(req.authUser);

    const wikiPromise = wantsWiki
      ? prisma.wikiPage.findMany({
          where: {
            ...wikiVisibilityWhere,
            ...(category ? { category } : {}),
            ...(q
              ? {
                  OR: [
                    { title: { contains: q } },
                    { content: { contains: q } },
                    { slug: { contains: q } },
                  ],
                }
              : {}),
            ...(startDate || endDate
              ? {
                  updatedAt: {
                    ...(startDate ? { gte: startDate } : {}),
                    ...(endDate ? { lte: endDate } : {}),
                  },
                }
              : {}),
          },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]);

    const postsPromise = wantsPosts
      ? prisma.post.findMany({
          where: {
            ...postVisibilityWhere,
            ...(category ? { section: category } : {}),
            ...(q
              ? {
                  OR: [
                    { title: { contains: q } },
                    { content: { contains: q } },
                  ],
                }
              : {}),
            ...(startDate || endDate
              ? {
                  updatedAt: {
                    ...(startDate ? { gte: startDate } : {}),
                    ...(endDate ? { lte: endDate } : {}),
                  },
                }
              : {}),
          },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]);

    const galleriesPromise = wantsGalleries
      ? prisma.gallery.findMany({
          include: {
            images: {
              include: {
                asset: true,
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
          where: {
            ...(q
              ? {
                  OR: [
                    { title: { contains: q } },
                    { description: { contains: q } },
                  ],
                }
              : {}),
            ...(startDate || endDate
              ? {
                  updatedAt: {
                    ...(startDate ? { gte: startDate } : {}),
                    ...(endDate ? { lte: endDate } : {}),
                  },
                }
              : {}),
          },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]);

    const musicPromise = wantsMusic
      ? prisma.musicTrack.findMany({
          where: {
            ...(q
              ? {
                  OR: [
                    { title: { contains: q } },
                    { artist: { contains: q } },
                    { album: { contains: q } },
                    { lyric: { contains: q } },
                  ],
                }
              : {}),
          },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]);

    const albumsPromise = wantsAlbums
      ? prisma.album.findMany({
          where: {
            ...(q
              ? {
                  OR: [
                    { title: { contains: q } },
                    { artist: { contains: q } },
                    { description: { contains: q } },
                  ],
                }
              : {}),
          },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]);

    const [wiki, posts, galleries, music, albums] = await Promise.all([wikiPromise, postsPromise, galleriesPromise, musicPromise, albumsPromise]);

    res.json({
      wiki: wiki.map(toWikiResponse),
      posts: posts.map(toPostResponse),
      galleries: await Promise.all(galleries.map(toGalleryResponse)),
      music: music.map(toMusicResponse),
      albums: albums.map(toAlbumResponse),
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

router.get('/hot-keywords', async (_req, res) => {
  try {
    const keywords = await prisma.searchKeyword.findMany({
      orderBy: [{ count: 'desc' }, { updatedAt: 'desc' }],
      take: 20,
    });

    res.json({
      keywords: keywords.map((k) => ({
        keyword: k.keyword,
        count: k.count,
      })),
    });
  } catch (error) {
    console.error('Fetch hot keywords error:', error);
    res.status(500).json({ error: '获取热门关键词失败' });
  }
});

router.post('/by-image', searchImageUpload.single('image'), async (req: AuthenticatedRequest, res) => {
  const tempFile = req.file;
  try {
    const requestedLimit = parseInteger(req.body?.limit, IMAGE_SEARCH_RESULT_LIMIT, {
      min: 1,
      max: 60,
    });
    const minScore = parseMinSimilarityScore(req.body?.minScore);

    let imageBuffer: Buffer | null = null;

    if (tempFile?.path) {
      try {
        imageBuffer = await fs.promises.readFile(tempFile.path);
      } catch {
        imageBuffer = null;
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      const base64Payload = extractBase64Payload(req.body?.imageBase64);
      if (base64Payload) {
        try {
          imageBuffer = Buffer.from(base64Payload, 'base64');
        } catch {
          imageBuffer = null;
        }
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      res.status(400).json({ error: '请上传图片文件，或提供 imageBase64' });
      return;
    }

    const queryVector = await generateImageEmbedding(imageBuffer);
    const matches = await searchImageEmbeddingPoints({
      vector: queryVector,
      limit: requestedLimit,
      minScore,
    });

    const seenGalleryIds = new Set<string>();
    const seenImageIds = new Set<string>();
    const orderedGalleryIds: string[] = [];
    const scoreByGalleryId = new Map<string, number>();

    matches.forEach((match) => {
      const parsed = toEmbeddingPayload(match.payload);
      if (!parsed) {
        return;
      }

      if (!seenImageIds.has(parsed.galleryImageId)) {
        seenImageIds.add(parsed.galleryImageId);
      }

      const score = typeof match.score === 'number' ? match.score : 0;
      const previousBest = scoreByGalleryId.get(parsed.galleryId);
      if (previousBest === undefined || score > previousBest) {
        scoreByGalleryId.set(parsed.galleryId, score);
      }

      if (!seenGalleryIds.has(parsed.galleryId)) {
        seenGalleryIds.add(parsed.galleryId);
        orderedGalleryIds.push(parsed.galleryId);
      }
    });

    if (!orderedGalleryIds.length) {
      res.json({
        mode: 'semantic_image',
        totalMatches: 0,
        totalGalleries: 0,
        galleries: [],
      });
      return;
    }

    const galleryRows = await prisma.gallery.findMany({
      where: {
        id: { in: orderedGalleryIds },
      },
      include: {
        images: {
          include: {
            asset: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const galleryById = new Map(galleryRows.map((gallery) => [gallery.id, gallery]));
    const galleries = orderedGalleryIds
      .map((galleryId) => {
        const gallery = galleryById.get(galleryId);
        if (!gallery) {
          return null;
        }
        return {
          ...toGalleryResponse(gallery),
          similarity: Number((scoreByGalleryId.get(galleryId) ?? 0).toFixed(4)),
        };
      })
      .filter((item): item is ReturnType<typeof toGalleryResponse> & { similarity: number } => item !== null);

    res.json({
      mode: 'semantic_image',
      totalMatches: seenImageIds.size,
      totalGalleries: galleries.length,
      galleries,
    });
  } catch (error) {
    console.error('Image semantic search error:', error);
    res.status(500).json({ error: '图片语义搜索失败' });
  } finally {
    if (tempFile?.path) {
      await fs.promises.unlink(tempFile.path).catch(() => {});
    }
  }
});

router.get('/semantic-galleries', async (req: AuthenticatedRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const requestedLimit = parseInteger(req.query.limit as string, IMAGE_SEARCH_RESULT_LIMIT, {
      min: 1,
      max: 60,
    });
    const minScore = parseMinSimilarityScore(req.query.minScore);

    if (!q) {
      res.status(400).json({ error: '请提供搜索文字 (q 参数)' });
      return;
    }

    const queryVector = await generateTextEmbedding(q);
    const matches = await searchImageEmbeddingPoints({
      vector: queryVector,
      limit: requestedLimit,
      minScore,
    });

    const seenGalleryIds = new Set<string>();
    const seenImageIds = new Set<string>();
    const orderedGalleryIds: string[] = [];
    const scoreByGalleryId = new Map<string, number>();

    matches.forEach((match) => {
      const parsed = toEmbeddingPayload(match.payload);
      if (!parsed) {
        return;
      }

      if (!seenImageIds.has(parsed.galleryImageId)) {
        seenImageIds.add(parsed.galleryImageId);
      }

      const score = typeof match.score === 'number' ? match.score : 0;
      const previousBest = scoreByGalleryId.get(parsed.galleryId);
      if (previousBest === undefined || score > previousBest) {
        scoreByGalleryId.set(parsed.galleryId, score);
      }

      if (!seenGalleryIds.has(parsed.galleryId)) {
        seenGalleryIds.add(parsed.galleryId);
        orderedGalleryIds.push(parsed.galleryId);
      }
    });

    if (!orderedGalleryIds.length) {
      res.json({
        mode: 'semantic_text',
        query: q,
        totalMatches: 0,
        totalGalleries: 0,
        galleries: [],
      });
      return;
    }

    const galleryRows = await prisma.gallery.findMany({
      where: {
        id: { in: orderedGalleryIds },
      },
      include: {
        images: {
          include: {
            asset: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const galleryById = new Map(galleryRows.map((gallery) => [gallery.id, gallery]));
    const galleries = orderedGalleryIds
      .map((galleryId) => {
        const gallery = galleryById.get(galleryId);
        if (!gallery) {
          return null;
        }
        return {
          ...toGalleryResponse(gallery),
          similarity: Number((scoreByGalleryId.get(galleryId) ?? 0).toFixed(4)),
        };
      })
      .filter((item): item is ReturnType<typeof toGalleryResponse> & { similarity: number } => item !== null);

    res.json({
      mode: 'semantic_text',
      query: q,
      totalMatches: seenImageIds.size,
      totalGalleries: galleries.length,
      galleries,
    });
  } catch (error) {
    console.error('Semantic gallery search error:', error);
    res.status(500).json({ error: '语义搜索画廊失败' });
  }
});

router.get('/suggest', async (req: AuthenticatedRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q || q.length < 2) {
      res.json({ suggestions: [] });
      return;
    }

    const normalized = normalizeKeyword(q);

    const [keywordMatches, wikiMatches, postMatches, musicMatches, albumMatches] = await Promise.all([
      prisma.searchKeyword.findMany({
        where: { keyword: { contains: normalized } },
        orderBy: { count: 'desc' },
        take: 5,
        select: { keyword: true, count: true },
      }),
      prisma.wikiPage.findMany({
        where: {
          status: 'published',
          OR: [
            { title: { contains: q } },
            { slug: { contains: q } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { slug: true, title: true, category: true },
      }),
      prisma.post.findMany({
        where: {
          status: 'published',
          OR: [
            { title: { contains: q } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { id: true, title: true, section: true },
      }),
      prisma.musicTrack.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { artist: { contains: q } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { docId: true, title: true, artist: true },
      }),
      prisma.album.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { artist: { contains: q } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { docId: true, title: true, artist: true },
      }),
    ]);

    const suggestions: Array<{ type: 'keyword' | 'wiki' | 'post' | 'music' | 'album'; text: string; subtext?: string; id?: string }> = [];

    keywordMatches.forEach((k) => {
      suggestions.push({ type: 'keyword', text: k.keyword, subtext: `${k.count} 次搜索` });
    });

    wikiMatches.forEach((w) => {
      suggestions.push({ type: 'wiki', text: w.title, subtext: w.category, id: w.slug });
    });

    postMatches.forEach((p) => {
      suggestions.push({ type: 'post', text: p.title, subtext: p.section, id: p.id });
    });

    musicMatches.forEach((m) => {
      suggestions.push({ type: 'music', text: m.title, subtext: m.artist, id: m.docId });
    });

    albumMatches.forEach((a) => {
      suggestions.push({ type: 'album', text: a.title, subtext: a.artist, id: a.docId });
    });

    res.json({ suggestions });
  } catch (error) {
    console.error('Search suggest error:', error);
    res.status(500).json({ error: '搜索建议失败' });
  }
});

export function registerSearchRoutes(app: Router) {
  app.use('/api/search', router);
}
