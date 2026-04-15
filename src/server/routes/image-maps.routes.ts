import { Router } from 'express';
import { requireAuth, requireAdmin, requireActiveUser } from '../middleware/auth';
import { prisma } from '../utils';

const router = Router();

// GET /api/image-maps - List image maps
router.get('/', async (req, res) => {
  try {
    const md5 = typeof req.query.md5 === 'string' ? req.query.md5 : '';

    const items = await prisma.imageMap.findMany({
      where: md5 ? { md5 } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({
      items: items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Fetch image maps error:', error);
    res.status(500).json({ error: '获取图片映射失败' });
  }
});

// GET /api/image-maps/export - Export image maps
router.get('/export', requireAuth, requireAdmin, async (req, res) => {
  try {
    const format = (req.query.format as string) || 'json';
    const items = await prisma.imageMap.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'csv') {
      const headers = ['id', 'md5', 'localUrl', 'externalUrl', 's3Url', 'storageType', 'createdAt'];
      const csvRows = [headers.join(',')];
      
      for (const item of items) {
        const row = [
          item.id,
          item.md5,
          `"${item.localUrl || ''}"`,
          `"${item.externalUrl || ''}"`,
          `"${item.s3Url || ''}"`,
          `"${item.storageType || ''}"`,
          item.createdAt.toISOString(),
        ];
        csvRows.push(row.join(','));
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="image-maps-${Date.now()}.csv"`);
      res.send(csvRows.join('\n'));
    } else {
      res.json({
        items: items.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        })),
      });
    }
  } catch (error) {
    console.error('Export image maps error:', error);
    res.status(500).json({ error: '导出图片映射失败' });
  }
});

// GET /api/image-maps/stats - Get image map statistics
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [total, withExternal, withS3] = await Promise.all([
      prisma.imageMap.count(),
      prisma.imageMap.count({ where: { externalUrl: { not: null } } }),
      prisma.imageMap.count({ where: { storageType: 's3' } }),
    ]);

    res.json({
      total,
      stats: {
        local: total - withExternal - withS3,
        external: withExternal,
        s3: withS3,
      },
    });
  } catch (error) {
    console.error('Get image map stats error:', error);
    res.status(500).json({ error: '获取图片统计失败' });
  }
});

// POST /api/image-maps/import - Import image maps
router.post('/import', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { items, mode } = req.body as {
      items: Array<{
        id?: string;
        md5?: string;
        localUrl?: string;
        externalUrl?: string;
        s3Url?: string;
        storageType?: 'local' | 'external' | 's3';
      }>;
      mode: 'update' | 'create' | 'upsert';
    };

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: '缺少导入数据' });
      return;
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const item of items) {
      try {
        if (item.storageType === 's3' && !item.s3Url) {
          results.failed++;
          results.errors.push(`S3 存储类型需要提供 s3Url: ${JSON.stringify(item)}`);
          continue;
        }

        if (mode === 'upsert' && item.md5) {
          const existing = await prisma.imageMap.findUnique({
            where: { md5: item.md5 },
          });

          if (existing) {
            await prisma.imageMap.update({
              where: { id: existing.id },
              data: {
                ...(item.localUrl !== undefined && { localUrl: item.localUrl || null }),
                ...(item.externalUrl !== undefined && { externalUrl: item.externalUrl || null }),
                ...(item.s3Url !== undefined && { s3Url: item.s3Url || null }),
                ...(item.storageType !== undefined && { storageType: item.storageType }),
              },
            });
          } else if (item.id) {
            await prisma.imageMap.create({
              data: {
                id: item.id,
                md5: item.md5 || crypto.randomUUID(),
                ...(item.localUrl && { localUrl: item.localUrl }),
                ...(item.externalUrl && { externalUrl: item.externalUrl }),
                ...(item.s3Url && { s3Url: item.s3Url }),
                ...(item.storageType && { storageType: item.storageType }),
              },
            });
          }
          results.success++;
        } else if (mode === 'update' && item.id) {
          await prisma.imageMap.update({
            where: { id: item.id },
            data: {
              ...(item.localUrl !== undefined && { localUrl: item.localUrl || null }),
              ...(item.externalUrl !== undefined && { externalUrl: item.externalUrl || null }),
              ...(item.s3Url !== undefined && { s3Url: item.s3Url || null }),
              ...(item.storageType !== undefined && { storageType: item.storageType }),
            },
          });
          results.success++;
        } else if (mode === 'create' && item.id && item.md5) {
          await prisma.imageMap.create({
            data: {
              id: item.id,
              md5: item.md5,
              ...(item.localUrl && { localUrl: item.localUrl }),
              ...(item.externalUrl && { externalUrl: item.externalUrl }),
              ...(item.s3Url && { s3Url: item.s3Url }),
              ...(item.storageType && { storageType: item.storageType }),
            },
          });
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`数据格式错误：${JSON.stringify(item)}`);
        }
      } catch (err) {
        results.failed++;
        results.errors.push(`处理失败：${JSON.stringify(item)} - ${(err as Error).message}`);
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Import image maps error:', error);
    res.status(500).json({ error: '导入图片映射失败' });
  }
});

// POST /api/image-maps/refresh-all-blurhash - Refresh all blurhash
router.post('/refresh-all-blurhash', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { limit = '100' } = req.query as { limit?: string };

    const limitNum = parseInt(limit, 10) || 100;

    const imageMaps = await prisma.imageMap.findMany({
      where: {
        OR: [
          { blurhash: null },
          { thumbhash: null },
        ],
      },
      take: limitNum,
    });

    if (imageMaps.length === 0) {
      res.json({
        success: true,
        message: '没有需要刷新 blurhash 的图片',
        processed: 0,
      });
      return;
    }

    try {
      const { fetchBlurhashFromS3, fetchThumbhashFromS3 } = await import('../blurhashService');

      let processed = 0;
      let failed = 0;

      for (const imageMap of imageMaps) {
        const urlToGenerateHash = imageMap.s3Url || imageMap.externalUrl || imageMap.localUrl;

        if (!urlToGenerateHash) {
          continue;
        }

        try {
          const [blurhash, thumbhash] = await Promise.all([
            fetchBlurhashFromS3(urlToGenerateHash),
            fetchThumbhashFromS3(urlToGenerateHash),
          ]);

          await prisma.imageMap.update({
            where: { id: imageMap.id },
            data: {
              ...(blurhash && { blurhash }),
              ...(thumbhash && { thumbhash }),
            },
          });

          processed++;
          console.log(`[Refresh All Blurhash] Processed ${processed}/${imageMaps.length}:`, imageMap.id);
        } catch (err) {
          failed++;
          console.error(`[Refresh All Blurhash] Failed for ${imageMap.id}:`, err);
        }
      }

      res.json({
        success: true,
        processed,
        failed,
        total: imageMaps.length,
      });
    } catch (hashError) {
      console.error('[Refresh All Blurhash] Failed to generate blurhash:', hashError);
      res.status(500).json({ error: '批量生成 blurhash 失败' });
    }
  } catch (error) {
    console.error('Refresh all blurhash error:', error);
    res.status(500).json({ error: '刷新 blurhash 失败' });
  }
});

// GET /api/image-maps/:id - Get image map by ID
router.get('/:id', async (req, res) => {
  try {
    const item = await prisma.imageMap.findUnique({
      where: { id: req.params.id },
    });

    if (!item) {
      res.status(404).json({ error: '图片映射不存在' });
      return;
    }

    res.json({
      item: {
        ...item,
        createdAt: item.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Fetch image map detail error:', error);
    res.status(500).json({ error: '获取图片映射失败' });
  }
});

// POST /api/image-maps - Create image map
router.post('/', requireAuth, requireActiveUser, async (req, res) => {
  try {
    const { id, md5, localUrl, externalUrl, s3Url, storageType } = req.body as {
      id?: string;
      md5?: string;
      localUrl?: string;
      externalUrl?: string;
      s3Url?: string;
      storageType?: 'local' | 'external' | 's3';
    };

    if (!id || !md5) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    if (storageType === 's3' && !s3Url) {
      res.status(400).json({ error: 'S3 存储类型需要提供 s3Url' });
      return;
    }

    let blurhash: string | undefined;
    let thumbhash: string | undefined;

    const urlToGenerateHash = s3Url || externalUrl || localUrl;
    if (urlToGenerateHash) {
      try {
        const { fetchBlurhashFromS3, fetchThumbhashFromS3, isBlurhashEnabled, shouldAutoGenerate } = await import('../blurhashService');

        if (isBlurhashEnabled() && shouldAutoGenerate()) {
          console.log('[ImageMap] Auto-generating blurhash for:', urlToGenerateHash);

          const [blur, thumb] = await Promise.all([
            fetchBlurhashFromS3(urlToGenerateHash),
            fetchThumbhashFromS3(urlToGenerateHash),
          ]);

          if (blur) {
            blurhash = blur;
            console.log('[ImageMap] Blurhash generated:', blur.substring(0, 20) + '...');
          }

          if (thumb) {
            thumbhash = thumb;
            console.log('[ImageMap] Thumbhash generated:', thumb.substring(0, 20) + '...');
          }
        }
      } catch (hashError) {
        console.error('[ImageMap] Failed to generate blurhash:', hashError);
      }
    }

    const item = await prisma.imageMap.upsert({
      where: { id },
      update: {
        md5,
        ...(localUrl !== undefined && { localUrl: localUrl || null }),
        ...(externalUrl !== undefined && { externalUrl: externalUrl || null }),
        ...(s3Url !== undefined && { s3Url: s3Url || null }),
        ...(storageType !== undefined && { storageType }),
        ...(blurhash !== undefined && { blurhash }),
        ...(thumbhash !== undefined && { thumbhash }),
      },
      create: {
        id,
        md5,
        ...(localUrl && { localUrl }),
        ...(externalUrl && { externalUrl }),
        ...(s3Url && { s3Url }),
        ...(storageType && { storageType }),
        ...(blurhash && { blurhash }),
        ...(thumbhash && { thumbhash }),
      },
    });

    res.status(201).json({
      item: {
        ...item,
        createdAt: item.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create image map error:', error);
    res.status(500).json({ error: '保存图片映射失败' });
  }
});

// PATCH /api/image-maps/:id - Update image map
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { localUrl, externalUrl, s3Url, storageType, blurhash, thumbhash } = req.body as {
      localUrl?: string | null;
      externalUrl?: string | null;
      s3Url?: string | null;
      storageType?: 'local' | 'external' | 's3';
      blurhash?: string | null;
      thumbhash?: string | null;
    };

    if (storageType === 's3' && !s3Url) {
      res.status(400).json({ error: 'S3 存储类型需要提供 s3Url' });
      return;
    }

    const item = await prisma.imageMap.update({
      where: { id: req.params.id },
      data: {
        ...(localUrl !== undefined && { localUrl: localUrl || null }),
        ...(externalUrl !== undefined && { externalUrl: externalUrl || null }),
        ...(s3Url !== undefined && { s3Url: s3Url || null }),
        ...(storageType !== undefined && { storageType }),
        ...(blurhash !== undefined && { blurhash: blurhash || null }),
        ...(thumbhash !== undefined && { thumbhash: thumbhash || null }),
      },
    });

    res.json({
      item: {
        ...item,
        createdAt: item.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update image map error:', error);
    res.status(500).json({ error: '更新图片映射失败' });
  }
});

// DELETE /api/image-maps/:id - Delete image map
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await prisma.imageMap.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete image map error:', error);
    res.status(500).json({ error: '删除图片映射失败' });
  }
});

// POST /api/image-maps/:id/refresh-blurhash - Refresh blurhash for specific image map
router.post('/:id/refresh-blurhash', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const imageMap = await prisma.imageMap.findUnique({
      where: { id },
    });

    if (!imageMap) {
      res.status(404).json({ error: '图片映射不存在' });
      return;
    }

    const urlToGenerateHash = imageMap.s3Url || imageMap.externalUrl || imageMap.localUrl;

    if (!urlToGenerateHash) {
      res.status(400).json({ error: '没有可用的图片 URL' });
      return;
    }

    try {
      const { fetchBlurhashFromS3, fetchThumbhashFromS3 } = await import('../blurhashService');

      console.log('[Refresh Blurhash] Refreshing hashes for:', urlToGenerateHash);

      const [blurhash, thumbhash] = await Promise.all([
        fetchBlurhashFromS3(urlToGenerateHash),
        fetchThumbhashFromS3(urlToGenerateHash),
      ]);

      const updatedItem = await prisma.imageMap.update({
        where: { id },
        data: {
          ...(blurhash && { blurhash }),
          ...(thumbhash && { thumbhash }),
        },
      });

      res.json({
        success: true,
        item: {
          ...updatedItem,
          createdAt: updatedItem.createdAt.toISOString(),
        },
      });
    } catch (hashError) {
      console.error('[Refresh Blurhash] Failed to generate blurhash:', hashError);
      res.status(500).json({ error: '生成 blurhash 失败' });
    }
  } catch (error) {
    console.error('Refresh blurhash error:', error);
    res.status(500).json({ error: '刷新 blurhash 失败' });
  }
});

export function registerImageMapsRoutes(app: Router) {
  app.use('/api/image-maps', router);
}
