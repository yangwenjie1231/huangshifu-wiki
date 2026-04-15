import { Router } from 'express';
import { requireAuth, requireAdmin, requireActiveUser } from '../middleware/auth';
import { prisma } from '../utils';
import {
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  getPresignedDeleteUrl,
  getPublicConfig,
  validateS3Config,
} from '../s3/s3Service';

const router = Router();

// GET /api/config/image-preference - Get image preference
router.get('/image-preference', async (_req, res) => {
  try {
    const config = await prisma.siteConfig.findUnique({
      where: { key: 'image_preference' },
    });

    const preference = config?.value as {
      strategy?: 'local' | 's3' | 'external';
      fallback?: boolean;
    } || { strategy: 'local', fallback: true };

    res.json(preference);
  } catch (error) {
    console.error('Get image preference error:', error);
    res.status(500).json({ error: '获取图片偏好设置失败' });
  }
});

// PATCH /api/config/image-preference - Update image preference
router.patch('/image-preference', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { strategy, fallback } = req.body as {
      strategy?: 'local' | 's3' | 'external';
      fallback?: boolean;
    };

    const value = {
      ...(strategy && { strategy }),
      ...(fallback !== undefined && { fallback }),
    };

    await prisma.siteConfig.upsert({
      where: { key: 'image_preference' },
      update: { value },
      create: { key: 'image_preference', value },
    });

    res.json({ success: true, preference: value });
  } catch (error) {
    console.error('Update image preference error:', error);
    res.status(500).json({ error: '更新图片偏好设置失败' });
  }
});

// GET /api/s3/config - Get S3 public config
router.get('/s3/config', async (_req, res) => {
  try {
    const config = getPublicConfig();
    res.json(config);
  } catch (error) {
    console.error('[S3] 获取配置失败:', error);
    res.status(500).json({ error: '获取 S3 配置失败' });
  }
});

// GET /api/s3/presign-upload - Get S3 presigned upload URL
router.get('/s3/presign-upload', requireAuth, requireActiveUser, async (req, res) => {
  try {
    const { filename, contentType, key, contentMd5, fileSize } = req.query as {
      filename?: string;
      contentType?: string;
      key?: string;
      contentMd5?: string;
      fileSize?: string;
    };

    if (!filename) {
      res.status(400).json({ error: '缺少 filename 参数' });
      return;
    }

    const objectKey = key || filename;

    const result = await getPresignedUploadUrl(objectKey, undefined, {
      contentType: contentType || 'application/octet-stream',
      contentMd5,
      fileSize: fileSize ? parseInt(fileSize) : undefined,
    });

    res.json(result);
  } catch (error) {
    console.error('[S3] 生成上传签名失败:', error);
    const message = error instanceof Error ? error.message : '生成上传签名失败';
    res.status(500).json({ error: message });
  }
});

// GET /api/s3/presign-download/:key(*) - Get S3 presigned download URL
router.get('/s3/presign-download/:key(*)', requireAuth, async (req, res) => {
  try {
    const { key } = req.params;

    if (!key) {
      res.status(400).json({ error: '缺少 key 参数' });
      return;
    }

    const url = await getPresignedDownloadUrl(key);
    res.json({ downloadUrl: url });
  } catch (error) {
    console.error('[S3] 生成下载签名失败:', error);
    const message = error instanceof Error ? error.message : '生成下载签名失败';
    res.status(500).json({ error: message });
  }
});

// GET /api/s3/presign-delete/:key(*) - Get S3 presigned delete URL
router.get('/s3/presign-delete/:key(*)', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;

    if (!key) {
      res.status(400).json({ error: '缺少 key 参数' });
      return;
    }

    const url = await getPresignedDeleteUrl(key);
    res.json({ deleteUrl: url });
  } catch (error) {
    console.error('[S3] 生成删除签名失败:', error);
    const message = error instanceof Error ? error.message : '生成删除签名失败';
    res.status(500).json({ error: message });
  }
});

export function registerConfigRoutes(app: Router) {
  app.use(router);
}
