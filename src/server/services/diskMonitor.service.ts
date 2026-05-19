/**
 * 磁盘空间监控服务 - v2.1 增强版（支持后台动态配置）
 * 
 * 功能：
 * 1. 定期检查磁盘空间
 * 2. 多级告警阈值（healthy/warning/critical）
 * 3. **后台动态配置** - 阈值可通过 API 实时修改
 * 4. 上传前预检（防止磁盘写满）
 * 5. 目录统计与趋势分析
 */

import { prisma } from '../prisma';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = process.env.UPLOADS_PATH || path.join(__dirname, '..', '..', '..', 'uploads');

export interface DiskMonitorConfig {
  warningThresholdGB: number;    // 警告阈值（GB）
  criticalThresholdGB: number;   // 严重警告阈值（GB）
  checkIntervalMs: number;       // 检查间隔（毫秒）
  uploadsMinFreeMB: number;      // 上传最小空闲空间（MB）
}

export interface DirectoryStats {
  path: string;
  fileCount: number;
  totalSizeMB: number;
  oldestFileDate?: Date;
  newestFileDate?: Date;
}

export interface DiskStatus {
  totalSpaceGB: number;
  freeSpaceGB: number;
  usedSpaceGB: number;
  usagePercent: number;
  status: 'healthy' | 'warning' | 'critical';
  lastChecked: Date;
  uploadsDir?: DirectoryStats;
  originalDir?: DirectoryStats;
  variantsDir?: DirectoryStats;
}

export interface UploadPrecheckResult {
  allowed: boolean;
  reason?: string;
  freeSpaceGB: number;
  config: DiskMonitorConfig;
}

const DEFAULT_CONFIG: DiskMonitorConfig = {
  warningThresholdGB: 50,
  criticalThresholdGB: 20,
  checkIntervalMs: 300000,  // 5 分钟
  uploadsMinFreeMB: 500,
};

const CONFIG_KEY = 'disk_monitor_config';

export class DiskMonitorService {
  private static instance: DiskMonitorService;

  private currentStatus: DiskStatus | null = null;
  private currentConfig: DiskMonitorConfig = { ...DEFAULT_CONFIG };
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private isChecking: boolean = false;

  private constructor() {
    this.loadConfigFromDB().then(() => {
      this.startMonitoring();
    });
  }

  public static getInstance(): DiskMonitorService {
    if (!DiskMonitorService.instance) {
      DiskMonitorService.instance = new DiskMonitorService();
    }
    return DiskMonitorService.instance;
  }

  /**
   * 从数据库加载配置（支持后台动态修改）
   */
  private async loadConfigFromDB(): Promise<void> {
    try {
      const configRecord = await prisma.siteConfig.findUnique({
        where: { key: CONFIG_KEY },
      });

      if (configRecord?.value) {
        const dbConfig = configRecord.value as Partial<DiskMonitorConfig>;
        
        this.currentConfig = {
          ...DEFAULT_CONFIG,
          ...dbConfig,
        };

        console.log('[DiskMonitor] ✅ Configuration loaded from database');
        console.log(`  - Warning threshold: ${this.currentConfig.warningThresholdGB} GB`);
        console.log(`  - Critical threshold: ${this.currentConfig.criticalThresholdGB} GB`);
        console.log(`  - Check interval: ${this.currentConfig.checkIntervalMs / 1000}s`);
        console.log(`  - Min free space for upload: ${this.currentConfig.uploadsMinFreeMB} MB`);
      } else {
        console.log('[DiskMonitor] ℹ️ No database config found, using defaults');
        await this.saveConfigToDB();
      }
    } catch (error) {
      console.error('[DiskMonitor] ❌ Failed to load config from DB, using defaults:', error);
      this.currentConfig = { ...DEFAULT_CONFIG };
    }
  }

  /**
   * 保存配置到数据库
   */
  private async saveConfigToDB(): Promise<void> {
    try {
      await prisma.siteConfig.upsert({
        where: { key: CONFIG_KEY },
        update: {
          value: this.currentConfig as any,
          updatedAt: new Date(),
        },
        create: {
          key: CONFIG_KEY,
          value: this.currentConfig as any,
        },
      });
      
      console.log('[DiskMonitor] 💾 Configuration saved to database');
    } catch (error) {
      console.error('[DiskMonitor] ❌ Failed to save config to DB:', error);
    }
  }

  /**
   * 更新配置（供管理 API 调用）
   */
  async updateConfig(newConfig: Partial<DiskMonitorConfig>): Promise<DiskMonitorConfig> {
    this.currentConfig = {
      ...this.currentConfig,
      ...newConfig,
    };

    await this.saveConfigToDB();

    console.log('[DiskMonitor] 🔄 Configuration updated:');
    console.log(`  - Warning threshold: ${this.currentConfig.warningThresholdGB} GB`);
    console.log(`  - Critical threshold: ${this.currentConfig.criticalThresholdGB} GB`);

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.startMonitoring();

    return { ...this.currentConfig };
  }

  /**
   * 获取当前配置
   */
  getConfig(): DiskMonitorConfig {
    return { ...this.currentConfig };
  }

  /**
   * 重置为默认配置
   */
  async resetConfig(): Promise<DiskMonitorConfig> {
    this.currentConfig = { ...DEFAULT_CONFIG };
    await this.saveConfigToDB();
    
    console.log('[DiskMonitor] 🔃 Configuration reset to defaults');
    
    return { ...this.currentConfig };
  }

  /**
   * 启动定期监控
   */
  private startMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkDiskSpace();

    this.checkInterval = setInterval(() => {
      this.checkDiskSpace();
    }, this.currentConfig.checkIntervalMs);

    console.log(
      `[DiskMonitor] ✅ Monitoring started ` +
      `(interval: ${this.currentConfig.checkIntervalMs / 1000}s)`
    );
  }

  /**
   * 检查磁盘空间
   */
  public async checkDiskSpace(): Promise<DiskStatus> {
    if (this.isChecking && this.currentStatus) {
      return this.currentStatus;
    }

    this.isChecking = true;
    try {
      let totalSpaceGB: number;
      let freeSpaceGB: number;

      try {
        const stats = await fs.promises.statfs(uploadsDir);
        totalSpaceGB = (stats.bsize * stats.blocks) / (1024 ** 3);
        freeSpaceGB = (stats.bsize * stats.bfree) / (1024 ** 3);
      } catch {
        totalSpaceGB = os.totalmem() / (1024 ** 3);
        freeSpaceGB = os.freemem() / (1024 ** 3);
      }

      const usedSpaceGB = totalSpaceGB - freeSpaceGB;
      const usagePercent = (usedSpaceGB / totalSpaceGB) * 100;

      let status: 'healthy' | 'warning' | 'critical';
      
      if (freeSpaceGB < this.currentConfig.criticalThresholdGB) {
        status = 'critical';
      } else if (freeSpaceGB < this.currentConfig.warningThresholdGB) {
        status = 'warning';
      } else {
        status = 'healthy';
      }

      this.currentStatus = {
        totalSpaceGB: Math.round(totalSpaceGB * 100) / 100,
        freeSpaceGB: Math.round(freeSpaceGB * 100) / 100,
        usedSpaceGB: Math.round(usedSpaceGB * 100) / 100,
        usagePercent: Math.round(usagePercent * 100) / 100,
        status,
        lastChecked: new Date(),
        uploadsDir: await this.getDirectoryStats(uploadsDir),
        originalDir: await this.getDirectoryStats(path.join(uploadsDir, 'original')),
        variantsDir: await this.getDirectoryStats(path.join(uploadsDir, 'variants')),
      };

      this.logStatus();
      this.triggerAlertIfNeeded(status);

      return this.currentStatus;
    } catch (error) {
      console.error('[DiskMonitor] ❌ Failed to check disk space:', error);
      throw error;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * 获取目录统计信息
   */
  private async getDirectoryStats(dirPath: string): Promise<DirectoryStats | undefined> {
    try {
      const files = await this.recursiveReadDir(dirPath);
      let totalSize = 0;
      let oldestDate: Date | undefined;
      let newestDate: Date | undefined;

      for (const file of files) {
        totalSize += file.size;
        if (!oldestDate || file.mtime < oldestDate) oldestDate = file.mtime;
        if (!newestDate || file.mtime > newestDate) newestDate = file.mtime;
      }

      return {
        path: dirPath,
        fileCount: files.length,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
        oldestFileDate: oldestDate,
        newestFileDate: newestDate,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * 递归读取目录
   */
  private async recursiveReadDir(
    dirPath: string, 
    depth: number = 0
  ): Promise<Array<{ size: number; mtime: Date }>> {
    if (depth > 5) return [];

    const results: Array<{ size: number; mtime: Date }> = [];

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.recursiveReadDir(fullPath, depth + 1);
          results.push(...subFiles);
        } else if (entry.isFile()) {
          try {
            const stat = await fs.promises.stat(fullPath);
            results.push({ size: stat.size, mtime: stat.mtime });
          } catch {
            continue;
          }
        }
      }
    } catch {
      return [];
    }

    return results;
  }

  /**
   * 输出状态日志
   */
  private logStatus(): void {
    if (!this.currentStatus) return;

    const s = this.currentStatus;
    const emoji = s.status === 'critical' ? '🔴' : s.status === 'warning' ? '🟡' : '🟢';

    console.log(
      `[DiskMonitor] ${emoji} Status: ${s.status.toUpperCase()} | ` +
      `Free: ${s.freeSpaceGB} GB | Used: ${s.usagePercent}% | ` +
      `Original: ${s.originalDir?.totalSizeMB ?? 'N/A'} MB | ` +
      `Variants: ${s.variantsDir?.totalSizeMB ?? 'N/A'} MB`
    );
  }

  /**
   * 触发告警
   */
  private triggerAlertIfNeeded(status: string): void {
    if (status === 'critical') {
      this.triggerAlert(
        'CRITICAL',
        `磁盘空间严重不足！仅剩 ${this.currentStatus?.freeSpaceGB.toFixed(1)} GB`
      );
    } else if (status === 'warning') {
      console.warn(
        `[DiskMonitor] ⚠️ 磁盘空间较低: ${this.currentStatus?.freeSpaceGB.toFixed(1)} GB 可用`
      );
    }
  }

  /**
   * 触发告警（可扩展集成钉钉/邮件等）
   */
  private triggerAlert(level: string, message: string): void {
    console.error(`[DiskMonitor] 🔴 ALERT [${level}]: ${message}`);
    
    // TODO: 可在此处集成外部告警通道
    // 例如：发送到钉钉机器人、邮件、企业微信等
  }

  /**
   * 获取当前状态
   */
  public getStatus(): DiskStatus | null {
    return this.currentStatus;
  }

  /**
   * 检查是否允许上传
   */
  public canUpload(requiredBytes: number): boolean {
    if (!this.currentStatus) return true;

    const freeBytes = this.currentStatus.freeSpaceGB * 1024 * 1024 * 1024;
    const minFreeBytes = this.currentConfig.uploadsMinFreeMB * 1024 * 1024;

    return (freeBytes - requiredBytes) > minFreeBytes;
  }

  /**
   * 上传前预检结果
   */
  public getUploadPrecheckResult(): UploadPrecheckResult {
    const status = this.currentStatus;
    
    if (!status) {
      return {
        allowed: true,
        freeSpaceGB: 0,
        config: { ...this.currentConfig },
      };
    }

    if (status.status === 'critical') {
      return {
        allowed: false,
        reason: `磁盘空间严重不足（仅剩 ${status.freeSpaceGB.toFixed(1)} GB），暂时无法上传`,
        freeSpaceGB: status.freeSpaceGB,
        config: { ...this.currentConfig },
      };
    }

    return {
      allowed: true,
      freeSpaceGB: status.freeSpaceGB,
      config: { ...this.currentConfig },
    };
  }

  /**
   * 手动触发检查
   */
  public async manualCheck(): Promise<DiskStatus> {
    console.log('[DiskMonitor] 🔍 Manual check triggered...');
    return await this.checkDiskSpace();
  }

  /**
   * 停止监控（用于测试或维护）
   */
  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[DiskMonitor] ⏹️ Monitoring stopped');
    }
  }

  /**
   * 恢复监控
   */
  public resumeMonitoring(): void {
    if (!this.checkInterval) {
      this.startMonitoring();
      console.log('[DiskMonitor] ▶️ Monitoring resumed');
    }
  }
}

export const diskMonitor = DiskMonitorService.getInstance();
