import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../prisma';
import { requireAuth, requireActiveUser, AuthenticatedRequest } from '../middleware/auth';
import {
  createUploadSessionExpiresAt,
  isUploadSessionExpired,
  getUploadFileStorageKey,
  buildUploadPublicUrl,
  validateUploadedImage,
  uploadFileToS3,
  uploadFileToExternal,
  safeDeleteUploadFileByStorageKey,
} from '../utils';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = process.env.UPLOADS_PATH || path.join(__dirname, '..', '..', '..', 'uploads');

const router = Router();

// 配置 multer 用于处理文件上传
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
  }),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('仅支持图片文件'));
    }
  },
});

/**
 * POST /api/uploads/sessions - 创建上传会话
 */
router.post('/sessions', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const session = await prisma.uploadSession.create({
      data: {
        ownerUid: req.authUser!.uid,
        status: 'open',
        expiresAt: createUploadSessionExpiresAt(),
      },
    });

    res.status(201).json({
      session: {
        id: session.id,
        ownerUid: session.ownerUid,
        status: session.status,
        expiresAt: session.expiresAt.toISOString(),
        uploadedFiles: session.uploadedFiles,
      },
    });
  } catch (error) {
    console.error('Create upload session error:', error);
    res.status(500).json({ error: '创建上传会话失败' });
  }
});

/**
 * GET /api/uploads/sessions/:sessionId - 获取会话状态
 */
router.get('/sessions/:sessionId', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.uploadSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      res.status(404).json({ error: '上传会话不存在' });
      return;
    }

    if (session.ownerUid !== req.authUser!.uid) {
      res.status(403).json({ error: '无权访问该会话' });
      return;
    }

    // 检查会话是否过期
    let status = session.status;
    if (status !== 'finalized' && isUploadSessionExpired(session.expiresAt)) {
      status = 'expired';
      await prisma.uploadSession.update({
        where: { id: session.id },
        data: { status: 'expired' },
      });
    }

    res.json({
      session: {
        id: session.id,
        ownerUid: session.ownerUid,
        status,
        expiresAt: session.expiresAt.toISOString(),
        uploadedFiles: session.uploadedFiles,
      },
    });
  } catch (error) {
    console.error('Get upload session error:', error);
    res.status(500).json({ error: '获取上传会话失败' });
  }
});

/**
 * POST /api/uploads/sessions/:sessionId/files - 上传文件到会话
 */
router.post(
  '/sessions/:sessionId/files',
  requireAuth,
  requireActiveUser,
  upload.single('file'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId } = req.params;
      const { tripleStorage } = req.query as { tripleStorage?: string };
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: '请上传文件' });
        return;
      }

      // 验证会话
      const session = await prisma.uploadSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          ownerUid: true,
          status: true,
          expiresAt: true,
        },
      });

      if (!session) {
        res.status(404).json({ error: '上传会话不存在' });
        return;
      }

      if (session.ownerUid !== req.authUser!.uid) {
        res.status(403).json({ error: '无权访问该会话' });
        return;
      }

      if (session.status === 'expired' || isUploadSessionExpired(session.expiresAt)) {
        if (session.status !== 'expired') {
          await prisma.uploadSession.update({
            where: { id: session.id },
            data: { status: 'expired' },
          });
        }
        res.status(410).json({ error: '上传会话已过期，请重新创建会话' });
        return;
      }

      if (session.status !== 'open') {
        res.status(400).json({ error: '会话状态不正确' });
        return;
      }

      // 验证图片
      const { mimeType } = await validateUploadedImage(file);

      // 获取存储策略
      const useTripleStorage = tripleStorage === 'true';
      const preferenceConfig = await prisma.siteConfig.findUnique({
        where: { key: 'image_preference' },
      });
      const preference = preferenceConfig?.value as { strategy?: 'local' | 's3' | 'external' } || {
        strategy: 'local',
      };

      // 创建媒体资源记录
      const storageKey = getUploadFileStorageKey(file);
      const publicUrl = buildUploadPublicUrl(storageKey);

      const asset = await prisma.mediaAsset.create({
        data: {
          ownerUid: req.authUser!.uid,
          storageKey,
          publicUrl,
          fileName: file.originalname,
          mimeType,
          sizeBytes: file.size,
          status: 'ready',
        },
      });

      // 更新会话的上传文件计数
      await prisma.uploadSession.update({
        where: { id: session.id },
        data: {
          uploadedFiles: {
            increment: 1,
          },
        },
      });

      // 构建响应
      const response: {
        asset: {
          id: string;
          fileName: string;
          mimeType: string;
          sizeBytes: number;
          publicUrl: string;
          storageKey: string;
        };
        tripleStorage?: {
          localUrl: string;
          s3Url?: string;
          externalUrl?: string;
        };
      } = {
        asset: {
          id: asset.id,
          fileName: file.originalname,
          mimeType,
          sizeBytes: file.size,
          publicUrl,
          storageKey,
        },
      };

      // 处理三重存储
      if (useTripleStorage) {
        const localUrl = publicUrl;
        let s3Url: string | undefined;
        let externalUrl: string | undefined;

        // 上传到 S3
        if (preference.strategy === 's3' || preference.strategy === 'external') {
          try {
            const filePath = `uploads/${file.filename}`;
            const s3Result = await uploadFileToS3(filePath, storageKey, mimeType);
            if (s3Result.success && s3Result.url) {
              s3Url = s3Result.url;
            }
          } catch (s3Error) {
            console.error('Upload to S3 failed:', s3Error);
          }
        }

        // 上传到外部图床
        if (preference.strategy === 'external') {
          try {
            const filePath = `uploads/${file.filename}`;
            const externalConfig = {
              apiUrl: 'https://api.imgur.com/3/image', // 示例配置，实际应从环境变量读取
            };
            const externalResult = await uploadFileToExternal(filePath, file.originalname, mimeType, externalConfig);
            if (externalResult.success && externalResult.url) {
              externalUrl = externalResult.url;
            }
          } catch (externalError) {
            console.error('Upload to external failed:', externalError);
          }
        }

        // 创建 ImageMap 记录
        if (s3Url || externalUrl) {
          try {
            await prisma.imageMap.create({
              data: {
                id: asset.id,
                md5: '', // 可以后续计算
                localUrl,
                s3Url: s3Url || null,
                externalUrl: externalUrl || null,
                storageType: preference.strategy,
              },
            });
          } catch (imageMapError) {
            console.error('Create ImageMap failed:', imageMapError);
          }
        }

        response.tripleStorage = {
          localUrl,
          s3Url,
          externalUrl,
        };
      }

      res.status(201).json(response);
    } catch (error) {
      console.error('Upload file to session error:', error);

      // 清理上传的文件
      if (req.file) {
        await safeDeleteUploadFileByStorageKey(req.file.filename).catch(() => {});
      }

      const message = error instanceof Error ? error.message : '上传文件失败';
      if (message.includes('图片') || message.includes('文件') || message.includes('超过')) {
        res.status(400).json({ error: message });
        return;
      }
      res.status(500).json({ error: '上传文件失败' });
    }
  }
);

/**
 * POST /api/uploads/sessions/:sessionId/finalize - 完成上传会话
 */
router.post('/sessions/:sessionId/finalize', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.uploadSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      res.status(404).json({ error: '上传会话不存在' });
      return;
    }

    if (session.ownerUid !== req.authUser!.uid) {
      res.status(403).json({ error: '无权操作该会话' });
      return;
    }

    if (session.status === 'expired' || isUploadSessionExpired(session.expiresAt)) {
      if (session.status !== 'expired') {
        await prisma.uploadSession.update({
          where: { id: session.id },
          data: { status: 'expired' },
        });
      }
      res.status(410).json({ error: '上传会话已过期' });
      return;
    }

    // 更新会话状态为 finalized
    await prisma.uploadSession.update({
      where: { id: session.id },
      data: { status: 'finalized' },
    });

    res.json({
      session: {
        id: session.id,
        status: 'finalized',
        uploadedFiles: session.uploadedFiles,
      },
    });
  } catch (error) {
    console.error('Finalize upload session error:', error);
    res.status(500).json({ error: '完成上传会话失败' });
  }
});

/**
 * DELETE /api/uploads/sessions/:sessionId - 删除/取消上传会话
 */
router.delete('/sessions/:sessionId', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.uploadSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      res.status(404).json({ error: '上传会话不存在' });
      return;
    }

    if (session.ownerUid !== req.authUser!.uid) {
      res.status(403).json({ error: '无权操作该会话' });
      return;
    }

    // 删除会话（级联删除关联的媒体资源）
    await prisma.uploadSession.delete({
      where: { id: session.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete upload session error:', error);
    res.status(500).json({ error: '删除上传会话失败' });
  }
});

export function registerUploadRoutes(app: Router) {
  app.use('/api/uploads', router);
}
