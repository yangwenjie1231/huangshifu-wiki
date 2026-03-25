import axios from 'axios';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import * as cheerio from 'cheerio';
import { Prisma, PrismaClient, UserRole as PrismaUserRole } from '@prisma/client';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const prisma = new PrismaClient();
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '';
const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL || '';
const WECHAT_MP_APPID = process.env.WECHAT_MP_APPID || process.env.WECHAT_APP_ID || '';
const WECHAT_MP_APP_SECRET =
  process.env.WECHAT_MP_APP_SECRET || process.env.WECHAT_MP_APPSECRET || process.env.WECHAT_APP_SECRET || '';
const WECHAT_LOGIN_MOCK = process.env.WECHAT_LOGIN_MOCK === 'true';

if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET. Please set it in .env.local');
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const AUTH_COOKIE_NAME = 'hsf_token';
const IS_PROD = process.env.NODE_ENV === 'production';

interface SessionJwtPayload extends JwtPayload {
  uid: string;
  role: PrismaUserRole;
}

interface WechatCodeSessionResponse {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

interface ApiUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  wechatBound: boolean;
  role: PrismaUserRole;
  status: UserStatus;
  banReason: string | null;
  bannedAt: string | null;
  level: number;
  bio: string;
}

type UserStatus = 'active' | 'banned';
type ContentStatus = 'draft' | 'pending' | 'published' | 'rejected';
type FavoriteTargetType = 'wiki' | 'post' | 'music';
type ModerationTargetType = 'wiki' | 'post';
type NotificationType = 'reply' | 'like' | 'review_result';
type BrowsingTargetType = 'wiki' | 'post' | 'music';
type PostSortType = 'latest' | 'hot' | 'recommended';

type AuthenticatedRequest = Request & {
  authUser?: ApiUser;
};

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (CORS_ORIGIN) {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
}

function serializeTags(value: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [];
}

function parseDate(date: string | Date | null | undefined) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function createWechatPlaceholderEmail(openId: string) {
  const safe = openId.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64);
  const fallback = safe || `wx_${Date.now().toString(36)}`;
  return `${fallback}@wechat.local`;
}

async function exchangeWechatLoginCode(rawCode: string) {
  const code = rawCode.trim();
  if (!code) {
    throw new Error('缺少 code');
  }

  if (WECHAT_LOGIN_MOCK) {
    const mockPayload = code.replace(/^mock:/, '');
    const [openIdPart, unionIdPart] = mockPayload.split(':');
    const openId = (openIdPart || `mock_openid_${Date.now().toString(36)}`).slice(0, 128);
    const unionId = unionIdPart ? unionIdPart.slice(0, 128) : null;
    return { openId, unionId };
  }

  if (!WECHAT_MP_APPID || !WECHAT_MP_APP_SECRET) {
    throw new Error('服务器未配置微信登录参数');
  }

  const response = await axios.get<WechatCodeSessionResponse>('https://api.weixin.qq.com/sns/jscode2session', {
    params: {
      appid: WECHAT_MP_APPID,
      secret: WECHAT_MP_APP_SECRET,
      js_code: code,
      grant_type: 'authorization_code',
    },
    timeout: 10_000,
  });

  const data = response.data;
  if (typeof data?.errcode === 'number' && data.errcode !== 0) {
    throw new Error(`微信登录失败：${data.errmsg || `errcode=${data.errcode}`}`);
  }

  if (!data?.openid) {
    throw new Error('微信登录失败：未获取到 openid');
  }

  return {
    openId: data.openid,
    unionId: data.unionid || null,
  };
}

async function buildUniqueWechatEmail(openId: string) {
  const base = createWechatPlaceholderEmail(openId);
  const [name, domain] = base.split('@');
  let candidate = base;

  for (let i = 0; i < 8; i += 1) {
    const existing = await prisma.user.findUnique({
      where: { email: candidate },
      select: { uid: true },
    });
    if (!existing) {
      return candidate;
    }
    candidate = `${name}_${i + 1}@${domain || 'wechat.local'}`;
  }

  return `${name}_${Date.now().toString(36)}@${domain || 'wechat.local'}`;
}

function parsePostSort(value: unknown): PostSortType {
  if (value === 'hot' || value === 'recommended') {
    return value;
  }
  return 'latest';
}

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 64);
}

function calculatePostHotScore(post: {
  likesCount: number;
  commentsCount: number;
  viewCount?: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  const now = Date.now();
  const anchor = post.updatedAt && post.updatedAt > post.createdAt ? post.updatedAt : post.createdAt;
  const hoursSince = Math.max(0, (now - anchor.getTime()) / (1000 * 60 * 60));
  const timeDecay = 6 / (1 + (hoursSince / 24));
  const score = post.likesCount * 3 + post.commentsCount * 2 + (post.viewCount ?? 0) * 0.2 + timeDecay;
  return Number(score.toFixed(3));
}

function toNotificationResponse(notification: {
  id: string;
  userUid: string;
  type: NotificationType;
  payload: unknown;
  isRead: boolean;
  createdAt: Date;
}) {
  return {
    id: notification.id,
    userUid: notification.userUid,
    type: notification.type,
    payload: notification.payload,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
  };
}

async function createNotification(userUid: string, type: NotificationType, payload: Record<string, unknown>) {
  try {
    await prisma.notification.create({
      data: {
        userUid,
        type,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error('Create notification error:', error);
  }
}

async function recordBrowsingHistory(userUid: string, targetType: BrowsingTargetType, targetId: string) {
  const dedupeAfter = new Date(Date.now() - 30 * 60 * 1000);
  try {
    const existing = await prisma.browsingHistory.findFirst({
      where: {
        userUid,
        targetType,
        targetId,
        createdAt: {
          gte: dedupeAfter,
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      await prisma.browsingHistory.create({
        data: {
          userUid,
          targetType,
          targetId,
        },
      });
    }
  } catch (error) {
    console.error('Record browsing history error:', error);
  }
}

async function increaseSearchKeywordCount(rawKeyword: string) {
  const keyword = normalizeKeyword(rawKeyword);
  if (!keyword) return;

  try {
    await prisma.searchKeyword.upsert({
      where: { keyword },
      update: {
        count: {
          increment: 1,
        },
      },
      create: {
        keyword,
        count: 1,
      },
    });
  } catch (error) {
    console.error('Increase search keyword count error:', error);
  }
}

async function refreshPostHotScore(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      likesCount: true,
      commentsCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!post) return 0;

  const viewCountRow = await prisma.$queryRaw<Array<{ viewCount: number }>>`
    SELECT \`viewCount\` AS viewCount
    FROM \`Post\`
    WHERE \`id\` = ${postId}
    LIMIT 1
  `;
  const viewCount = Number(viewCountRow[0]?.viewCount || 0);

  const hotScore = calculatePostHotScore({
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    viewCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  });

  await prisma.$executeRaw`UPDATE \`Post\` SET \`hotScore\` = ${hotScore} WHERE \`id\` = ${postId}`;
  return hotScore;
}

function userToApiUser(user: {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  wechatOpenId?: string | null;
  role: PrismaUserRole;
  status: UserStatus;
  banReason: string | null;
  bannedAt: Date | null;
  level: number;
  bio: string;
}): ApiUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    wechatBound: Boolean(user.wechatOpenId),
    role: user.role,
    status: user.status,
    banReason: user.banReason,
    bannedAt: user.bannedAt ? user.bannedAt.toISOString() : null,
    level: user.level,
    bio: user.bio,
  };
}

function toUserResponse(user: {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: PrismaUserRole;
  status: UserStatus;
  banReason: string | null;
  bannedAt: Date | null;
  level: number;
  bio: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...user,
    bannedAt: user.bannedAt ? user.bannedAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function isAdminRole(role: PrismaUserRole | undefined) {
  return role === 'admin' || role === 'super_admin';
}

function canViewWikiPage(page: { status: ContentStatus; lastEditorUid: string }, authUser?: ApiUser) {
  if (page.status === 'published') return true;
  if (!authUser) return false;
  if (isAdminRole(authUser.role)) return true;
  return page.lastEditorUid === authUser.uid;
}

function canViewPost(post: { status: ContentStatus; authorUid: string }, authUser?: ApiUser) {
  if (post.status === 'published') return true;
  if (!authUser) return false;
  if (isAdminRole(authUser.role)) return true;
  return post.authorUid === authUser.uid;
}

function buildWikiVisibilityWhere(authUser?: ApiUser) {
  if (!authUser) {
    return { status: 'published' as ContentStatus };
  }
  if (isAdminRole(authUser.role)) {
    return {};
  }
  return {
    OR: [
      { status: 'published' as ContentStatus },
      { lastEditorUid: authUser.uid },
    ],
  };
}

function buildPostVisibilityWhere(authUser?: ApiUser) {
  if (!authUser) {
    return { status: 'published' as ContentStatus };
  }
  if (isAdminRole(authUser.role)) {
    return {};
  }
  return {
    OR: [
      { status: 'published' as ContentStatus },
      { authorUid: authUser.uid },
    ],
  };
}

function parseContentStatus(value: unknown): ContentStatus | null {
  if (value === 'draft' || value === 'pending' || value === 'published' || value === 'rejected') {
    return value;
  }
  return null;
}

function normalizeWikiWriteStatus(rawStatus: unknown, authUser: ApiUser) {
  const status = parseContentStatus(rawStatus);
  if (isAdminRole(authUser.role)) {
    return status || 'published';
  }
  if (status === 'pending') return 'pending';
  if (status === 'rejected') return 'rejected';
  return 'draft';
}

function normalizePostWriteStatus(rawStatus: unknown, authUser: ApiUser) {
  const status = parseContentStatus(rawStatus);
  if (isAdminRole(authUser.role)) {
    return status || 'published';
  }
  if (status === 'pending') return 'pending';
  if (status === 'rejected') return 'rejected';
  return 'draft';
}

function parseFavoriteType(value: unknown): FavoriteTargetType | null {
  if (value === 'wiki' || value === 'post' || value === 'music') {
    return value;
  }
  return null;
}

function parseBrowsingTargetType(value: unknown): BrowsingTargetType | null {
  if (value === 'wiki' || value === 'post' || value === 'music') {
    return value;
  }
  return null;
}

function parseModerationTargetType(value: unknown): ModerationTargetType | null {
  if (value === 'wiki' || value === 'post') {
    return value;
  }
  return null;
}

function normalizeModerationTargetType(value: unknown): ModerationTargetType | null {
  if (value === 'posts') {
    return 'post';
  }
  return parseModerationTargetType(value);
}

function createToken(user: ApiUser) {
  return jwt.sign(
    {
      uid: user.uid,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

function shouldUseSecureCookie(req: Request) {
  const override = process.env.COOKIE_SECURE;
  if (override === 'true') return true;
  if (override === 'false') return false;
  if (!IS_PROD) return false;

  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    return forwardedProto.split(',')[0].trim() === 'https';
  }

  return req.secure;
}

function setAuthCookie(req: Request, res: Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookie(req),
    maxAge: 7 * ONE_DAY_MS,
    path: '/',
  });
}

function clearAuthCookie(req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookie(req),
    path: '/',
  });
}

function getTokenFromRequest(req: Request) {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

async function authMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = getTokenFromRequest(req);
  if (!token) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as SessionJwtPayload;
    const user = await prisma.user.findUnique({
      where: { uid: payload.uid },
    });
    if (user) {
      req.authUser = userToApiUser(user);
    }
  } catch (error) {
    console.error('Invalid auth token:', error);
  }

  next();
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    res.status(401).json({ error: '请先登录' });
    return;
  }
  next();
}

function requireActiveUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    res.status(401).json({ error: '请先登录' });
    return;
  }

  if (req.authUser.status === 'banned') {
    res.status(403).json({
      error: req.authUser.banReason ? `账号已被封禁：${req.authUser.banReason}` : '账号已被封禁，无法执行写操作',
      code: 'USER_BANNED',
      banReason: req.authUser.banReason,
      bannedAt: req.authUser.bannedAt,
    });
    return;
  }

  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser || !isAdminRole(req.authUser.role)) {
    res.status(403).json({ error: '需要管理员权限' });
    return;
  }
  if (req.authUser.status === 'banned') {
    res.status(403).json({ error: '账号已被封禁，无法执行管理操作' });
    return;
  }
  next();
}

function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser || req.authUser.role !== 'super_admin') {
    res.status(403).json({ error: '需要超级管理员权限' });
    return;
  }
  if (req.authUser.status === 'banned') {
    res.status(403).json({ error: '账号已被封禁，无法执行管理操作' });
    return;
  }
  next();
}

function toWikiResponse(page: {
  id: string;
  slug: string;
  title: string;
  category: string;
  content: string;
  tags: unknown;
  eventDate: string | null;
  status: ContentStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  viewCount?: number;
  favoritesCount: number;
  lastEditorUid: string;
  lastEditorName: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    category: page.category,
    content: page.content,
    tags: serializeTags(page.tags),
    eventDate: page.eventDate,
    status: page.status,
    reviewNote: page.reviewNote,
    reviewedBy: page.reviewedBy,
    reviewedAt: page.reviewedAt ? page.reviewedAt.toISOString() : null,
    viewCount: page.viewCount ?? 0,
    favoritesCount: page.favoritesCount,
    lastEditorUid: page.lastEditorUid,
    lastEditorName: page.lastEditorName,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}

function toPostResponse(post: {
  id: string;
  title: string;
  section: string;
  content: string;
  tags: unknown;
  authorUid: string;
  status: ContentStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  hotScore?: number;
  viewCount?: number;
  likesCount: number;
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...post,
    hotScore: post.hotScore ?? 0,
    viewCount: post.viewCount ?? 0,
    tags: serializeTags(post.tags),
    reviewedAt: post.reviewedAt ? post.reviewedAt.toISOString() : null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

function toCommentResponse(comment: {
  id: string;
  postId: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string | null;
  content: string;
  parentId: string | null;
  createdAt: Date;
}) {
  return {
    ...comment,
    createdAt: comment.createdAt.toISOString(),
  };
}

function toGalleryResponse(gallery: {
  id: string;
  title: string;
  description: string;
  authorUid: string;
  authorName: string;
  tags: unknown;
  createdAt: Date;
  updatedAt: Date;
  images: {
    id: string;
    url: string;
    name: string;
    sortOrder: number;
  }[];
}) {
  return {
    id: gallery.id,
    title: gallery.title,
    description: gallery.description,
    authorUid: gallery.authorUid,
    authorName: gallery.authorName,
    tags: serializeTags(gallery.tags),
    createdAt: gallery.createdAt.toISOString(),
    updatedAt: gallery.updatedAt.toISOString(),
    images: gallery.images
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((image) => ({ url: image.url, name: image.name })),
  };
}

app.use(authMiddleware);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/auth/me', async (req: AuthenticatedRequest, res) => {
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

app.post('/api/auth/register', async (req, res) => {
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

app.post('/api/auth/login', async (req, res) => {
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

app.post('/api/auth/wechat/login', async (req, res) => {
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

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(req, res);
  res.json({ success: true });
});

app.patch('/api/users/me', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { displayName, bio, photoURL } = req.body as {
      displayName?: string;
      bio?: string;
      photoURL?: string;
    };

    const user = await prisma.user.update({
      where: { uid: req.authUser!.uid },
      data: {
        displayName: typeof displayName === 'string' ? displayName : undefined,
        bio: typeof bio === 'string' ? bio : undefined,
        photoURL: typeof photoURL === 'string' ? photoURL : undefined,
      },
    });

    res.json({ user: userToApiUser(user) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: '更新资料失败' });
  }
});

app.get('/api/sections', async (_req, res) => {
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

app.post('/api/sections', requireAdmin, async (req, res) => {
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

app.delete('/api/sections/:id', requireAdmin, async (req, res) => {
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

app.get('/api/announcements/latest', async (_req, res) => {
  try {
    const announcement = await prisma.announcement.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ announcement });
  } catch (error) {
    console.error('Fetch latest announcement error:', error);
    res.status(500).json({ error: '获取公告失败' });
  }
});

app.get('/api/announcements', requireAdmin, async (_req, res) => {
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

app.post('/api/announcements', requireAdmin, async (req, res) => {
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

    res.status(201).json({ announcement });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: '发布公告失败' });
  }
});

app.patch('/api/announcements/:id', requireAdmin, async (req, res) => {
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

    res.json({ announcement });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ error: '更新公告失败' });
  }
});

app.delete('/api/announcements/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.announcement.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: '删除公告失败' });
  }
});

app.get('/api/users', requireAdmin, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        uid: true,
        email: true,
        displayName: true,
        photoURL: true,
        role: true,
        status: true,
        banReason: true,
        bannedAt: true,
        level: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ users: users.map(toUserResponse) });
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: '获取用户失败' });
  }
});

app.patch('/api/users/:uid/role', requireSuperAdmin, async (req, res) => {
  try {
    const { role } = req.body as { role?: PrismaUserRole };
    if (!role || !['user', 'admin', 'super_admin'].includes(role)) {
      res.status(400).json({ error: '无效角色' });
      return;
    }

    const user = await prisma.user.update({
      where: { uid: req.params.uid },
      data: { role },
      select: {
        uid: true,
        email: true,
        displayName: true,
        photoURL: true,
        role: true,
        status: true,
        banReason: true,
        bannedAt: true,
        level: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ user: toUserResponse(user) });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: '更新角色失败' });
  }
});

app.post('/api/admin/users/:uid/ban', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUid = req.params.uid;
    if (!targetUid) {
      res.status(400).json({ error: '无效用户' });
      return;
    }

    if (req.authUser?.uid === targetUid) {
      res.status(400).json({ error: '不能封禁自己' });
      return;
    }

    const noteRaw = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    const reasonRaw = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const finalReason = reasonRaw || noteRaw || '违反社区规范';

    const user = await prisma.user.update({
      where: { uid: targetUid },
      data: {
        status: 'banned',
        banReason: finalReason,
        bannedAt: new Date(),
      },
      select: {
        uid: true,
        email: true,
        displayName: true,
        photoURL: true,
        role: true,
        status: true,
        banReason: true,
        bannedAt: true,
        level: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.userBanLog.create({
      data: {
        targetUid,
        operatorUid: req.authUser!.uid,
        action: 'ban',
        note: finalReason,
      },
    });

    res.json({ user: toUserResponse(user) });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ error: '封禁用户失败' });
  }
});

app.post('/api/admin/users/:uid/unban', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUid = req.params.uid;
    if (!targetUid) {
      res.status(400).json({ error: '无效用户' });
      return;
    }

    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    const user = await prisma.user.update({
      where: { uid: targetUid },
      data: {
        status: 'active',
        banReason: null,
        bannedAt: null,
      },
      select: {
        uid: true,
        email: true,
        displayName: true,
        photoURL: true,
        role: true,
        status: true,
        banReason: true,
        bannedAt: true,
        level: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.userBanLog.create({
      data: {
        targetUid,
        operatorUid: req.authUser!.uid,
        action: 'unban',
        note: note || null,
      },
    });

    res.json({ user: toUserResponse(user) });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ error: '解封用户失败' });
  }
});

app.get('/api/users/:uid', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.authUser?.uid !== req.params.uid && req.authUser?.role === 'user') {
      res.status(403).json({ error: '无权访问该用户信息' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { uid: req.params.uid },
      select: {
        uid: true,
        email: true,
        displayName: true,
        photoURL: true,
        role: true,
        status: true,
        banReason: true,
        bannedAt: true,
        level: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    res.json({ user: toUserResponse(user) });
  } catch (error) {
    console.error('Fetch user detail error:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

app.get('/api/users/:uid/posts', async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.params.uid;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const visibilityWhere = buildPostVisibilityWhere(req.authUser);

    const where = {
      authorUid: uid,
      ...visibilityWhere,
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.post.count({ where }),
    ]);

    const likedPostSet = new Set<string>();
    const favoritedPostSet = new Set<string>();
    if (req.authUser && posts.length) {
      const [likedPosts, favoritedPosts] = await Promise.all([
        prisma.postLike.findMany({
          where: {
            userUid: req.authUser.uid,
            postId: { in: posts.map((item) => item.id) },
          },
          select: { postId: true },
        }),
        prisma.favorite.findMany({
          where: {
            userUid: req.authUser.uid,
            targetType: 'post',
            targetId: { in: posts.map((item) => item.id) },
          },
          select: { targetId: true },
        }),
      ]);
      likedPosts.forEach((item) => likedPostSet.add(item.postId));
      favoritedPosts.forEach((item) => favoritedPostSet.add(item.targetId));
    }

    res.json({
      posts: posts.map((post) => ({
        ...toPostResponse(post),
        likedByMe: likedPostSet.has(post.id),
        favoritedByMe: favoritedPostSet.has(post.id),
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Fetch user posts error:', error);
    res.status(500).json({ error: '获取用户帖子失败' });
  }
});

app.get('/api/users/:uid/comments', async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.params.uid;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const visibilityWhere = buildPostVisibilityWhere(req.authUser);

    const comments = await prisma.postComment.findMany({
      where: {
        authorUid: uid,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });

    const postIds = [...new Set(comments.map((c) => c.postId))];
    const postsMap = new Map<string, { id: string; title: string; status: string }>();

    if (postIds.length) {
      const posts = await prisma.post.findMany({
        where: {
          id: { in: postIds },
          ...visibilityWhere,
        },
        select: { id: true, title: true, status: true },
      });
      posts.forEach((p) => postsMap.set(p.id, p));
    }

    const total = await prisma.postComment.count({ where: { authorUid: uid } });

    res.json({
      comments: comments.map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        authorUid: comment.authorUid,
        authorName: comment.authorName,
        authorPhoto: comment.authorPhoto,
        content: comment.content,
        parentId: comment.parentId,
        createdAt: comment.createdAt.toISOString(),
        post: comment.postId && postsMap.has(comment.postId) ? postsMap.get(comment.postId)! : null,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Fetch user comments error:', error);
    res.status(500).json({ error: '获取用户评论失败' });
  }
});

app.get('/api/users/me/history', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userUid = req.authUser!.uid;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const rawType = req.query.type;
    const targetType: BrowsingTargetType | undefined =
      rawType === 'wiki' || rawType === 'post' || rawType === 'music'
        ? rawType
        : undefined;

    const where: Prisma.BrowsingHistoryWhereInput = {
      userUid,
      ...(targetType ? { targetType } : {}),
    };

    const [history, total] = await Promise.all([
      prisma.browsingHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.browsingHistory.count({ where }),
    ]);

    const wikiSlugs = history.filter((h) => h.targetType === 'wiki').map((h) => h.targetId);
    const postIds = history.filter((h) => h.targetType === 'post').map((h) => h.targetId);

    const [wikiPages, posts] = await Promise.all([
      wikiSlugs.length
        ? prisma.wikiPage.findMany({
            where: { slug: { in: wikiSlugs } },
            select: { slug: true, title: true, category: true, status: true },
          })
        : Promise.resolve([]),
      postIds.length
        ? prisma.post.findMany({
            where: { id: { in: postIds } },
            select: { id: true, title: true, status: true },
          })
        : Promise.resolve([]),
    ]);

    const wikiMap = new Map(wikiPages.map((w) => [w.slug, w]));
    const postMap = new Map(posts.map((p) => [p.id, p]));

    res.json({
      history: history.map((h) => {
        let target: Record<string, unknown> | null = null;
        if (h.targetType === 'wiki' && wikiMap.has(h.targetId)) {
          target = { ...wikiMap.get(h.targetId)!, type: 'wiki' as const };
        } else if (h.targetType === 'post' && postMap.has(h.targetId)) {
          target = { ...postMap.get(h.targetId)!, type: 'post' as const };
        } else if (h.targetType === 'music') {
          target = { id: h.targetId, type: 'music' as const };
        }
        return {
          id: h.id,
          targetType: h.targetType,
          targetId: h.targetId,
          createdAt: h.createdAt.toISOString(),
          target,
        };
      }),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Fetch browsing history error:', error);
    res.status(500).json({ error: '获取浏览历史失败' });
  }
});

app.get('/api/notifications', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userUid = req.authUser!.uid;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const unreadOnly = req.query.unread === 'true';

    const where = {
      userUid,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userUid, isRead: false } }),
    ]);

    res.json({
      notifications: notifications.map(toNotificationResponse),
      total,
      unreadCount,
      page,
      limit,
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ error: '获取通知失败' });
  }
});

app.post('/api/notifications/:id/read', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userUid = req.authUser!.uid;
    const notificationId = req.params.id;

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, userUid: true, isRead: true },
    });

    if (!notification) {
      res.status(404).json({ error: '通知不存在' });
      return;
    }

    if (notification.userUid !== userUid) {
      res.status(403).json({ error: '无权操作该通知' });
      return;
    }

    if (!notification.isRead) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: '标记已读失败' });
  }
});

app.post('/api/notifications/read-all', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userUid = req.authUser!.uid;

    await prisma.notification.updateMany({
      where: { userUid, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: '全部标记已读失败' });
  }
});

app.get('/api/wiki', async (req: AuthenticatedRequest, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : 'all';
    const visibilityWhere = buildWikiVisibilityWhere(req.authUser);
    const where = {
      ...(category && category !== 'all' ? { category } : {}),
      ...visibilityWhere,
    };

    const pages = await prisma.wikiPage.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    const favoritedWikiSet = new Set<string>();
    if (req.authUser && pages.length) {
      const favorites = await prisma.favorite.findMany({
        where: {
          userUid: req.authUser.uid,
          targetType: 'wiki',
          targetId: { in: pages.map((item) => item.slug) },
        },
        select: { targetId: true },
      });
      favorites.forEach((item) => favoritedWikiSet.add(item.targetId));
    }

    res.json({
      pages: pages.map((page) => ({
        ...toWikiResponse(page),
        favoritedByMe: favoritedWikiSet.has(page.slug),
      })),
    });
  } catch (error) {
    console.error('Fetch wiki pages error:', error);
    res.status(500).json({ error: '获取百科失败' });
  }
});

app.get('/api/mp/wiki', async (req: AuthenticatedRequest, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : 'all';
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const where = {
      status: 'published' as ContentStatus,
      ...(category && category !== 'all' ? { category } : {}),
    };

    const [pages, total] = await Promise.all([
      prisma.wikiPage.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        take: limit,
        skip,
        select: {
          slug: true,
          title: true,
          category: true,
          tags: true,
          eventDate: true,
          updatedAt: true,
          favoritesCount: true,
        },
      }),
      prisma.wikiPage.count({ where }),
    ]);

    res.json({
      items: pages.map((page) => ({
        slug: page.slug,
        title: page.title,
        category: page.category,
        tags: serializeTags(page.tags),
        eventDate: page.eventDate,
        favoritesCount: page.favoritesCount,
        updatedAt: page.updatedAt.toISOString(),
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Fetch mp wiki list error:', error);
    res.status(500).json({ error: '获取小程序百科失败' });
  }
});

app.get('/api/wiki/timeline', async (req: AuthenticatedRequest, res) => {
  try {
    const pages = await prisma.wikiPage.findMany({
      where: {
        ...buildWikiVisibilityWhere(req.authUser),
        eventDate: {
          not: null,
        },
      },
      orderBy: {
        eventDate: 'asc',
      },
    });

    const favoritedWikiSet = new Set<string>();
    if (req.authUser && pages.length) {
      const favorites = await prisma.favorite.findMany({
        where: {
          userUid: req.authUser.uid,
          targetType: 'wiki',
          targetId: { in: pages.map((item) => item.slug) },
        },
        select: { targetId: true },
      });
      favorites.forEach((item) => favoritedWikiSet.add(item.targetId));
    }

    res.json({
      events: pages.map((page) => ({
        ...toWikiResponse(page),
        favoritedByMe: favoritedWikiSet.has(page.slug),
      })),
    });
  } catch (error) {
    console.error('Fetch wiki timeline error:', error);
    res.status(500).json({ error: '获取时间轴失败' });
  }
});

app.get('/api/wiki/recommended', async (req: AuthenticatedRequest, res) => {
  try {
    const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';
    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 24);

    const visibilityWhere = buildWikiVisibilityWhere(req.authUser);

    const basePage = slug
      ? await prisma.wikiPage.findUnique({
          where: { slug },
          select: {
            slug: true,
            category: true,
            tags: true,
            status: true,
            lastEditorUid: true,
          },
        })
      : null;

    if (basePage && !canViewWikiPage(basePage, req.authUser)) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    const candidates = await prisma.wikiPage.findMany({
      where: {
        ...visibilityWhere,
        ...(slug ? { slug: { not: slug } } : {}),
      },
      orderBy: [{ favoritesCount: 'desc' }, { viewCount: 'desc' }, { updatedAt: 'desc' }],
      take: 120,
    });

    const baseTags = new Set<string>(serializeTags(basePage?.tags).map((item) => String(item).toLowerCase()));

    const scored = candidates.map((item) => {
      let score = item.favoritesCount * 3 + (item.viewCount ?? 0) * 0.35;
      if (basePage && item.category === basePage.category) {
        score += 2;
      }

      if (baseTags.size) {
        const tags = serializeTags(item.tags).map((tag) => String(tag).toLowerCase());
        const sharedCount = tags.filter((tag) => baseTags.has(tag)).length;
        score += sharedCount * 0.8;
      }

      const hoursSince = Math.max(0, (Date.now() - item.updatedAt.getTime()) / (1000 * 60 * 60));
      score += 3 / (1 + (hoursSince / 48));

      return {
        item,
        score: Number(score.toFixed(3)),
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, limit);

    const favoritedWikiSet = new Set<string>();
    if (req.authUser && top.length) {
      const favorites = await prisma.favorite.findMany({
        where: {
          userUid: req.authUser.uid,
          targetType: 'wiki',
          targetId: { in: top.map((entry) => entry.item.slug) },
        },
        select: { targetId: true },
      });
      favorites.forEach((favorite) => favoritedWikiSet.add(favorite.targetId));
    }

    res.json({
      items: top.map((entry) => ({
        ...toWikiResponse(entry.item),
        score: entry.score,
        favoritedByMe: favoritedWikiSet.has(entry.item.slug),
      })),
    });
  } catch (error) {
    console.error('Fetch wiki recommended error:', error);
    res.status(500).json({ error: '获取推荐百科失败' });
  }
});

app.get('/api/wiki/:slug', async (req: AuthenticatedRequest, res) => {
  try {
    const page = await prisma.wikiPage.findUnique({
      where: { slug: req.params.slug },
    });

    if (!page || !canViewWikiPage(page, req.authUser)) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    await prisma.$executeRaw`UPDATE \`WikiPage\` SET \`viewCount\` = \`viewCount\` + 1 WHERE \`slug\` = ${req.params.slug}`;
    const freshPage = await prisma.wikiPage.findUnique({
      where: { slug: req.params.slug },
    });

    if (!freshPage) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    if (req.authUser) {
      await recordBrowsingHistory(req.authUser.uid, 'wiki', req.params.slug);
    }

    const backlinks = await prisma.wikiPage.findMany({
      where: {
        ...buildWikiVisibilityWhere(req.authUser),
        slug: { not: req.params.slug },
        content: {
          contains: `[[${req.params.slug}]]`,
        },
      },
      take: 100,
      orderBy: { updatedAt: 'desc' },
    });

    const favoritedByMe = req.authUser
      ? (await prisma.favorite.count({
          where: {
            userUid: req.authUser.uid,
            targetType: 'wiki',
            targetId: req.params.slug,
          },
        })) > 0
      : false;

    res.json({
      page: {
        ...toWikiResponse(freshPage),
        favoritedByMe,
      },
      backlinks: backlinks.map(toWikiResponse),
    });
  } catch (error) {
    console.error('Fetch wiki page error:', error);
    res.status(500).json({ error: '获取页面失败' });
  }
});

app.get('/api/wiki/:slug/history', async (req: AuthenticatedRequest, res) => {
  try {
    const page = await prisma.wikiPage.findUnique({
      where: { slug: req.params.slug },
      select: {
        slug: true,
        status: true,
        lastEditorUid: true,
      },
    });

    if (!page) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    if (!canViewWikiPage(page, req.authUser)) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    const revisions = await prisma.wikiRevision.findMany({
      where: { pageSlug: req.params.slug },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      revisions: revisions.map((revision) => ({
        ...revision,
        createdAt: revision.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Fetch wiki history error:', error);
    res.status(500).json({ error: '获取历史记录失败' });
  }
});

app.post('/api/wiki/:slug/submit', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const slug = req.params.slug;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    const page = await prisma.wikiPage.findUnique({
      where: { slug },
      select: {
        slug: true,
        lastEditorUid: true,
        status: true,
      },
    });

    if (!page) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    const isOwner = page.lastEditorUid === req.authUser!.uid;
    if (!isOwner && !isAdminRole(req.authUser!.role)) {
      res.status(403).json({ error: '无权提交该页面' });
      return;
    }

    const updated = await prisma.wikiPage.update({
      where: { slug },
      data: {
        status: 'pending',
        reviewNote: note || null,
        reviewedBy: null,
        reviewedAt: null,
      },
    });

    await prisma.moderationLog.create({
      data: {
        targetType: 'wiki',
        targetId: slug,
        action: 'submit',
        operatorUid: req.authUser!.uid,
        note: note || null,
      },
    });

    res.json({ page: toWikiResponse(updated) });
  } catch (error) {
    console.error('Submit wiki review error:', error);
    res.status(500).json({ error: '提交审核失败' });
  }
});

app.post('/api/wiki', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      title,
      slug,
      category,
      content,
      tags,
      eventDate,
      status,
    } = req.body as {
      title?: string;
      slug?: string;
      category?: string;
      content?: string;
      tags?: string[];
      eventDate?: string;
      status?: ContentStatus;
    };

    if (!title || !slug || !category || !content) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    if (category === 'music' && req.authUser?.role === 'user') {
      res.status(403).json({ error: '只有管理员可以编辑音乐分类内容' });
      return;
    }

    const pageSlug = slug.trim().toLowerCase();
    const existing = await prisma.wikiPage.findUnique({
      where: { slug: pageSlug },
    });

    if (existing) {
      res.status(409).json({ error: '该 slug 已存在' });
      return;
    }

    const nextStatus = normalizeWikiWriteStatus(status, req.authUser!);

    const page = await prisma.wikiPage.create({
      data: {
        slug: pageSlug,
        title,
        category,
        content,
        tags: tags || [],
        eventDate: eventDate || null,
        status: nextStatus,
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        lastEditorUid: req.authUser!.uid,
        lastEditorName: req.authUser!.displayName,
      },
    });

    await prisma.wikiRevision.create({
      data: {
        pageSlug,
        title,
        content,
        editorUid: req.authUser!.uid,
        editorName: req.authUser!.displayName,
      },
    });

    if (nextStatus === 'pending') {
      await prisma.moderationLog.create({
        data: {
          targetType: 'wiki',
          targetId: pageSlug,
          action: 'submit',
          operatorUid: req.authUser!.uid,
          note: null,
        },
      });
    }

    res.status(201).json({ page: toWikiResponse(page) });
  } catch (error) {
    console.error('Create wiki page error:', error);
    res.status(500).json({ error: '保存页面失败' });
  }
});

app.put('/api/wiki/:slug', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      title,
      category,
      content,
      tags,
      eventDate,
      status,
    } = req.body as {
      title?: string;
      category?: string;
      content?: string;
      tags?: string[];
      eventDate?: string;
      status?: ContentStatus;
    };

    if (!title || !category || !content) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    if (category === 'music' && req.authUser?.role === 'user') {
      res.status(403).json({ error: '只有管理员可以编辑音乐分类内容' });
      return;
    }

    const existingPage = await prisma.wikiPage.findUnique({
      where: { slug: req.params.slug },
      select: {
        slug: true,
        lastEditorUid: true,
        status: true,
      },
    });

    if (!existingPage) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    if (!isAdminRole(req.authUser!.role) && existingPage.lastEditorUid !== req.authUser!.uid) {
      res.status(403).json({ error: '无权编辑该页面' });
      return;
    }

    const nextStatus = normalizeWikiWriteStatus(status, req.authUser!);

    const page = await prisma.wikiPage.update({
      where: { slug: req.params.slug },
      data: {
        title,
        category,
        content,
        tags: tags || [],
        eventDate: eventDate || null,
        status: nextStatus,
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        lastEditorUid: req.authUser!.uid,
        lastEditorName: req.authUser!.displayName,
      },
    });

    await prisma.wikiRevision.create({
      data: {
        pageSlug: req.params.slug,
        title,
        content,
        editorUid: req.authUser!.uid,
        editorName: req.authUser!.displayName,
      },
    });

    if (nextStatus === 'pending') {
      await prisma.moderationLog.create({
        data: {
          targetType: 'wiki',
          targetId: req.params.slug,
          action: 'submit',
          operatorUid: req.authUser!.uid,
          note: null,
        },
      });
    }

    res.json({ page: toWikiResponse(page) });
  } catch (error) {
    console.error('Update wiki page error:', error);
    res.status(500).json({ error: '更新页面失败' });
  }
});

app.post('/api/wiki/:slug/rollback/:revisionId', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const revision = await prisma.wikiRevision.findUnique({
      where: { id: req.params.revisionId },
    });
    if (!revision || revision.pageSlug !== req.params.slug) {
      res.status(404).json({ error: '历史版本不存在' });
      return;
    }

    const currentPage = await prisma.wikiPage.findUnique({
      where: { slug: req.params.slug },
      select: {
        slug: true,
        lastEditorUid: true,
      },
    });

    if (!currentPage) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    if (!isAdminRole(req.authUser!.role) && currentPage.lastEditorUid !== req.authUser!.uid) {
      res.status(403).json({ error: '无权回滚该页面' });
      return;
    }

    const page = await prisma.wikiPage.update({
      where: { slug: req.params.slug },
      data: {
        title: revision.title,
        content: revision.content,
        status: isAdminRole(req.authUser!.role) ? 'published' : 'pending',
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        lastEditorUid: req.authUser!.uid,
        lastEditorName: req.authUser!.displayName,
      },
    });

    await prisma.moderationLog.create({
      data: {
        targetType: 'wiki',
        targetId: req.params.slug,
        action: 'rollback',
        operatorUid: req.authUser!.uid,
        note: `回滚到版本 ${req.params.revisionId}`,
      },
    });

    res.json({ page: toWikiResponse(page) });
  } catch (error) {
    console.error('Rollback wiki page error:', error);
    res.status(500).json({ error: '回滚失败' });
  }
});

app.post('/api/wiki/:slug/revisions', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, content } = req.body as {
      title?: string;
      content?: string;
    };

    if (!title || !content) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    const revision = await prisma.wikiRevision.create({
      data: {
        pageSlug: req.params.slug,
        title,
        content,
        editorUid: req.authUser!.uid,
        editorName: req.authUser!.displayName,
      },
    });

    res.status(201).json({
      revision: {
        ...revision,
        createdAt: revision.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create wiki revision error:', error);
    res.status(500).json({ error: '保存历史版本失败' });
  }
});

app.get('/api/posts', async (req: AuthenticatedRequest, res) => {
  try {
    const section = typeof req.query.section === 'string' ? req.query.section : 'all';
    const limit = Number(req.query.limit) || 100;
    const sort = parsePostSort(req.query.sort);
    const visibilityWhere = buildPostVisibilityWhere(req.authUser);
    const where = {
      ...(section !== 'all' ? { section } : {}),
      ...visibilityWhere,
    };

    let orderBy: Array<Record<string, 'asc' | 'desc'>>;
    if (sort === 'hot') {
      orderBy = [{ hotScore: 'desc' }, { updatedAt: 'desc' }];
    } else if (sort === 'recommended') {
      orderBy = [{ commentsCount: 'desc' }, { likesCount: 'desc' }, { updatedAt: 'desc' }];
    } else {
      orderBy = [{ updatedAt: 'desc' }];
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy,
      take: Math.min(limit, 200),
    });

    if (sort !== 'latest' && posts.length) {
      const updates = posts
        .map((post) => ({
          id: post.id,
          hotScore: calculatePostHotScore(post),
        }))
        .filter((item) => Number.isFinite(item.hotScore));

      await Promise.all(
        updates.map((item) =>
          prisma.post.update({
            where: { id: item.id },
            data: { hotScore: item.hotScore },
          }),
        ),
      );
    }

    const likedPostSet = new Set<string>();
    const favoritedPostSet = new Set<string>();
    if (req.authUser && posts.length) {
      const [likedPosts, favoritedPosts] = await Promise.all([
        prisma.postLike.findMany({
          where: {
            userUid: req.authUser.uid,
            postId: { in: posts.map((item) => item.id) },
          },
          select: { postId: true },
        }),
        prisma.favorite.findMany({
          where: {
            userUid: req.authUser.uid,
            targetType: 'post',
            targetId: { in: posts.map((item) => item.id) },
          },
          select: { targetId: true },
        }),
      ]);
      likedPosts.forEach((item) => likedPostSet.add(item.postId));
      favoritedPosts.forEach((item) => favoritedPostSet.add(item.targetId));
    }

    res.json({
      posts: posts.map((post) => ({
        ...toPostResponse(post),
        likedByMe: likedPostSet.has(post.id),
        favoritedByMe: favoritedPostSet.has(post.id),
      })),
    });
  } catch (error) {
    console.error('Fetch posts error:', error);
    res.status(500).json({ error: '获取帖子失败' });
  }
});

app.get('/api/home/feed', async (req: AuthenticatedRequest, res) => {
  try {
    const visibilityWhere = buildPostVisibilityWhere(req.authUser);

    const [announcements, hotPosts, recentPosts] = await Promise.all([
      prisma.announcement.findMany({
        where: { active: true },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      prisma.post.findMany({
        where: { ...visibilityWhere, status: 'published' },
        orderBy: [{ hotScore: 'desc' }, { updatedAt: 'desc' }],
        take: 6,
      }),
      prisma.post.findMany({
        where: { ...visibilityWhere, status: 'published' },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    ]);

    const likedHotSet = new Set<string>();
    const favoritedHotSet = new Set<string>();
    if (req.authUser && hotPosts.length) {
      const [likedPosts, favoritedPosts] = await Promise.all([
        prisma.postLike.findMany({
          where: { userUid: req.authUser.uid, postId: { in: hotPosts.map((p) => p.id) } },
          select: { postId: true },
        }),
        prisma.favorite.findMany({
          where: { userUid: req.authUser.uid, targetType: 'post', targetId: { in: hotPosts.map((p) => p.id) } },
          select: { targetId: true },
        }),
      ]);
      likedPosts.forEach((item) => likedHotSet.add(item.postId));
      favoritedPosts.forEach((item) => favoritedHotSet.add(item.targetId));
    }

    res.json({
      announcements: announcements.map((a) => ({
        id: a.id,
        content: a.content,
        link: a.link,
        createdAt: a.createdAt.toISOString(),
      })),
      hotPosts: hotPosts.map((post) => ({
        ...toPostResponse(post),
        likedByMe: likedHotSet.has(post.id),
        favoritedByMe: favoritedHotSet.has(post.id),
      })),
      recentPosts: recentPosts.map(toPostResponse),
    });
  } catch (error) {
    console.error('Fetch home feed error:', error);
    res.status(500).json({ error: '获取首页信息失败' });
  }
});

app.get('/api/posts/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
    });

    if (!post || !canViewPost(post, req.authUser)) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    await prisma.$executeRaw`UPDATE \`Post\` SET \`viewCount\` = \`viewCount\` + 1 WHERE \`id\` = ${req.params.id}`;
    const freshPost = await prisma.post.findUnique({
      where: { id: req.params.id },
    });
    if (!freshPost) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    const hotScore = calculatePostHotScore(freshPost);
    await prisma.post.update({
      where: { id: req.params.id },
      data: { hotScore },
    });

    if (req.authUser) {
      await recordBrowsingHistory(req.authUser.uid, 'post', req.params.id);
    }

    const comments = await prisma.postComment.findMany({
      where: { postId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });

    const [likedByMe, favoritedByMe] = req.authUser
      ? await Promise.all([
          prisma.postLike.count({
            where: {
              postId: req.params.id,
              userUid: req.authUser.uid,
            },
          }).then((count) => count > 0),
          prisma.favorite.count({
            where: {
              targetType: 'post',
              targetId: req.params.id,
              userUid: req.authUser.uid,
            },
          }).then((count) => count > 0),
        ])
      : [false, false];

    res.json({
      post: {
        ...toPostResponse({
          ...freshPost,
          hotScore,
        }),
        likedByMe,
        favoritedByMe,
      },
      comments: comments.map(toCommentResponse),
    });
  } catch (error) {
    console.error('Fetch post detail error:', error);
    res.status(500).json({ error: '获取帖子详情失败' });
  }
});

app.post('/api/posts', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, section, content, tags, status } = req.body as {
      title?: string;
      section?: string;
      content?: string;
      tags?: string[];
      status?: ContentStatus;
    };

    if (!title || !section || !content) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    const sectionExists = await prisma.section.findUnique({
      where: { id: section },
      select: { id: true },
    });
    if (!sectionExists) {
      res.status(400).json({ error: '版块不存在' });
      return;
    }

    const nextStatus = normalizePostWriteStatus(status, req.authUser!);

    const post = await prisma.post.create({
      data: {
        title,
        section,
        content,
        tags: tags || [],
        status: nextStatus,
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        authorUid: req.authUser!.uid,
      },
    });

    if (nextStatus === 'pending') {
      await prisma.moderationLog.create({
        data: {
          targetType: 'post',
          targetId: post.id,
          action: 'submit',
          operatorUid: req.authUser!.uid,
          note: null,
        },
      });
    }

    res.status(201).json({ post: toPostResponse(post) });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: '发布帖子失败' });
  }
});

app.post('/api/mp/posts', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, section, content, tags } = req.body as {
      title?: string;
      section?: string;
      content?: string;
      tags?: string[];
    };

    if (!title || !section || !content) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    const sectionExists = await prisma.section.findUnique({
      where: { id: section },
      select: { id: true },
    });
    if (!sectionExists) {
      res.status(400).json({ error: '版块不存在' });
      return;
    }

    const post = await prisma.post.create({
      data: {
        title,
        section,
        content,
        tags: tags || [],
        status: isAdminRole(req.authUser!.role) ? 'published' : 'pending',
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        authorUid: req.authUser!.uid,
      },
    });

    if (!isAdminRole(req.authUser!.role)) {
      await prisma.moderationLog.create({
        data: {
          targetType: 'post',
          targetId: post.id,
          action: 'submit',
          operatorUid: req.authUser!.uid,
          note: 'mp 端投稿',
        },
      });
    }

    res.status(201).json({
      post: {
        id: post.id,
        title: post.title,
        section: post.section,
        status: post.status,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create mp post error:', error);
    res.status(500).json({ error: '小程序发帖失败' });
  }
});

app.post('/api/posts/:id/comments', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { content, parentId } = req.body as {
      content?: string;
      parentId?: string | null;
    };

    if (!content || !content.trim()) {
      res.status(400).json({ error: '评论内容不能为空' });
      return;
    }

    const currentPost = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        status: true,
        authorUid: true,
      },
    });

    if (!currentPost || !canViewPost(currentPost, req.authUser)) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    if (currentPost.status !== 'published') {
      res.status(403).json({ error: '仅已发布内容可评论' });
      return;
    }

    let replyTargetUid: string | null = null;
    if (parentId) {
      const parent = await prisma.postComment.findUnique({
        where: { id: parentId },
        select: {
          id: true,
          postId: true,
          authorUid: true,
        },
      });
      if (!parent || parent.postId !== req.params.id) {
        res.status(400).json({ error: '回复目标不存在' });
        return;
      }
      replyTargetUid = parent.authorUid;
    }

    const comment = await prisma.postComment.create({
      data: {
        postId: req.params.id,
        authorUid: req.authUser!.uid,
        authorName: req.authUser!.displayName,
        authorPhoto: req.authUser!.photoURL,
        content,
        parentId: parentId || null,
      },
    });

    await prisma.post.update({
      where: { id: req.params.id },
      data: {
        commentsCount: { increment: 1 },
      },
    });

    const notifyUid = replyTargetUid || currentPost.authorUid;
    if (notifyUid && notifyUid !== req.authUser!.uid) {
      await createNotification(notifyUid, 'reply', {
        postId: req.params.id,
        commentId: comment.id,
        actorUid: req.authUser!.uid,
        actorName: req.authUser!.displayName,
        preview: comment.content.slice(0, 120),
      });
    }

    res.status(201).json({ comment: toCommentResponse(comment) });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: '发表评论失败' });
  }
});

app.post('/api/mp/comments', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { postId, content, parentId } = req.body as {
      postId?: string;
      content?: string;
      parentId?: string | null;
    };

    if (!postId || !content || !content.trim()) {
      res.status(400).json({ error: 'postId 和评论内容不能为空' });
      return;
    }

    const currentPost = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        status: true,
        authorUid: true,
      },
    });

    if (!currentPost || !canViewPost(currentPost, req.authUser)) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    if (currentPost.status !== 'published') {
      res.status(403).json({ error: '仅已发布内容可评论' });
      return;
    }

    let replyTargetUid: string | null = null;
    if (parentId) {
      const parent = await prisma.postComment.findUnique({
        where: { id: parentId },
        select: {
          id: true,
          postId: true,
          authorUid: true,
        },
      });
      if (!parent || parent.postId !== postId) {
        res.status(400).json({ error: '回复目标不存在' });
        return;
      }
      replyTargetUid = parent.authorUid;
    }

    const comment = await prisma.postComment.create({
      data: {
        postId,
        authorUid: req.authUser!.uid,
        authorName: req.authUser!.displayName,
        authorPhoto: req.authUser!.photoURL,
        content,
        parentId: parentId || null,
      },
    });

    await prisma.post.update({
      where: { id: postId },
      data: {
        commentsCount: { increment: 1 },
      },
    });

    const notifyUid = replyTargetUid || currentPost.authorUid;
    if (notifyUid && notifyUid !== req.authUser!.uid) {
      await createNotification(notifyUid, 'reply', {
        postId,
        commentId: comment.id,
        actorUid: req.authUser!.uid,
        actorName: req.authUser!.displayName,
        preview: comment.content.slice(0, 120),
      });
    }

    res.status(201).json({
      comment: {
        id: comment.id,
        postId: comment.postId,
        authorUid: comment.authorUid,
        authorName: comment.authorName,
        content: comment.content,
        parentId: comment.parentId,
        createdAt: comment.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create mp comment error:', error);
    res.status(500).json({ error: '小程序评论失败' });
  }
});

app.post('/api/posts/:id/submit', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const postId = req.params.id;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorUid: true,
        status: true,
      },
    });

    if (!post) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    const isOwner = post.authorUid === req.authUser!.uid;
    if (!isOwner && !isAdminRole(req.authUser!.role)) {
      res.status(403).json({ error: '无权提交该帖子' });
      return;
    }

    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        status: 'pending',
        reviewNote: note || null,
        reviewedBy: null,
        reviewedAt: null,
      },
    });

    await prisma.moderationLog.create({
      data: {
        targetType: 'post',
        targetId: postId,
        action: 'submit',
        operatorUid: req.authUser!.uid,
        note: note || null,
      },
    });

    res.json({ post: toPostResponse(updated) });
  } catch (error) {
    console.error('Submit post review error:', error);
    res.status(500).json({ error: '提交审核失败' });
  }
});

app.put('/api/posts/:id', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, section, content, tags, status } = req.body as {
      title?: string;
      section?: string;
      content?: string;
      tags?: string[];
      status?: ContentStatus;
    };

    if (!title || !section || !content) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    const existingPost = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        authorUid: true,
        status: true,
      },
    });

    if (!existingPost) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    const isOwner = existingPost.authorUid === req.authUser!.uid;
    const isAdmin = isAdminRole(req.authUser!.role);
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: '无权编辑该帖子' });
      return;
    }

    const sectionExists = await prisma.section.findUnique({
      where: { id: section },
      select: { id: true },
    });
    if (!sectionExists) {
      res.status(400).json({ error: '版块不存在' });
      return;
    }

    let nextStatus: ContentStatus;
    if (isAdmin) {
      nextStatus = parseContentStatus(status) || existingPost.status;
    } else if (existingPost.status === 'published') {
      nextStatus = 'pending';
    } else {
      const normalized = normalizePostWriteStatus(status ?? existingPost.status, req.authUser!);
      nextStatus = existingPost.status === 'pending' && normalized === 'draft' ? 'pending' : normalized;
    }

    const post = await prisma.post.update({
      where: { id: req.params.id },
      data: {
        title,
        section,
        content,
        tags: Array.isArray(tags) ? tags : [],
        status: nextStatus,
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
      },
    });

    if (nextStatus === 'pending') {
      await prisma.moderationLog.create({
        data: {
          targetType: 'post',
          targetId: post.id,
          action: 'submit',
          operatorUid: req.authUser!.uid,
          note: !isAdmin && existingPost.status === 'published' ? '编辑后重新提交审核' : null,
        },
      });
    }

    res.json({ post: toPostResponse(post) });
  } catch (error) {
    console.error('Edit post error:', error);
    res.status(500).json({ error: '编辑帖子失败' });
  }
});

app.post('/api/posts/:id/like', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const postId = req.params.id;
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        status: true,
        authorUid: true,
      },
    });

    if (!post || !canViewPost(post, req.authUser)) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      try {
        await tx.postLike.create({
          data: {
            postId,
            userUid: req.authUser!.uid,
          },
        });
      } catch {
        return;
      }

      await tx.post.update({
        where: { id: postId },
        data: {
          likesCount: { increment: 1 },
        },
      });
    });

    const likesCount = await prisma.postLike.count({ where: { postId } });

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        likesCount,
      },
    });

    const hotScore = calculatePostHotScore(updatedPost);
    await prisma.post.update({
      where: { id: postId },
      data: { hotScore },
    });

    if (post.authorUid !== req.authUser!.uid) {
      await createNotification(post.authorUid, 'like', {
        postId,
        actorUid: req.authUser!.uid,
        actorName: req.authUser!.displayName,
      });
    }

    res.json({ liked: true, likesCount });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: '点赞失败' });
  }
});

app.delete('/api/posts/:id/like', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const postId = req.params.id;

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.postLike.deleteMany({
        where: {
          postId,
          userUid: req.authUser!.uid,
        },
      });

      if (!deleted.count) {
        return;
      }

      await tx.post.update({
        where: { id: postId },
        data: {
          likesCount: { decrement: 1 },
        },
      });
    });

    const likesCount = await prisma.postLike.count({ where: { postId } });
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        likesCount,
      },
    });

    const hotScore = calculatePostHotScore(updatedPost);
    await prisma.post.update({
      where: { id: postId },
      data: { hotScore },
    });

    res.json({ liked: false, likesCount });
  } catch (error) {
    console.error('Unlike post error:', error);
    res.status(500).json({ error: '取消点赞失败' });
  }
});

app.post('/api/favorites', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const targetType = parseFavoriteType(req.body?.targetType);
    const targetId = typeof req.body?.targetId === 'string' ? req.body.targetId.trim() : '';

    if (!targetType || !targetId) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    if (targetType === 'wiki') {
      const page = await prisma.wikiPage.findUnique({
        where: { slug: targetId },
        select: {
          slug: true,
          status: true,
          lastEditorUid: true,
        },
      });
      if (!page || !canViewWikiPage(page, req.authUser)) {
        res.status(404).json({ error: '目标不存在' });
        return;
      }
    }

    if (targetType === 'post') {
      const post = await prisma.post.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          status: true,
          authorUid: true,
        },
      });
      if (!post || !canViewPost(post, req.authUser)) {
        res.status(404).json({ error: '目标不存在' });
        return;
      }
    }

    if (targetType === 'music') {
      const song = await prisma.musicTrack.findUnique({
        where: { docId: targetId },
        select: { docId: true },
      });
      if (!song) {
        res.status(404).json({ error: '目标不存在' });
        return;
      }
    }

    await prisma.favorite.upsert({
      where: {
        userUid_targetType_targetId: {
          userUid: req.authUser!.uid,
          targetType,
          targetId,
        },
      },
      update: {},
      create: {
        userUid: req.authUser!.uid,
        targetType,
        targetId,
      },
    });

    if (targetType === 'wiki') {
      const count = await prisma.favorite.count({
        where: {
          targetType,
          targetId,
        },
      });
      await prisma.wikiPage.update({
        where: { slug: targetId },
        data: { favoritesCount: count },
      });
    }

    res.status(201).json({ favorited: true });
  } catch (error) {
    console.error('Create favorite error:', error);
    res.status(500).json({ error: '收藏失败' });
  }
});

app.delete('/api/favorites/:type/:id', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const targetType = parseFavoriteType(req.params.type);
    const targetId = req.params.id;

    if (!targetType || !targetId) {
      res.status(400).json({ error: '参数错误' });
      return;
    }

    await prisma.favorite.deleteMany({
      where: {
        userUid: req.authUser!.uid,
        targetType,
        targetId,
      },
    });

    if (targetType === 'wiki') {
      const count = await prisma.favorite.count({
        where: {
          targetType,
          targetId,
        },
      });
      await prisma.wikiPage.update({
        where: { slug: targetId },
        data: { favoritesCount: count },
      }).catch(() => undefined);
    }

    res.json({ favorited: false });
  } catch (error) {
    console.error('Delete favorite error:', error);
    res.status(500).json({ error: '取消收藏失败' });
  }
});

app.get('/api/users/me/favorites', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const rawType = req.query.type;
    const requestedType = parseFavoriteType(rawType);
    if (rawType !== undefined && rawType !== null && rawType !== '' && !requestedType) {
      res.status(400).json({ error: '无效收藏类型' });
      return;
    }
    const favorites = await prisma.favorite.findMany({
      where: {
        userUid: req.authUser!.uid,
        ...(requestedType ? { targetType: requestedType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const wikiIds = favorites.filter((item) => item.targetType === 'wiki').map((item) => item.targetId);
    const postIds = favorites.filter((item) => item.targetType === 'post').map((item) => item.targetId);
    const musicIds = favorites.filter((item) => item.targetType === 'music').map((item) => item.targetId);

    const [wikiPages, posts, songs] = await Promise.all([
      wikiIds.length
        ? prisma.wikiPage.findMany({ where: { slug: { in: wikiIds } } })
        : Promise.resolve([]),
      postIds.length
        ? prisma.post.findMany({ where: { id: { in: postIds } } })
        : Promise.resolve([]),
      musicIds.length
        ? prisma.musicTrack.findMany({ where: { docId: { in: musicIds } } })
        : Promise.resolve([]),
    ]);

    const wikiMap = new Map(wikiPages.map((item) => [item.slug, item]));
    const postMap = new Map(posts.map((item) => [item.id, item]));
    const songMap = new Map(songs.map((item) => [item.docId, item]));

    const items = favorites
      .map((favorite) => {
        const base = {
          id: favorite.id,
          targetType: favorite.targetType,
          targetId: favorite.targetId,
          createdAt: favorite.createdAt.toISOString(),
        };

        if (favorite.targetType === 'wiki') {
          const page = wikiMap.get(favorite.targetId);
          if (!page || !canViewWikiPage(page, req.authUser)) return null;
          return {
            ...base,
            target: toWikiResponse(page),
          };
        }

        if (favorite.targetType === 'post') {
          const post = postMap.get(favorite.targetId);
          if (!post || !canViewPost(post, req.authUser)) return null;
          return {
            ...base,
            target: toPostResponse(post),
          };
        }

        if (favorite.targetType === 'music') {
          const song = songMap.get(favorite.targetId);
          if (!song) return null;
          return {
            ...base,
            target: {
              ...song,
              createdAt: song.createdAt.toISOString(),
              updatedAt: song.updatedAt.toISOString(),
            },
          };
        }

        return null;
      })
      .filter(Boolean);

    res.json({ favorites: items });
  } catch (error) {
    console.error('Get my favorites error:', error);
    res.status(500).json({ error: '获取收藏失败' });
  }
});

app.get('/api/admin/review-queue', requireAdmin, async (req, res) => {
  try {
    const type = normalizeModerationTargetType(req.query.type);
    const status = parseContentStatus(req.query.status) || 'pending';

    if (!type) {
      res.status(400).json({ error: 'type 必须为 wiki 或 posts' });
      return;
    }

    if (type === 'wiki') {
      const items = await prisma.wikiPage.findMany({
        where: { status },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      });
      res.json({ type, status, items: items.map(toWikiResponse) });
      return;
    }

    const items = await prisma.post.findMany({
      where: { status },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    res.json({ type: 'posts', status, items: items.map(toPostResponse) });
  } catch (error) {
    console.error('Fetch review queue error:', error);
    res.status(500).json({ error: '获取审核队列失败' });
  }
});

app.post('/api/admin/review/:type/:id/approve', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetType = normalizeModerationTargetType(req.params.type);
    const targetId = req.params.id;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    if (!targetType) {
      res.status(400).json({ error: '无效审核类型' });
      return;
    }

    const reviewedAt = new Date();

    if (targetType === 'wiki') {
      const page = await prisma.wikiPage.update({
        where: { slug: targetId },
        data: {
          status: 'published',
          reviewNote: note || null,
          reviewedBy: req.authUser!.uid,
          reviewedAt,
        },
      });

      await prisma.moderationLog.create({
        data: {
          targetType: 'wiki',
          targetId,
          action: 'approve',
          operatorUid: req.authUser!.uid,
          note: note || null,
        },
      });

      if (page.lastEditorUid && page.lastEditorUid !== req.authUser!.uid) {
        await createNotification(page.lastEditorUid, 'review_result', {
          approved: true,
          targetType: 'wiki',
          targetId,
          title: page.title,
          note: note || null,
        });
      }

      res.json({ item: toWikiResponse(page) });
      return;
    }

    const post = await prisma.post.update({
      where: { id: targetId },
      data: {
        status: 'published',
        reviewNote: note || null,
        reviewedBy: req.authUser!.uid,
        reviewedAt,
      },
    });

    await prisma.moderationLog.create({
      data: {
        targetType: 'post',
        targetId,
        action: 'approve',
        operatorUid: req.authUser!.uid,
        note: note || null,
      },
    });

    if (post.authorUid && post.authorUid !== req.authUser!.uid) {
      await createNotification(post.authorUid, 'review_result', {
        approved: true,
        targetType: 'post',
        targetId,
        title: post.title,
        note: note || null,
      });
    }

    res.json({ item: toPostResponse(post) });
  } catch (error) {
    console.error('Approve review item error:', error);
    res.status(500).json({ error: '审核通过失败' });
  }
});

app.post('/api/admin/review/:type/:id/reject', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetType = normalizeModerationTargetType(req.params.type);
    const targetId = req.params.id;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    if (!targetType) {
      res.status(400).json({ error: '无效审核类型' });
      return;
    }

    const reviewedAt = new Date();
    const rejectNote = note || '内容未通过审核';

    if (targetType === 'wiki') {
      const page = await prisma.wikiPage.update({
        where: { slug: targetId },
        data: {
          status: 'rejected',
          reviewNote: rejectNote,
          reviewedBy: req.authUser!.uid,
          reviewedAt,
        },
      });

      await prisma.moderationLog.create({
        data: {
          targetType: 'wiki',
          targetId,
          action: 'reject',
          operatorUid: req.authUser!.uid,
          note: rejectNote,
        },
      });

      if (page.lastEditorUid && page.lastEditorUid !== req.authUser!.uid) {
        await createNotification(page.lastEditorUid, 'review_result', {
          approved: false,
          targetType: 'wiki',
          targetId,
          title: page.title,
          note: rejectNote,
        });
      }

      res.json({ item: toWikiResponse(page) });
      return;
    }

    const post = await prisma.post.update({
      where: { id: targetId },
      data: {
        status: 'rejected',
        reviewNote: rejectNote,
        reviewedBy: req.authUser!.uid,
        reviewedAt,
      },
    });

    await prisma.moderationLog.create({
      data: {
        targetType: 'post',
        targetId,
        action: 'reject',
        operatorUid: req.authUser!.uid,
        note: rejectNote,
      },
    });

    if (post.authorUid && post.authorUid !== req.authUser!.uid) {
      await createNotification(post.authorUid, 'review_result', {
        approved: false,
        targetType: 'post',
        targetId,
        title: post.title,
        note: rejectNote,
      });
    }

    res.json({ item: toPostResponse(post) });
  } catch (error) {
    console.error('Reject review item error:', error);
    res.status(500).json({ error: '驳回失败' });
  }
});

app.patch('/api/posts/:id', requireAdmin, async (req, res) => {
  try {
    const { commentsCount, likesCount, status } = req.body as {
      commentsCount?: number;
      likesCount?: number;
      status?: ContentStatus;
    };

    const parsedStatus = parseContentStatus(status);

    const post = await prisma.post.update({
      where: { id: req.params.id },
      data: {
        commentsCount: typeof commentsCount === 'number' ? commentsCount : undefined,
        likesCount: typeof likesCount === 'number' ? likesCount : undefined,
        status: parsedStatus || undefined,
      },
    });

    res.json({ post: toPostResponse(post) });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: '更新帖子失败' });
  }
});

app.delete('/api/posts/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.post.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: '删除帖子失败' });
  }
});

app.get('/api/galleries', async (_req, res) => {
  try {
    const galleries = await prisma.gallery.findMany({
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ galleries: galleries.map(toGalleryResponse) });
  } catch (error) {
    console.error('Fetch galleries error:', error);
    res.status(500).json({ error: '获取图集失败' });
  }
});

app.get('/api/galleries/:id', async (req, res) => {
  try {
    const gallery = await prisma.gallery.findUnique({
      where: { id: req.params.id },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!gallery) {
      res.status(404).json({ error: '图集不存在' });
      return;
    }

    res.json({ gallery: toGalleryResponse(gallery) });
  } catch (error) {
    console.error('Fetch gallery detail error:', error);
    res.status(500).json({ error: '获取图集详情失败' });
  }
});

app.post('/api/uploads', requireAuth, requireActiveUser, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: '请选择文件' });
      return;
    }

    res.status(201).json({
      file: {
        url: `/uploads/${file.filename}`,
        name: file.originalname,
      },
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ error: '上传文件失败' });
  }
});

app.post('/api/galleries/upload', requireAuth, requireActiveUser, upload.array('images', 50), async (req: AuthenticatedRequest, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const title = typeof req.body.title === 'string' ? req.body.title : '';
    const description = typeof req.body.description === 'string' ? req.body.description : '';
    const tagsRaw = typeof req.body.tags === 'string' ? req.body.tags : '';
    const tags = tagsRaw
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (!files || files.length === 0) {
      res.status(400).json({ error: '请上传至少一张图片' });
      return;
    }

    const finalTitle = title || '默认图集';

    const gallery = await prisma.gallery.create({
      data: {
        title: finalTitle,
        description: description || `${finalTitle} 图集`,
        authorUid: req.authUser!.uid,
        authorName: req.authUser!.displayName,
        tags,
        images: {
          create: files.map((file, index) => ({
            url: `/uploads/${file.filename}`,
            name: file.originalname,
            sortOrder: index,
          })),
        },
      },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    res.status(201).json({ gallery: toGalleryResponse(gallery) });
  } catch (error) {
    console.error('Upload gallery error:', error);
    res.status(500).json({ error: '上传图集失败' });
  }
});

app.post('/api/galleries', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, description, tags, images } = req.body as {
      title?: string;
      description?: string;
      tags?: string[];
      images?: { url: string; name: string }[];
    };

    if (!images || !Array.isArray(images) || images.length === 0) {
      res.status(400).json({ error: '图集至少需要一张图片' });
      return;
    }

    const gallery = await prisma.gallery.create({
      data: {
        title: title || '默认图集',
        description: description || '无描述',
        authorUid: req.authUser!.uid,
        authorName: req.authUser!.displayName,
        tags: Array.isArray(tags) ? tags : [],
        images: {
          create: images.map((image, index) => ({
            url: image.url,
            name: image.name || `image-${index + 1}`,
            sortOrder: index,
          })),
        },
      },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    res.status(201).json({ gallery: toGalleryResponse(gallery) });
  } catch (error) {
    console.error('Create gallery error:', error);
    res.status(500).json({ error: '创建图集失败' });
  }
});

app.delete('/api/galleries/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.gallery.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete gallery error:', error);
    res.status(500).json({ error: '删除图集失败' });
  }
});

app.get('/api/music', async (req: AuthenticatedRequest, res) => {
  try {
    const songs = await prisma.musicTrack.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const favoritedMusicSet = new Set<string>();
    if (req.authUser && songs.length) {
      const favorites = await prisma.favorite.findMany({
        where: {
          userUid: req.authUser.uid,
          targetType: 'music',
          targetId: { in: songs.map((song) => song.docId) },
        },
        select: { targetId: true },
      });
      favorites.forEach((item) => favoritedMusicSet.add(item.targetId));
    }

    res.json({
      songs: songs.map((song) => ({
        ...song,
        favoritedByMe: favoritedMusicSet.has(song.docId),
        createdAt: song.createdAt.toISOString(),
        updatedAt: song.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Fetch music error:', error);
    res.status(500).json({ error: '获取音乐失败' });
  }
});

app.post('/api/music', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id, title, artist, album, cover, audioUrl, lyric } = req.body as {
      id?: string;
      title?: string;
      artist?: string;
      album?: string;
      cover?: string;
      audioUrl?: string;
      lyric?: string;
    };

    if (!id || !title || !artist || !album || !cover || !audioUrl) {
      res.status(400).json({ error: '缺少歌曲信息' });
      return;
    }

    const existing = await prisma.musicTrack.findUnique({
      where: { id },
    });

    if (existing) {
      res.status(409).json({ error: '该歌曲已存在' });
      return;
    }

    const song = await prisma.musicTrack.create({
      data: {
        id,
        title,
        artist,
        album,
        cover,
        audioUrl,
        lyric: lyric || null,
        addedBy: req.authUser!.uid,
      },
    });

    res.status(201).json({
      song: {
        ...song,
        createdAt: song.createdAt.toISOString(),
        updatedAt: song.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Add music error:', error);
    res.status(500).json({ error: '添加歌曲失败' });
  }
});

app.post('/api/music/from-netease', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.body as { id?: string | number };
    if (!id) {
      res.status(400).json({ error: '歌曲 ID 不能为空' });
      return;
    }

    const songId = String(id);
    const existing = await prisma.musicTrack.findUnique({
      where: { id: songId },
    });

    if (existing) {
      res.status(409).json({ error: '该歌曲已存在' });
      return;
    }

    const url = `https://music.163.com/song?id=${songId}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const $ = cheerio.load(response.data);
    const metadata: {
      title?: string;
      cover?: string;
      artist?: string;
      album?: string;
      lyric?: string;
    } = {};

    $('meta').each((_, el) => {
      const property = $(el).attr('property');
      const content = $(el).attr('content');
      if (!content) return;
      if (property === 'og:title') metadata.title = content;
      if (property === 'og:image') metadata.cover = content;
      if (property === 'og:music:artist') metadata.artist = content;
      if (property === 'og:music:album') metadata.album = content;
    });

    try {
      const lrcResponse = await axios.get(`https://music.163.com/api/song/media?id=${songId}`);
      if (lrcResponse.data?.lyric) {
        metadata.lyric = lrcResponse.data.lyric;
      }
    } catch (error) {
      console.error('Fetch lyric failed:', error);
    }

    if (!metadata.title || !metadata.artist || !metadata.album || !metadata.cover) {
      res.status(500).json({ error: '获取歌曲元数据失败' });
      return;
    }

    const song = await prisma.musicTrack.create({
      data: {
        id: songId,
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        cover: metadata.cover,
        audioUrl: `https://music.163.com/song/media/outer/url?id=${songId}.mp3`,
        lyric: metadata.lyric || null,
        addedBy: req.authUser!.uid,
      },
    });

    res.status(201).json({
      song: {
        ...song,
        createdAt: song.createdAt.toISOString(),
        updatedAt: song.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Add song from netease failed:', error);
    res.status(500).json({ error: '添加歌曲失败' });
  }
});

app.delete('/api/music/:docId', requireAdmin, async (req, res) => {
  try {
    await prisma.musicTrack.delete({
      where: { docId: req.params.docId },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete music error:', error);
    res.status(500).json({ error: '删除歌曲失败' });
  }
});

app.get('/api/image-maps', async (req, res) => {
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

app.get('/api/image-maps/:id', async (req, res) => {
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

app.post('/api/image-maps', requireAuth, requireActiveUser, async (req, res) => {
  try {
    const { id, md5, localUrl, weiboUrl, smmsUrl, superbedUrl } = req.body as {
      id?: string;
      md5?: string;
      localUrl?: string;
      weiboUrl?: string;
      smmsUrl?: string;
      superbedUrl?: string;
    };

    if (!id || !md5 || !localUrl) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    const item = await prisma.imageMap.upsert({
      where: { id },
      update: {
        md5,
        localUrl,
        weiboUrl: weiboUrl || null,
        smmsUrl: smmsUrl || null,
        superbedUrl: superbedUrl || null,
      },
      create: {
        id,
        md5,
        localUrl,
        weiboUrl: weiboUrl || null,
        smmsUrl: smmsUrl || null,
        superbedUrl: superbedUrl || null,
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

app.get('/api/music/song/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await prisma.musicTrack.findUnique({
      where: { id },
    });

    if (existing) {
      res.json({
        ...existing,
        docId: existing.docId,
      });
      return;
    }

    const url = `https://music.163.com/song?id=${id}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const $ = cheerio.load(response.data);
    const metadata: {
      id: string;
      audioUrl: string;
      title?: string;
      cover?: string;
      artist?: string;
      album?: string;
      lyric?: string;
    } = {
      id,
      audioUrl: `https://music.163.com/song/media/outer/url?id=${id}.mp3`,
    };

    $('meta').each((_, el) => {
      const property = $(el).attr('property');
      const content = $(el).attr('content');
      if (!content) return;

      if (property === 'og:title') metadata.title = content;
      if (property === 'og:image') metadata.cover = content;
      if (property === 'og:music:artist') metadata.artist = content;
      if (property === 'og:music:album') metadata.album = content;
    });

    try {
      const lrcResponse = await axios.get(`https://music.163.com/api/song/media?id=${id}`);
      if (lrcResponse.data?.lyric) {
        metadata.lyric = lrcResponse.data.lyric;
      }
    } catch (error) {
      console.error('Error fetching lyrics:', error);
    }

    res.json(metadata);
  } catch (error) {
    console.error('Error fetching song metadata:', error);
    res.status(500).json({ error: 'Failed to fetch song metadata' });
  }
});

app.get('/api/search', async (req: AuthenticatedRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const type = typeof req.query.type === 'string' ? req.query.type : 'all';
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const startDate = typeof req.query.startDate === 'string' ? parseDate(req.query.startDate) : null;
    const endDate = typeof req.query.endDate === 'string' ? parseDate(req.query.endDate) : null;

    const wantsWiki = type === 'all' || type === 'wiki';
    const wantsPosts = type === 'all' || type === 'posts';
    const wantsGalleries = type === 'all' || type === 'galleries';

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

    const [wiki, posts, galleries] = await Promise.all([wikiPromise, postsPromise, galleriesPromise]);

    res.json({
      wiki: wiki.map(toWikiResponse),
      posts: posts.map(toPostResponse),
      galleries: galleries.map(toGalleryResponse),
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

app.get('/api/search/hot-keywords', async (_req, res) => {
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

app.get('/api/search/suggest', async (req: AuthenticatedRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q || q.length < 2) {
      res.json({ suggestions: [] });
      return;
    }

    const normalized = normalizeKeyword(q);

    const [keywordMatches, wikiMatches, postMatches] = await Promise.all([
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
    ]);

    const suggestions: Array<{ type: 'keyword' | 'wiki' | 'post'; text: string; subtext?: string; id?: string }> = [];

    keywordMatches.forEach((k) => {
      suggestions.push({ type: 'keyword', text: k.keyword, subtext: `${k.count} 次搜索` });
    });

    wikiMatches.forEach((w) => {
      suggestions.push({ type: 'wiki', text: w.title, subtext: w.category, id: w.slug });
    });

    postMatches.forEach((p) => {
      suggestions.push({ type: 'post', text: p.title, subtext: p.section, id: p.id });
    });

    res.json({ suggestions });
  } catch (error) {
    console.error('Search suggest error:', error);
    res.status(500).json({ error: '搜索建议失败' });
  }
});

app.get('/api/admin/:tab', requireAdmin, async (req, res) => {
  try {
    const tab = req.params.tab;

    if (tab === 'wiki') {
      const data = await prisma.wikiPage.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });
      res.json({ data: data.map(toWikiResponse) });
      return;
    }

    if (tab === 'posts') {
      const data = await prisma.post.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });
      res.json({ data: data.map(toPostResponse) });
      return;
    }

    if (tab === 'galleries') {
      const data = await prisma.gallery.findMany({
        include: {
          images: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });
      res.json({ data: data.map(toGalleryResponse) });
      return;
    }

    if (tab === 'users') {
      const data = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      select: {
        uid: true,
        email: true,
        displayName: true,
        photoURL: true,
        role: true,
        status: true,
        banReason: true,
        bannedAt: true,
        level: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });
      res.json({ data: data.map(toUserResponse) });
      return;
    }

    if (tab === 'sections') {
      const data = await prisma.section.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        take: 100,
      });
      res.json({ data });
      return;
    }

    if (tab === 'announcements') {
      const data = await prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      res.json({ data });
      return;
    }

    if (tab === 'music') {
      const data = await prisma.musicTrack.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      res.json({
        data: data.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
      });
      return;
    }

    res.status(400).json({ error: '未知数据类型' });
  } catch (error) {
    console.error('Fetch admin data error:', error);
    res.status(500).json({ error: '获取管理数据失败' });
  }
});

app.get('/api/admin/:tab/:id', requireAdmin, async (req, res) => {
  try {
    const tab = req.params.tab;
    const id = req.params.id;

    if (tab === 'wiki') {
      const item = await prisma.wikiPage.findUnique({ where: { slug: id } });
      if (!item) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }
      res.json({ item: toWikiResponse(item) });
      return;
    }

    if (tab === 'posts') {
      const item = await prisma.post.findUnique({ where: { id } });
      if (!item) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }
      res.json({ item: toPostResponse(item) });
      return;
    }

    if (tab === 'galleries') {
      const item = await prisma.gallery.findUnique({
        where: { id },
        include: {
          images: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
      if (!item) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }
      res.json({ item: toGalleryResponse(item) });
      return;
    }

    if (tab === 'users') {
      const item = await prisma.user.findUnique({
        where: { uid: id },
        select: {
          uid: true,
          email: true,
          displayName: true,
          photoURL: true,
          role: true,
          status: true,
          banReason: true,
          bannedAt: true,
          level: true,
          bio: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!item) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }
      res.json({ item: toUserResponse(item) });
      return;
    }

    if (tab === 'sections') {
      const item = await prisma.section.findUnique({ where: { id } });
      if (!item) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }
      res.json({ item });
      return;
    }

    if (tab === 'announcements') {
      const item = await prisma.announcement.findUnique({ where: { id } });
      if (!item) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }
      res.json({ item });
      return;
    }

    if (tab === 'music') {
      const item = await prisma.musicTrack.findUnique({ where: { docId: id } });
      if (!item) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }
      res.json({
        item: {
          ...item,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        },
      });
      return;
    }

    res.status(400).json({ error: '未知数据类型' });
  } catch (error) {
    console.error('Fetch admin item error:', error);
    res.status(500).json({ error: '获取详情失败' });
  }
});

app.delete('/api/admin/:tab/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tab = req.params.tab;
    const id = req.params.id;

    if (tab === 'wiki') {
      await prisma.wikiPage.delete({ where: { slug: id } });
      res.json({ success: true });
      return;
    }
    if (tab === 'posts') {
      await prisma.post.delete({ where: { id } });
      res.json({ success: true });
      return;
    }
    if (tab === 'galleries') {
      await prisma.gallery.delete({ where: { id } });
      res.json({ success: true });
      return;
    }
    if (tab === 'users') {
      const currentUser = req.authUser;
      if (currentUser?.uid === id) {
        res.status(400).json({ error: '不能删除自己' });
        return;
      }
      await prisma.user.delete({ where: { uid: id } });
      res.json({ success: true });
      return;
    }
    if (tab === 'sections') {
      await prisma.section.delete({ where: { id } });
      res.json({ success: true });
      return;
    }
    if (tab === 'announcements') {
      await prisma.announcement.delete({ where: { id } });
      res.json({ success: true });
      return;
    }
    if (tab === 'music') {
      await prisma.musicTrack.delete({ where: { docId: id } });
      res.json({ success: true });
      return;
    }

    res.status(400).json({ error: '未知删除类型' });
  } catch (error) {
    console.error('Delete admin data error:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
