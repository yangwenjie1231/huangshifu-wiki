import { Router } from 'express';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { requireAuth, requireActiveUser, requireAdmin, requireSuperAdmin, userToApiUser } from '../middleware/auth';
import { prisma, toUserResponse, buildPostVisibilityWhere, toPostResponse, toCommentResponse } from '../utils';
import type { AuthenticatedRequest, UserStatus } from '../types';

const router = Router();

// User self-management routes
router.get('/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: req.authUser!.uid },
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
        preferences: true,
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
    console.error('Fetch current user status error:', error);
    res.status(500).json({ error: '获取用户状态失败' });
  }
});

router.put('/status', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, banReason } = req.body as {
      status?: UserStatus;
      banReason?: string;
    };

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (typeof banReason === 'string') updateData.banReason = banReason;

    const user = await prisma.user.update({
      where: { uid: req.authUser!.uid },
      data: updateData,
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
    console.error('Update user status error:', error);
    res.status(500).json({ error: '更新用户状态失败' });
  }
});

router.put('/name', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { displayName } = req.body as { displayName?: string };

    if (!displayName || !displayName.trim()) {
      res.status(400).json({ error: '昵称不能为空' });
      return;
    }

    const user = await prisma.user.update({
      where: { uid: req.authUser!.uid },
      data: { displayName: displayName.trim() },
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
    console.error('Update user name error:', error);
    res.status(500).json({ error: '更新昵称失败' });
  }
});

router.put('/phone', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { phone } = req.body as { phone?: string };

    if (!phone || !phone.trim()) {
      res.status(400).json({ error: '手机号不能为空' });
      return;
    }

    // Note: phone field is not in the User schema, this is a placeholder
    res.status(501).json({ error: '手机号功能暂未启用' });
  } catch (error) {
    console.error('Update user phone error:', error);
    res.status(500).json({ error: '更新手机号失败' });
  }
});

router.put('/password', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const bcrypt = await import('bcryptjs');
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: '密码不能为空' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { uid: req.authUser!.uid },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      res.status(400).json({ error: '当前密码不正确' });
      return;
    }

    const validPassword = await bcrypt.default.compare(currentPassword, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: '当前密码不正确' });
      return;
    }

    const passwordHash = await bcrypt.default.hash(newPassword, 12);
    await prisma.user.update({
      where: { uid: req.authUser!.uid },
      data: { passwordHash },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Update user password error:', error);
    res.status(500).json({ error: '更新密码失败' });
  }
});

router.post('/avatar', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    // This route requires file upload middleware
    // The actual implementation would be in server.ts with multer
    res.status(501).json({ error: '头像上传请使用完整接口' });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: '上传头像失败' });
  }
});

router.delete('/account', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    // Soft delete or account deletion logic
    await prisma.user.update({
      where: { uid: req.authUser!.uid },
      data: {
        displayName: '已注销用户',
        photoURL: null,
        bio: '',
        status: 'banned',
        banReason: '用户主动注销',
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: '注销账户失败' });
  }
});

// Admin user management routes
router.get('/', requireAdmin, async (_req, res) => {
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
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

router.put('/:userId/role', requireSuperAdmin, async (req, res) => {
  try {
    const { role } = req.body as { role?: PrismaUserRole };
    if (!role || !['user', 'admin', 'super_admin'].includes(role)) {
      res.status(400).json({ error: '无效角色' });
      return;
    }

    const user = await prisma.user.update({
      where: { uid: req.params.userId },
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

router.put('/:userId/ban', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUid = req.params.userId;
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

router.put('/:userId/unban', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUid = req.params.userId;
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

// User detail routes
router.get('/:userId/posts', async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.params.userId;
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
    const dislikedPostSet = new Set<string>();
    if (req.authUser && posts.length) {
      const [likedPosts, favoritedPosts, dislikedPosts] = await Promise.all([
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
        prisma.postDislike.findMany({
          where: {
            userUid: req.authUser.uid,
            postId: { in: posts.map((item) => item.id) },
          },
          select: { postId: true },
        }),
      ]);
      likedPosts.forEach((item) => likedPostSet.add(item.postId));
      favoritedPosts.forEach((item) => favoritedPostSet.add(item.targetId));
      dislikedPosts.forEach((item) => dislikedPostSet.add(item.postId));
    }

    res.json({
      posts: posts.map((post) => ({
        ...toPostResponse(post),
        likedByMe: likedPostSet.has(post.id),
        favoritedByMe: favoritedPostSet.has(post.id),
        dislikedByMe: dislikedPostSet.has(post.id),
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

router.get('/:userId/comments', async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.params.userId;
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

router.get('/:userId/likes', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.params.userId;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    // Users can only see their own likes unless they're admin
    if (req.authUser?.uid !== uid && req.authUser?.role === 'user') {
      res.status(403).json({ error: '无权查看该用户的点赞记录' });
      return;
    }

    const likedPosts = await prisma.postLike.findMany({
      where: {
        userUid: uid,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
      include: {
        post: {
          select: {
            id: true,
            title: true,
            section: true,
            status: true,
            authorUid: true,
            likesCount: true,
            commentsCount: true,
            viewCount: true,
            createdAt: true,
            updatedAt: true,
            content: true,
            tags: true,
            reviewNote: true,
            reviewedBy: true,
            reviewedAt: true,
            hotScore: true,
            isPinned: true,
            dislikesCount: true,
            musicDocId: true,
            albumDocId: true,
            locationCode: true,
          },
        },
      },
    });

    const total = await prisma.postLike.count({ where: { userUid: uid } });

    const visibilityWhere = buildPostVisibilityWhere(req.authUser);
    const visiblePosts = likedPosts.filter((item) => {
      if (!item.post) return false;
      if (item.post.status === 'published') return true;
      if (req.authUser && (item.post.authorUid === req.authUser.uid || req.authUser.role === 'admin' || req.authUser.role === 'super_admin')) {
        return true;
      }
      return false;
    });

    res.json({
      likes: visiblePosts.map((item) => ({
        id: item.id,
        createdAt: item.createdAt.toISOString(),
        post: item.post ? toPostResponse(item.post) : null,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Fetch user likes error:', error);
    res.status(500).json({ error: '获取用户点赞失败' });
  }
});

// User browsing history route
router.get('/me/history', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { type, limit = '20', offset = '0' } = req.query;
    const userId = req.authUser!.uid;

    const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const offsetNum = Math.max(Number(offset) || 0, 0);

    const where: Record<string, unknown> = {
      userUid: userId,
    };

    // Filter by type if provided
    if (type && ['wiki', 'post', 'music'].includes(type as string)) {
      where.targetType = type as string;
    }

    const [histories, total] = await Promise.all([
      prisma.browsingHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip: offsetNum,
      }),
      prisma.browsingHistory.count({ where }),
    ]);

    res.json({
      history: histories.map((item) => ({
        id: item.id,
        targetType: item.targetType,
        targetId: item.targetId,
        createdAt: item.createdAt.toISOString(),
      })),
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
    });
  } catch (error) {
    console.error('Get user history error:', error);
    res.status(500).json({ error: '获取历史记录失败' });
  }
});

export function registerUsersRoutes(app: Router) {
  app.use('/api/users', router);
}
