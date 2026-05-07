# 集成测试

此目录包含 API 端点的集成测试。

## 运行方式

```bash
# 初始化测试数据库（首次使用）
npm run test:db:init

# 运行集成测试
npm run test:integration

# 运行集成测试并生成覆盖率报告
npm run test:integration -- --coverage

# 清理测试数据库
npm run test:db:cleanup
```

## 测试数据库

集成测试使用独立的测试数据库 `huangshifu_wiki_test`，不会影响开发或生产数据库。

## 编写新测试

1. 在此目录下创建 `.test.ts` 文件
2. 使用 supertest 进行 HTTP 请求测试
3. 使用 Prisma Client 直接操作数据库进行数据准备和验证
4. 测试结束后自动清理测试数据
