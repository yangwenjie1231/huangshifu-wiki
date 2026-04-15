import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as birthdayService from './birthdayService';

const router = Router();
const prisma = new PrismaClient();

type AuthenticatedRequest = Request & {
  authUser?: {
    uid: string;
    role: string;
    status: string;
  };
};

function isAdminRole(role: string | undefined) {
  return role === 'admin' || role === 'super_admin';
}

function authenticateAdmin(req: AuthenticatedRequest, res: Response, next: () => void) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    const cookieName = 'hsf_token';
    const cookies = req.headers.cookie;
    if (cookies) {
      const cookieValue = cookies.split(';').find(c => c.trim().startsWith(`${cookieName}=`));
      if (cookieValue) {
        token = cookieValue.split('=')[1];
      }
    }
  }

  if (!token) {
    res.status(401).json({ error: '请先登录' });
    return;
  }

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || '';

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { uid: string; role: string };
    if (!isAdminRole(payload.role)) {
      res.status(403).json({ error: '需要管理员权限' });
      return;
    }
    req.authUser = {
      uid: payload.uid,
      role: payload.role,
      status: 'active',
    };
    next();
  } catch {
    res.status(401).json({ error: '无效的认证令牌' });
  }
}

router.get('/config', async (_req: Request, res: Response) => {
  try {
    const configs = await birthdayService.getAllBirthdayConfigs();
    res.json({ data: configs });
  } catch (error) {
    console.error('Error fetching birthday configs:', error);
    res.status(500).json({ error: 'Failed to fetch configs' });
  }
});

router.get('/config/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const configs = await birthdayService.getBirthdayConfigsByType(type);
    res.json({ data: configs });
  } catch (error) {
    console.error('Error fetching birthday config by type:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

router.post('/config', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { type, title, content, sortOrder, isActive } = req.body;
    if (!type || !title || !content) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    const config = await birthdayService.createBirthdayConfig({ type, title, content, sortOrder, isActive });
    res.status(201).json({ data: config });
  } catch (error) {
    console.error('Error creating birthday config:', error);
    res.status(500).json({ error: 'Failed to create config' });
  }
});

router.put('/config/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, sortOrder, isActive } = req.body;
    const config = await birthdayService.updateBirthdayConfig(id, { title, content, sortOrder, isActive });
    res.json({ data: config });
  } catch (error) {
    console.error('Error updating birthday config:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

router.patch('/config/:id/toggle', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const config = await birthdayService.toggleBirthdayConfigActive(id);
    res.json({ data: config });
  } catch (error) {
    console.error('Error toggling birthday config:', error);
    res.status(500).json({ error: 'Failed to toggle config' });
  }
});

router.delete('/config/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await birthdayService.deleteBirthdayConfig(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting birthday config:', error);
    res.status(500).json({ error: 'Failed to delete config' });
  }
});

export function registerBirthdayRoutes(app: Router) {
  app.use('/api/birthday', router);
}

export default router;
