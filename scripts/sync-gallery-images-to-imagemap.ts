/**
 * 历史图集图片同步脚本
 * 将现有的 MediaAsset (图集图片) 批量同步到 ImageMap 表
 *
 * 使用方法:
 * npx tsx scripts/sync-gallery-images-to-imagemap.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';
import { syncAllMediaAssetsToImageMap } from '../src/server/services/galleryImageSyncService';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('========================================');
  console.log('图集图片同步到 ImageMap 工具');
  console.log('========================================');
  console.log('');

  if (dryRun) {
    console.log('⚠️  当前为试运行模式 (--dry-run)，不会实际修改数据库');
    console.log('');
  }

  try {
    // 获取所有 MediaAsset 数量
    const totalAssets = await prisma.mediaAsset.count({
      where: { status: 'ready' },
    });

    console.log(`📊 发现 ${totalAssets} 个 MediaAsset 记录`);
    console.log('');

    if (totalAssets === 0) {
      console.log('✅ 没有需要同步的图片');
      return;
    }

    // 获取已存在的 ImageMap 数量
    const existingImageMaps = await prisma.imageMap.count();
    console.log(`📊 当前 ImageMap 表中有 ${existingImageMaps} 条记录`);
    console.log('');

    if (dryRun) {
      console.log('🔍 试运行模式：将同步以下图片（仅显示前 10 个）:');
      const assets = await prisma.mediaAsset.findMany({
        where: { status: 'ready' },
        take: 10,
      });

      for (const asset of assets) {
        console.log(`   - ${asset.fileName} (${asset.publicUrl})`);
      }

      if (totalAssets > 10) {
        console.log(`   ... 还有 ${totalAssets - 10} 个图片`);
      }

      console.log('');
      console.log('💡 移除 --dry-run 参数以执行实际同步');
      return;
    }

    console.log('🚀 开始同步...');
    console.log('');

    const result = await syncAllMediaAssetsToImageMap();

    console.log('');
    console.log('========================================');
    console.log('同步结果');
    console.log('========================================');
    console.log(`总计: ${result.total}`);
    console.log(`成功: ${result.success} ✅`);
    console.log(`失败: ${result.failed} ❌`);
    console.log('');

    if (result.errors.length > 0) {
      console.log('错误详情:');
      result.errors.slice(0, 20).forEach((error) => {
        console.log(`  - ${error}`);
      });

      if (result.errors.length > 20) {
        console.log(`  ... 还有 ${result.errors.length - 20} 个错误`);
      }
    }

    // 获取同步后的 ImageMap 数量
    const newImageMaps = await prisma.imageMap.count();
    console.log('');
    console.log(`📊 ImageMap 记录数: ${existingImageMaps} → ${newImageMaps} (+${newImageMaps - existingImageMaps})`);
    console.log('');
    console.log('✅ 同步完成!');
  } catch (error) {
    console.error('❌ 同步失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
