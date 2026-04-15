import { PrismaClient } from '@prisma/client';

// 全局 Prisma 客户端实例
// 在开发环境中使用 globalThis 来保持热重载时的连接
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
