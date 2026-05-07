#!/usr/bin/env tsx
/**
 * 测试数据库初始化脚本
 *
 * 功能：
 * 1. 创建测试数据库（如果不存在）
 * 2. 运行数据库迁移
 * 3. 可选：运行种子数据
 *
 * 使用方法：
 *   npm run test:db:init
 *   或者：tsx scripts/test-db-init.ts
 *
 * 环境变量：
 *   - 从 .env.test 文件加载测试数据库配置
 *   - 确保测试数据库与开发数据库隔离
 */

import dotenv from 'dotenv';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 加载测试环境变量（优先级：.env.test > .env.local > .env）
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ 错误：未找到 DATABASE_URL 环境变量');
  console.error('请确保 .env.test 文件存在并包含 DATABASE_URL');
  process.exit(1);
}

// 解析数据库连接信息
function parseDatabaseUrl(url: string) {
  try {
    const regex = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
    const match = url.match(regex);

    if (!match) {
      throw new Error('无法解析 DATABASE_URL');
    }

    return {
      user: match[1],
      password: match[2],
      host: match[3],
      port: match[4],
      database: match[5],
    };
  } catch (error) {
    console.error('❌ 解析 DATABASE_URL 失败:', error);
    process.exit(1);
  }
}

const dbConfig = parseDatabaseUrl(DATABASE_URL);

// 检查数据库名称是否包含 "test"
if (!dbConfig.database.includes('test')) {
  console.error('❌ 安全检查失败：数据库名称必须包含 "test"');
  console.error(`当前数据库名称: ${dbConfig.database}`);
  console.error('这可以防止意外操作生产或开发数据库');
  process.exit(1);
}

console.log('========================================');
console.log('测试数据库初始化脚本');
console.log('========================================');
console.log(`数据库主机: ${dbConfig.host}:${dbConfig.port}`);
console.log(`数据库名称: ${dbConfig.database}`);
console.log('========================================\n');

// 创建数据库（如果不存在）
function createDatabaseIfNotExists() {
  console.log('📦 步骤 1: 检查并创建测试数据库...');

  try {
    // 使用 psql 命令检查数据库是否存在
    const checkDbCommand = `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -lqt | cut -d \\| -f 1 | grep -qw ${dbConfig.database}`;

    try {
      execSync(checkDbCommand, {
        env: { ...process.env, PGPASSWORD: dbConfig.password },
        stdio: 'pipe',
      });
      console.log(`✅ 数据库 "${dbConfig.database}" 已存在\n`);
    } catch {
      // 数据库不存在，创建它
      console.log(`📝 创建数据库 "${dbConfig.database}"...`);
      const createDbCommand = `createdb -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} ${dbConfig.database}`;
      execSync(createDbCommand, {
        env: { ...process.env, PGPASSWORD: dbConfig.password },
        stdio: 'inherit',
      });
      console.log(`✅ 数据库 "${dbConfig.database}" 创建成功\n`);
    }
  } catch (error) {
    console.error('❌ 创建数据库失败:', error);
    console.error('\n请确保：');
    console.error('1. PostgreSQL 服务正在运行');
    console.error('2. 数据库用户有创建数据库的权限');
    console.error('3. psql 和 createdb 命令可用');
    process.exit(1);
  }
}

// 运行数据库迁移
function runMigrations() {
  console.log('📦 步骤 2: 运行数据库迁移...');

  try {
    // 使用 Prisma 迁移
    execSync('npx prisma migrate deploy', {
      cwd: path.resolve(__dirname, '..'),
      env: process.env,
      stdio: 'inherit',
    });
    console.log('✅ 数据库迁移完成\n');
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    process.exit(1);
  }
}

// 生成 Prisma Client
function generatePrismaClient() {
  console.log('📦 步骤 3: 生成 Prisma Client...');

  try {
    execSync('npx prisma generate', {
      cwd: path.resolve(__dirname, '..'),
      env: process.env,
      stdio: 'inherit',
    });
    console.log('✅ Prisma Client 生成完成\n');
  } catch (error) {
    console.error('❌ Prisma Client 生成失败:', error);
    process.exit(1);
  }
}

// 可选：运行种子数据
function runSeed() {
  const shouldSeed = process.argv.includes('--seed');

  if (!shouldSeed) {
    console.log('ℹ️  跳过种子数据（使用 --seed 参数运行种子数据）\n');
    return;
  }

  console.log('📦 步骤 4: 运行种子数据...');

  try {
    execSync('npx prisma db seed', {
      cwd: path.resolve(__dirname, '..'),
      env: process.env,
      stdio: 'inherit',
    });
    console.log('✅ 种子数据完成\n');
  } catch (error) {
    console.error('❌ 种子数据失败:', error);
    process.exit(1);
  }
}

// 主函数
async function main() {
  try {
    createDatabaseIfNotExists();
    generatePrismaClient();
    runMigrations();
    runSeed();

    console.log('========================================');
    console.log('✅ 测试数据库初始化完成！');
    console.log('========================================');
    console.log('\n下一步：');
    console.log('  - 运行测试: npm run test');
    console.log('  - 运行测试（监视模式）: npm run test:watch');
    console.log('  - 清理测试数据库: npm run test:db:cleanup\n');
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    process.exit(1);
  }
}

main();
