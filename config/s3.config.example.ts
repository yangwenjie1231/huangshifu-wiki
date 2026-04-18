export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface S3BucketConfig {
  name: string;
  region: string;
  prefix?: string;
}

export interface S3EndpointConfig {
  url: string;
  forcePathStyle?: boolean;
  sslEnabled?: boolean;
  signatureVersion?: 'v2' | 'v4';
}

export interface S3SecurityConfig {
  maxFileSize?: number;
  allowedContentTypes?: string[];
  enableMd5Verification?: boolean;
}

export interface S3Config {
  enabled: boolean;
  credentials: {
    read: S3Credentials;
    write: S3Credentials;
  };
  buckets: {
    public: S3BucketConfig;
    private?: S3BucketConfig;
  };
  endpoint?: S3EndpointConfig;
  security?: S3SecurityConfig;
  defaultAcl?: string;
  expiresIn?: number;
}

export const S3_CONFIG_EXAMPLE: S3Config = {
  enabled: false,
  credentials: {
    read: {
      accessKeyId: 'your_read_only_access_key_id',
      secretAccessKey: 'your_read_only_secret_access_key',
    },
    write: {
      accessKeyId: 'your_write_access_key_id',
      secretAccessKey: 'your_write_secret_access_key',
    },
  },
  buckets: {
    public: {
      name: 'your-bucket-name',
      region: 'auto',
      prefix: 'public/',
    },
  },
  endpoint: {
    url: 'https://s3.bitiful.net',
    forcePathStyle: true,
    sslEnabled: true,
    signatureVersion: 'v4',
  },
  security: {
    maxFileSize: 10 * 1024 * 1024,
    allowedContentTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/bmp',
    ],
    enableMd5Verification: true,
  },
  defaultAcl: 'public-read',
  expiresIn: 3600,
};

export const S3_ENV_VAR_NAMES = {
  S3_ENABLED: 'S3_ENABLED',
  S3_READ_ACCESS_KEY_ID: 'S3_READ_ACCESS_KEY_ID',
  S3_READ_SECRET_ACCESS_KEY: 'S3_READ_SECRET_ACCESS_KEY',
  S3_WRITE_ACCESS_KEY_ID: 'S3_WRITE_ACCESS_KEY_ID',
  S3_WRITE_SECRET_ACCESS_KEY: 'S3_WRITE_SECRET_ACCESS_KEY',
  S3_PUBLIC_BUCKET_NAME: 'S3_PUBLIC_BUCKET_NAME',
  S3_PUBLIC_BUCKET_REGION: 'S3_PUBLIC_BUCKET_REGION',
  S3_PUBLIC_BUCKET_PREFIX: 'S3_PUBLIC_BUCKET_PREFIX',
  S3_PRIVATE_BUCKET_NAME: 'S3_PRIVATE_BUCKET_NAME',
  S3_PRIVATE_BUCKET_REGION: 'S3_PRIVATE_BUCKET_REGION',
  S3_ENDPOINT_URL: 'S3_ENDPOINT_URL',
  S3_FORCE_PATH_STYLE: 'S3_FORCE_PATH_STYLE',
  S3_SSL_ENABLED: 'S3_SSL_ENABLED',
  S3_SIGNATURE_VERSION: 'S3_SIGNATURE_VERSION',
  S3_DEFAULT_ACL: 'S3_DEFAULT_ACL',
  S3_EXPIRES_IN: 'S3_EXPIRES_IN',
  S3_MAX_FILE_SIZE: 'S3_MAX_FILE_SIZE',
  S3_ALLOWED_CONTENT_TYPES: 'S3_ALLOWED_CONTENT_TYPES',
  S3_ENABLE_MD5_VERIFICATION: 'S3_ENABLE_MD5_VERIFICATION',
} as const;

export function getS3EnvDocumentation(): string {
  return `
# ============================================
# S3 对象存储配置 - 缤纷云 Bitiful
# ============================================
# 参考文档: https://docs.bitiful.com/

# 是否启用 S3（true/false）
S3_ENABLED="false"

# ============================================
# 凭证配置 - 遵循最小权限原则
# ============================================

# 读取凭证（用于生成公开访问 URL）
# 建议：只授予 GetObject 权限
S3_READ_ACCESS_KEY_ID="your_read_only_access_key_id"
S3_READ_SECRET_ACCESS_KEY="your_read_only_secret_access_key"

# 写入凭证（用于上传文件）
# 建议：只授予 PutObject 和 DeleteObject 权限
S3_WRITE_ACCESS_KEY_ID="your_write_access_key_id"
S3_WRITE_SECRET_ACCESS_KEY="your_write_secret_access_key"

# ============================================
# 存储桶配置
# ============================================

# 公开存储桶（用于公开访问的对象）
S3_PUBLIC_BUCKET_NAME="your-public-bucket"
S3_PUBLIC_BUCKET_REGION="auto"
S3_PUBLIC_BUCKET_PREFIX="public/"

# 私有存储桶（可选，用于需要权限访问的对象）
S3_PRIVATE_BUCKET_NAME=""
S3_PRIVATE_BUCKET_REGION="auto"

# ============================================
# S3 兼容端点配置
# ============================================

# Bitiful S3 端点
S3_ENDPOINT_URL="https://s3.bitiful.net"

# 是否强制使用 path-style（部分 S3 兼容服务需要）
S3_FORCE_PATH_STYLE="true"

# 是否启用 SSL/TLS（HTTPS）
S3_SSL_ENABLED="true"

# 签名版本（v2 或 v4，Bitiful 使用 v4）
S3_SIGNATURE_VERSION="v4"

# ============================================
# 安全配置
# ============================================

# 最大文件大小（字节），默认 10MB
S3_MAX_FILE_SIZE="10485760"

# 允许的文件类型（逗号分隔），默认图片类型
S3_ALLOWED_CONTENT_TYPES="image/jpeg,image/png,image/gif,image/webp,image/bmp"

# 是否启用 MD5 校验（推荐启用）
# 启用后，上传时必须提供 Content-MD5 头
S3_ENABLE_MD5_VERIFICATION="true"

# 默认访问控制（public-read, private 等）
S3_DEFAULT_ACL="public-read"

# 预签名 URL 过期时间（秒）
# 建议：上传使用较短时间（300-900秒），下载使用较长时间（3600秒）
S3_EXPIRES_IN="3600"
`;
}
