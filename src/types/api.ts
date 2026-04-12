export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface HomeFeedResponse {
  announcements: Array<{
    id: string;
    content: string;
    link?: string;
    createdAt: string;
  }>;
  hotPosts: Array<{
    id: string;
    title: string;
    section: string;
    commentsCount: number;
    likesCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  recentPosts: Array<{
    id: string;
    title: string;
    section: string;
    commentsCount: number;
    likesCount: number;
    updatedAt: string;
  }>;
}

export interface NotificationsResponse {
  notifications: Array<{
    id: string;
    type: 'reply' | 'like' | 'review_result';
    payload: Record<string, unknown>;
    isRead: boolean;
    createdAt: string;
  }>;
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

export interface UploadSessionResponse {
  session: {
    id: string;
    status: 'open' | 'finalized' | 'expired';
    maxFiles: number;
    uploadedFiles: number;
    expiresAt: string;
  };
}

export interface UploadFileResponse {
  session: {
    id: string;
    status: 'open' | 'finalized' | 'expired';
    uploadedFiles: number;
    maxFiles: number;
  };
  asset: {
    id: string;
    url: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  };
}

export interface GalleryCreateResponse {
  gallery: {
    id: string;
  };
}

export interface ImageStats {
  total: number;
  stats: {
    local: number;
    external: number;
    s3: number;
  };
}

export interface ImagePreference {
  strategy: 'local' | 's3' | 'external';
  fallback: boolean;
}
