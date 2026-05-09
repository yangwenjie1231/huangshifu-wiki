# Security Vulnerabilities Tracking

本文档记录项目中已知的安全漏洞及其处理状态。

## 📋 漏洞列表

### 1. nanoid 可预测性漏洞 (Moderate)

**状态**: ⏳ 已知，暂不处理  
**发现日期**: 2026-05-08  
**严重级别**: Moderate (中等)  

#### 详情

| 属性 | 值 |
|------|-----|
| **CVE/GHSA** | [GHSA-mwcw-c2x4-8c55](https://github.com/advisories/GHSA-mwcw-c2x4-8c55) |
| **受影响包** | nanoid 4.0.0 - 5.0.8 |
| **来源依赖** | react-markdown-editor-lite >= 1.4.2 (间接依赖) |
| **当前版本** | react-markdown-editor-lite@^1.4.2 |
| **漏洞描述** | 当给定非整数值时，nanoid 生成的 ID 可预测 |

#### 影响范围

- **直接使用组件**:
  - `src/pages/Forum.tsx` - MarkdownEditor
  - `src/components/wiki/WikiEditor.tsx` - MarkdownEditor

#### 风险评估

✅ **实际风险较低**:
- nanoid 主要用于生成唯一 ID（如 DOM 元素 ID、临时 key）
- 漏洞需要传入非整数参数才能触发
- 在正常使用场景下，传入的参数通常是整数或字符串
- 属于间接依赖，非项目核心功能

⚠️ **潜在影响**:
- 如果攻击者能控制传入 nanoid 的参数，可能预测生成的 ID
- 可能影响 Markdown 编辑器中某些元素的唯一性标识

#### 修复方案选项

**方案 1: 强制修复 (推荐度: ⭐⭐)**
```bash
npm audit fix --force
```
- ✅ 完全消除漏洞
- ❌ 会将 react-markdown-editor-lite 从 1.4.2 降级到 1.3.4
- ❌ 可能存在 API 兼容性问题，需全面测试

**方案 2: 覆盖依赖版本 (推荐度: ⭐⭐⭐)**
在 `package.json` 中添加:
```json
{
  "overrides": {
    "nanoid": "^5.0.9"
  }
}
```
然后运行:
```bash
npm install
```
- ✅ 强制使用安全版本的 nanoid
- ✅ 不影响 react-markdown-editor-lite 版本
- ⚠️ 可能导致 react-markdown-editor-lite 功能异常（版本不兼容）

**方案 3: 暂不处理 (当前选择) ✅**
- 等待 react-markdown-editor-lite 官方发布新版本
- 监控漏洞利用情况
- 定期运行 `npm audit` 检查更新

#### 监控计划

- **频率**: 每月检查一次
- **命令**: `npm audit`
- **触发条件**: 
  - react-markdown-editor-lite 发布新版本
  - nanoid 发布安全更新
  - 发现漏洞被实际利用的报告

#### 相关资源

- [GitHub Advisory](https://github.com/advisories/GHSA-mwcw-c2x4-8c55)
- [nanoid GitHub Issues](https://github.com/ai/nanoid/issues)
- [react-markdown-editor-lite GitHub](https://github.com/react-markdown-editor-lite/react-markdown-editor-lite)

---

## 🔧 配置说明

### onnxruntime_node_install_cuda 配置

**文件**: `.npmrc`  
**配置**: `onnxruntime_node_install_cuda=skip`

**说明**: 此配置用于优化 @huggingface/transformers 包的安装：
- 跳过 CUDA GPU 二进制文件下载
- 仅使用 CPU 版本的 ONNX Runtime
- 足够满足嵌入生成（embeddings）的需求
- 减少 ~500MB 的下载量和安装时间

**警告**: npm 会显示 "Unknown project config" 警告，但这是预期行为，不影响功能。

---

## 📊 安全审计历史

### 2026-05-08 审计结果

```
$ npm audit

# 统计信息
- 总包数: 932
- 已审计包数: 932
- 寻求资助的包: 256

# 漏洞统计 (修复前)
- Critical: 0
- High: 0
- Moderate: 13+ (通过 npm audit fix 修复了大部分)
- Low: 0
- Info: 0

# 执行的修复
$ npm audit fix
changed 13 packages, and audited 932 packages in 4m

# 剩余漏洞
- 2 moderate severity vulnerabilities (nanoid)
```

---

## 🛡️ 安全最佳实践

### 定期维护

1. **每周任务**:
   ```bash
   npm audit          # 检查已知漏洞
   npm outdated       # 检查过时的包
   ```

2. **每月任务**:
   ```bash
   npm update         # 更新符合 semver 的包
   npm audit fix      # 自动修复可修复的漏洞
   ```

3. **每季度任务**:
   - 全面审查依赖项
   - 更新主要版本（需测试）
   - 检查废弃的包

### CI/CD 集成

项目已配置自动安全扫描：

- **Security Workflow**: `.github/workflows/security.yml`
  - 运行 `npm audit --json`
  - 生成 SARIF 格式报告
  - 上传到 GitHub Security tab
  - PR 评论通知

- **Dependabot**: `.github/dependabot.yml`
  - 自动监控依赖漏洞
  - 自动创建 PR 更新有漏洞的依赖

### 应急响应流程

如果发现严重漏洞（Critical/High）：

1. **立即评估影响范围**
   ```bash
   npm ls <vulnerable-package>
   ```

2. **查看修复建议**
   ```bash
   npm audit fix --dry-run    # 预览修复内容
   ```

3. **测试修复方案**
   ```bash
   npm audit fix              # 尝试自动修复
   npm test                   # 运行测试套件
   npm run build              # 验证构建
   ```

4. **如果自动修复失败**
   - 手动升级受影响的包
   - 或使用 overrides 强制版本
   - 或联系包维护者

5. **部署修复**
   - 提交修复代码
   - 通过 CI/CD 流水线
   - 监控生产环境

---

## 📞 联系方式

如发现新的安全问题或疑问，请：

1. 创建 GitHub Issue（标记为 security）
2. 联系项目维护者
3. 参考 [SECURITY.md](../SECURITY.md) 的披露政策

---

**最后更新**: 2026-05-08  
**文档维护者**: AI Assistant  
**下次审查日期**: 2026-06-08
