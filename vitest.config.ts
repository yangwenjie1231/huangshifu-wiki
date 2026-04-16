import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: [
        // 路由文件 - 更适合集成测试
        'src/server/routes/**/*.ts',
        // 中间件 - 更适合集成测试
        'src/server/middleware/**/*.ts',
        // 工具函数聚合文件 - 只是导出
        'src/server/utils/index.ts',
        'src/server/types/index.ts',
        // 服务入口文件
        'src/server/**/routes.ts',
      ],
      thresholds: {
        lines: 25,
        functions: 65,
        branches: 70,
        statements: 25,
      },
    },
  },
});
