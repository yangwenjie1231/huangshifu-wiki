# Lsky Pro+ 图床 React Hooks 使用指南

## 📦 安装与配置

### 1. 环境变量配置

在项目根目录的 `.env` 文件中配置：

```bash
# 后端使用（安全，不会暴露到前端）
LSKY_BASE_URL="https://your-lsky-domain.com"
LSKY_TOKEN="your-secret-token"  # 可选

# 前端使用（会被打包到前端代码，仅用于公开的 API 地址）
VITE_LSKY_BASE_URL="https://your-lsky-domain.com"
```

⚠️ **安全提示**：
- `LSKY_*` 开头的变量只在后端使用，是安全的
- `VITE_*` 开头的变量会被打包到前端代码，不要放敏感信息（如 Token、密码）

### 2. 获取 Lsky Pro+ 服务器地址

- **自建服务器**：部署 Lsky Pro+ 后，地址类似 `http://127.0.0.1:8000` 或 `https://lsky.yourdomain.com`
- **第三方服务**：联系服务商获取 API 地址

---

## 🎣 React Hooks

### useLskyUpload - 图片上传

```tsx
import { useLskyUpload } from '../hooks/useLskyUpload';

function UploadComponent() {
  const { uploading, progress, error, data, upload, reset } = useLskyUpload();

  const handleUpload = async (file: File) => {
    const result = await upload(file, {
      album_id: 1,        // 可选：指定相册
      permission: '0',    // 可选：0=公开，1=私有，2=密码保护
    });

    if (result) {
      console.log('上传成功:', result.url);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        disabled={uploading}
      />
      
      {uploading && <div>上传进度: {progress}%</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {data && (
        <div>
          <img src={data.url} alt="Uploaded" />
          <p>URL: {data.url}</p>
          <button onClick={reset}>继续上传</button>
        </div>
      )}
    </div>
  );
}
```

**返回值**：
- `uploading: boolean` - 是否正在上传
- `progress: number` - 上传进度（0-100）
- `error: string | null` - 错误信息
- `data: UploadV2Data | null` - 上传成功后的图片数据
- `upload(file, options)` - 上传函数
- `reset()` - 重置状态
- `api` - LskyProAPI 实例

---

### useLskyPhotos - 图片管理

```tsx
import { useLskyPhotos } from '../hooks/useLskyPhotos';

function PhotosComponent() {
  const { 
    loading, 
    error, 
    photos, 
    pagination, 
    fetchPhotos, 
    deletePhoto,
    updatePhoto 
  } = useLskyPhotos({ autoFetch: true });

  const handleDelete = async (id: number) => {
    const success = await deletePhoto(id);
    if (success) {
      alert('删除成功');
    }
  };

  const handleMoveToAlbum = async (id: number, albumId: number) => {
    await updatePhoto(id, { album_id: albumId });
  };

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;

  return (
    <div>
      {photos.map(photo => (
        <div key={photo.id}>
          <img src={photo.url} alt={photo.filename} />
          <p>{photo.origin_name}</p>
          <button onClick={() => handleDelete(photo.id)}>删除</button>
        </div>
      ))}

      {pagination && (
        <div>
          <button 
            onClick={() => fetchPhotos({ page: pagination.current_page - 1 })}
            disabled={pagination.current_page === 1}
          >
            上一页
          </button>
          <span>{pagination.current_page} / {pagination.last_page}</span>
          <button 
            onClick={() => fetchPhotos({ page: pagination.current_page + 1 })}
            disabled={pagination.current_page === pagination.last_page}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
```

**返回值**：
- `loading: boolean` - 是否正在加载
- `error: string | null` - 错误信息
- `photos: Photo[]` - 图片列表
- `pagination` - 分页信息
- `fetchPhotos(params)` - 获取图片列表
- `deletePhoto(id)` - 删除图片
- `updatePhoto(id, data)` - 更新图片信息

---

### useLskyAlbums - 相册管理

```tsx
import { useLskyAlbums } from '../hooks/useLskyAlbums';

function AlbumsComponent() {
  const { 
    loading, 
    error, 
    albums, 
    currentAlbum,
    createAlbum, 
    updateAlbum, 
    deleteAlbum,
    fetchAlbum 
  } = useLskyAlbums({ autoFetch: true });

  const handleCreate = async () => {
    const album = await createAlbum({
      name: '新相册',
      description: '相册描述',
    });

    if (album) {
      alert('创建成功');
    }
  };

  const handleDelete = async (id: number) => {
    const success = await deleteAlbum(id);
    if (success) {
      alert('删除成功');
    }
  };

  if (loading) return <div>加载中...</div>;

  return (
    <div>
      <button onClick={handleCreate}>创建相册</button>
      
      {albums.map(album => (
        <div key={album.id}>
          <h3>{album.name}</h3>
          <p>{album.description}</p>
          <p>图片数量: {album.photo_count}</p>
          <button onClick={() => handleDelete(album.id)}>删除</button>
        </div>
      ))}
    </div>
  );
}
```

**返回值**：
- `loading: boolean` - 是否正在加载
- `error: string | null` - 错误信息
- `albums: Album[]` - 相册列表
- `currentAlbum: Album | null` - 当前查看的相册
- `fetchAlbums(params)` - 获取相册列表
- `fetchAlbum(id)` - 获取相册详情
- `createAlbum(data)` - 创建相册
- `updateAlbum(id, data)` - 更新相册
- `deleteAlbum(id)` - 删除相册

---

## 🎨 完整示例组件

查看 `src/components/LskyImageManager.tsx` 获取完整的图床管理界面示例，包括：

- ✅ 图片上传（支持进度显示）
- ✅ 图片列表（支持分页、删除）
- ✅ 相册管理（创建、删除）
- ✅ 错误处理
- ✅ 响应式设计

**使用方式**：

```tsx
import { LskyImageManager } from '../components/LskyImageManager';

function App() {
  return <LskyImageManager />;
}
```

---

## 🔐 后端 API 使用（安全方式）

如果需要在后端使用 Lsky Pro+ API（推荐用于敏感操作）：

```typescript
// server.ts 或后端路由文件
import { LskyProAPI } from './src/lib/lskyClient';

const api = new LskyProAPI({
  baseUrl: process.env.LSKY_BASE_URL!,
  token: process.env.LSKY_TOKEN,  // 从环境变量读取，安全
});

// 上传图片（后端）
app.post('/api/upload-to-lsky', async (req, res) => {
  const file = req.file; // 从请求中获取文件
  
  const result = await api.upload(file);
  
  res.json({
    url: result.data.url,
    id: result.data.id,
  });
});
```

---

## 📝 常见问题

### Q1: 如何处理认证？

**方式 A：使用 Token（推荐用于后端）**
```typescript
const api = new LskyProAPI({ 
  baseUrl: process.env.LSKY_BASE_URL!,
  token: process.env.LSKY_TOKEN 
});
```

**方式 B：使用用户名密码登录（推荐用于前端）**
```typescript
const { upload } = useLskyUpload({
  autoLogin: true,
  loginCredentials: {
    email: 'user@example.com',
    password: '123456',
  },
});
```

### Q2: 如何处理错误？

```typescript
import { LskyProAPIError } from '../lib/lskyClient';

try {
  await upload(file);
} catch (err) {
  if (err instanceof LskyProAPIError) {
    if (err.isAuthError) {
      // 认证失败，跳转登录
    } else if (err.isPermissionError) {
      // 权限不足
    } else {
      // 其他错误
      console.log(err.message);
    }
  }
}
```

### Q3: 如何自定义配置？

```typescript
const { upload } = useLskyUpload({
  baseUrl: 'https://custom-lsky.com',  // 自定义地址
  token: 'your-token',                  // 自定义 Token
  timeout: 60000,                       // 自定义超时
});
```

---

## 🚀 下一步

1. 配置 `.env` 文件中的 `VITE_LSKY_BASE_URL`
2. 在组件中导入并使用 Hooks
3. 根据需求自定义 UI 样式
4. 如需后端操作，使用 `LSKY_*` 环境变量

---

## 📚 相关文档

- [Lsky Pro+ API 文档](https://lsky-pro.apifox.cn/)
- [lskyClient.ts 源码](../src/lib/lskyClient.ts)
- [React Hooks 源码](../src/hooks/)
- [完整示例组件](../src/components/LskyImageManager.tsx)
