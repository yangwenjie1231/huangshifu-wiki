import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { UserRole as PrismaUserRole } from '@prisma/client';
import type { ApiUser, SessionJwtPayload, UserStatus, AuthenticatedRequest } from '../types';
import { prisma } from '../prisma';

const JWT_SECRET = process.env.JWT_SECRET || '';
const AUTH_COOKIE_NAME = 'hsf_token';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const IS_PROD = process.env.NODE_ENV === 'production';

if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET. Please set it in .env.local');
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

function isAdminRole(role: PrismaUserRole | undefined) {
  return role === 'admin' || role === 'super_admin';
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

export {
  prisma,
  JWT_SECRET,
  AUTH_COOKIE_NAME,
  ONE_DAY_MS,
  IS_PROD,
  bcrypt,
  userToApiUser,
  isAdminRole,
  createToken,
  shouldUseSecureCookie,
  setAuthCookie,
  clearAuthCookie,
  getTokenFromRequest,
  authMiddleware,
  requireAuth,
  requireActiveUser,
  requireAdmin,
  requireSuperAdmin,
};

export type { AuthenticatedRequest };
