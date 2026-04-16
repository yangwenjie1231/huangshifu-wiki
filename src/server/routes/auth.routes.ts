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

    console.log('[Auth] Register attempt:', { email: normalizedEmail, name });

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      console.log('[Auth] Register failed - email already exists:', normalizedEmail);
      res.status(409).json({ error: '该邮箱已注册' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const role = SUPER_ADMIN_EMAIL && normalizedEmail === SUPER_ADMIN_EMAIL ? PrismaUserRole.super_admin : PrismaUserRole.user;

    console.log('[Auth] Creating user:', { email: normalizedEmail, role });

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

    console.log('[Auth] Register success:', { uid: user.uid, email: user.email });
    res.status(201).json({ user: apiUser });
  } catch (error) {
    console.error('[Auth] Register error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body,
    });
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
      console.log('[Auth] Login failed - missing credentials');
      res.status(400).json({ error: '邮箱和密码不能为空' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log('[Auth] Login attempt:', { email: normalizedEmail });

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      console.log('[Auth] Login failed - user not found:', normalizedEmail);
      res.status(401).json({ error: '邮箱或密码错误' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      console.log('[Auth] Login failed - invalid password for:', normalizedEmail);
      res.status(401).json({ error: '邮箱或密码错误' });
      return;
    }

    const apiUser = userToApiUser(user);
    const token = createToken(apiUser);
    setAuthCookie(req, res, token);

    console.log('[Auth] Login success:', { uid: user.uid, email: user.email });
    res.json({ user: apiUser });
  } catch (error) {
    console.error('[Auth] Login error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body,
    });
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

router.post('/wechat/login', async (req, res) => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const displayNameRaw = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
    const photoURLRaw = typeof req.body?.photoURL === 'string' ? req.body.photoURL.trim() : '';

    if (!code.trim()) {
      console.log('[Auth] WeChat login failed - missing code');
      res.status(400).json({ error: 'code 不能为空' });
      return;
    }

    console.log('[Auth] WeChat login attempt');

    const { openId, unionId } = await exchangeWechatLoginCode(code);

    console.log('[Auth] WeChat code exchanged:', { openId, hasUnionId: !!unionId });

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

      console.log('[Auth] Creating new WeChat user:', { generatedEmail, fallbackName });

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
        console.log('[Auth] Updating WeChat user profile:', { uid: user.uid });
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

    console.log('[Auth] WeChat login success:', { uid: user.uid, openId });

    res.json({
      user: apiUser,
      token,
      wechat: {
        openId,
        unionId,
      },
    });
  } catch (error) {
    console.error('[Auth] WeChat login error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body,
    });
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
