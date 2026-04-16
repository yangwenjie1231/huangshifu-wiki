import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAdmin } from '../middleware/auth';
import { apiCache, CACHE_KEYS, CACHE_TTL } from '../utils/cache';

const router = Router();

// 清除公告缓存的辅助函数
function clearAnnouncementCache(): void {
  apiCache.delete(CACHE_KEYS.ANNOUNCEMENT_LATEST);
}

router.get('/latest', async (_req, res) => {
  try {
    // 尝试从缓存获取
    const cached = apiCache.get(CACHE_KEYS.ANNOUNCEMENT_LATEST);
    if (cached) {
      res.json(cached);
      return;
    }

    const announcement = await prisma.announcement.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    const result = { announcement };

    // 缓存结果
    apiCache.set(CACHE_KEYS.ANNOUNCEMENT_LATEST, result, CACHE_TTL.ANNOUNCEMENT);

    res.json(result);
  } catch (error) {
    console.error('Fetch latest announcement error:', error);
    res.status(500).json({ error: '获取公告失败' });
  }
});

router.get('/', requireAdmin, async (_req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ announcements });
  } catch (error) {
    console.error('Fetch announcements error:', error);
    res.status(500).json({ error: '获取公告失败' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { content, link, active } = req.body as {
      content?: string;
      link?: string;
      active?: boolean;
    };

    if (!content) {
      res.status(400).json({ error: '公告内容不能为空' });
      return;
    }

    const announcement = await prisma.announcement.create({
      data: {
        content,
        link: link || null,
        active: active ?? true,
      },
    });

    // 清除缓存
    clearAnnouncementCache();

    res.status(201).json({ announcement });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: '发布公告失败' });
  }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { active, content, link } = req.body as {
      active?: boolean;
      content?: string;
      link?: string;
    };

    const announcement = await prisma.announcement.update({
      where: { id: req.params.id },
      data: {
        active: typeof active === 'boolean' ? active : undefined,
        content: typeof content === 'string' ? content : undefined,
        link: typeof link === 'string' ? link : undefined,
      },
    });

    // 清除缓存
    clearAnnouncementCache();

    res.json({ announcement });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ error: '更新公告失败' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.announcement.delete({
      where: { id: req.params.id },
    });

    // 清除缓存
    clearAnnouncementCache();

    res.json({ success: true });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: '删除公告失败' });
  }
});

export function registerAnnouncementsRoutes(app: Router) {
  app.use('/api/announcements', router);
}
