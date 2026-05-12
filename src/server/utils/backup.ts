// 备份加密/解密/清理/文件安全工具

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { backupsDir, BACKUP_PASSWORD, BACKUP_RETAIN_COUNT } from './config';

// ─── 解析与验证 ─────────────────────────────────────────────────────

export function parseDatabaseUrl(url: string): { host: string; port: string; user: string; password: string; database: string } | null {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || '5432',
      user: parsed.username,
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.slice(1),
    };
  } catch {
    return null;
  }
}

export function verifyBackupPassword(password: string): boolean {
  if (!BACKUP_PASSWORD) return false;
  return password === BACKUP_PASSWORD;
}

export function sanitizeFilename(name: string): boolean {
  return /^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.zip$/.test(name);
}

// ─── 格式化 ─────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ─── 备份清理 ───────────────────────────────────────────────────────

export async function cleanupOldBackups(): Promise<void> {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter((f) => f.startsWith('backup_') && f.endsWith('.zip'))
      .map((f) => {
        const filePath = path.join(backupsDir, f);
        const stat = fs.statSync(filePath);
        return { name: f, mtime: stat.mtime.getTime() };
      })
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > BACKUP_RETAIN_COUNT) {
      const toDelete = files.slice(BACKUP_RETAIN_COUNT);
      for (const file of toDelete) {
        fs.unlinkSync(path.join(backupsDir, file.name));
        console.log(`Cleaned up old backup: ${file.name}`);
      }
    }
  } catch (error) {
    console.error('Cleanup old backups error:', error);
  }
}

// ─── 加密 / 解密 ────────────────────────────────────────────────────

export function encryptBuffer(buffer: Buffer, password: string): Buffer {
  const key = crypto.scryptSync(password, 'huangshifu-backup-salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([iv, cipher.update(buffer), cipher.final()]);
  return encrypted;
}

export function decryptBuffer(buffer: Buffer, password: string): Buffer {
  const key = crypto.scryptSync(password, 'huangshifu-backup-salt', 32);
  const iv = buffer.subarray(0, 16);
  const encrypted = buffer.subarray(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// ─── Embedding Payload（原始位置靠近 embedding 区域）─────────────────

export function toEmbeddingPayload(payload: unknown): {
  galleryId: string;
  galleryImageId: string;
  imageUrl: string;
  imageName: string;
} | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const galleryId = typeof record.galleryId === 'string' ? record.galleryId : '';
  const galleryImageId = typeof record.galleryImageId === 'string' ? record.galleryImageId : '';
  if (!galleryId || !galleryImageId) {
    return null;
  }

  return {
    galleryId,
    galleryImageId,
    imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : '',
    imageName: typeof record.imageName === 'string' ? record.imageName : '',
  };
}
