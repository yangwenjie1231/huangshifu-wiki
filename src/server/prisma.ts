import { PrismaClient } from '@prisma/client';

// 全局 Prisma 客户端实例
// 在开发环境中使用 globalThis 来保持热重载时的连接
// 避免每次 HMR 都创建新的 PrismaClient 实例（会导致连接数泄漏）
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 连接池配置说明：
// Prisma v5+ 不直接在构造参数中支持 connection_limit。
// 推荐通过 DATABASE_URL 查询参数设置连接池：
//   postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10&connect_timeout=10
//
// 参数说明：
//   connection_limit: 最大连接数（默认按 pg 库的默认值，通常 10）
//   pool_timeout: 从池中获取连接的超时时间（秒）
//   connect_timeout: 建立新连接的超时时间（秒）
//
// 生产环境建议：根据 CPU 核心数 * 2 + 1 设置 connection_limit
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

if (isDev) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
