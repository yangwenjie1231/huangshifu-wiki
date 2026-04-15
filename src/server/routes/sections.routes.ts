import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const sections = await prisma.section.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    res.json({ sections });
  } catch (error) {
    console.error('Fetch sections error:', error);
    res.status(500).json({ error: '获取版块失败' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, description, order } = req.body as {
      name?: string;
      description?: string;
      order?: number;
    };

    if (!name) {
      res.status(400).json({ error: '版块名称不能为空' });
      return;
    }

    const id = name.toLowerCase().trim().replace(/\s+/g, '-');
    const section = await prisma.section.upsert({
      where: { id },
      update: {
        name,
        description: description || '',
        order: typeof order === 'number' ? order : 0,
      },
      create: {
        id,
        name,
        description: description || '',
        order: typeof order === 'number' ? order : 0,
      },
    });

    res.status(201).json({ section });
  } catch (error) {
    console.error('Create section error:', error);
    res.status(500).json({ error: '新增版块失败' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.section.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete section error:', error);
    res.status(500).json({ error: '删除版块失败' });
  }
});

export function registerSectionsRoutes(app: Router) {
  app.use('/api/sections', router);
}
