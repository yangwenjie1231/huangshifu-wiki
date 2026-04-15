import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { requireAuth, requireActiveUser, userToApiUser, createToken, setAuthCookie, clearAuthCookie } from '../middleware/auth';
import { exchangeWechatLoginCode, buildUniqueWechatEmail } from '../utils';
import { prisma } from '../prisma';
import type { AuthenticatedRequest } from '../types';

const router = Router();

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL || '';

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/me', async (req: AuthenticatedRequest, res) => {
  if (!req.authUser) {
    res.json({ user: null });
    return;
  }

  res.json({
    user: {
      ...req.authUser,
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerData: [
        {
          providerId: 'password',
          displayName: req.authUser.displayName,
          email: req.authUser.email,
          photoURL: req.authUser.photoURL,
        },
      ],
    },
  });
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body as {
      email?: string;
      password?: string;
      displayName?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: '邮箱和密码不能为空' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const name = (displayName || normalizedEmail.split('@')[0] || '匿名用户').trim();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      res.status(409).json({ error: '该邮箱已注册' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const role = SUPER_ADMIN_EMAIL && normalizedEmail === SUPER_ADMIN_EMAIL ? PrismaUserRole.super_admin : PrismaUserRole.user;

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        displayName: name,
        role,
        bio: '',
      },
    });

    const apiUser = userToApiUser(user);
    const token = createToken(apiUser);
    setAuthCookie(req, res, token);

    res.status(201).json({ user: apiUser });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: '邮箱和密码不能为空' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      res.status(401).json({ error: '邮箱或密码错误' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: '邮箱或密码错误' });
      return;
    }

    const apiUser = userToApiUser(user);
    const token = createToken(apiUser);
    setAuthCookie(req, res, token);

    res.json({ user: apiUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

router.post('/wechat/login', async (req, res) => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const displayNameRaw = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
    const photoURLRaw = typeof req.body?.photoURL === 'string' ? req.body.photoURL.trim() : '';

    if (!code.trim()) {
      res.status(400).json({ error: 'code 不能为空' });
      return;
    }

    const { openId, unionId } = await exchangeWechatLoginCode(code);

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { wechatOpenId: openId },
          ...(unionId ? [{ wechatUnionId: unionId }] : []),
        ],
      },
    });

    if (!user) {
      const generatedEmail = await buildUniqueWechatEmail(openId);
      const generatedPassword = `wx_${openId}_${Date.now()}`;
      const passwordHash = await bcrypt.hash(generatedPassword, 12);
      const fallbackName = displayNameRaw || `微信用户${openId.slice(-6)}`;

      user = await prisma.user.create({
        data: {
          email: generatedEmail,
          passwordHash,
          displayName: fallbackName,
          photoURL: photoURLRaw || null,
          bio: '',
          wechatOpenId: openId,
          wechatUnionId: unionId,
        },
      });
    } else {
      const shouldUpdateProfile =
        (displayNameRaw && displayNameRaw !== user.displayName) ||
        (photoURLRaw && photoURLRaw !== (user.photoURL || '')) ||
        user.wechatOpenId !== openId ||
        (!user.wechatUnionId && !!unionId);

      if (shouldUpdateProfile) {
        user = await prisma.user.update({
          where: { uid: user.uid },
          data: {
            displayName: displayNameRaw || undefined,
            photoURL: photoURLRaw || undefined,
            wechatOpenId: openId,
            wechatUnionId: unionId || user.wechatUnionId,
          },
        });
      }
    }

    const apiUser = userToApiUser(user);
    const token = createToken(apiUser);
    setAuthCookie(req, res, token);

    res.json({
      user: apiUser,
      token,
      wechat: {
        openId,
        unionId,
      },
    });
  } catch (error) {
    console.error('WeChat login error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '微信登录失败' });
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(req, res);
  res.json({ success: true });
});

export function registerAuthRoutes(app: Router) {
  app.use('/api/auth', router);
}
