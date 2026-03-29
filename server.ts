import axios from 'axios';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import fs from 'fs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { execFile } from 'child_process';
import { promisify } from 'util';
import archiver from 'archiver';
import crypto from 'crypto';
import * as cheerio from 'cheerio';
import {
  Prisma,
  PrismaClient,
  UserRole as PrismaUserRole,
} from '@prisma/client';
import { getEmbeddingModelName, getEmbeddingVectorSize, generateImageEmbedding, generateTextEmbedding } from './src/server/vector/clipEmbedding';
import { getQdrantCollectionName, searchImageEmbeddingPoints } from './src/server/vector/qdrantService';
import { enqueueGalleryImageEmbeddings, enqueueMissingImageEmbeddings, syncImageEmbeddingBatch } from './src/server/vector/embeddingSync';
import {
  parseMusicUrl,
  type MusicPlatform as ParsedMusicPlatform,
  type MusicResourceType as ParsedMusicResourceType,
} from './src/server/music/musicUrlParser';
import {
  getMusicResourcePreview,
  resolveAudioUrl as resolveMetingAudioUrl,
  resolveLyric as resolveMetingLyric,
  resolveCoverUrl as resolveMetingCoverUrl,
  searchMusicResources,
} from './src/server/music/metingService';
import { registerRegionRoutes } from './src/server/location/routes';
import { registerExifRoutes } from './src/server/location/exifRoutes';
import { authRateLimiter } from './src/server/middleware/rateLimiter';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

// Content Security Policy - Allow loading Amap JS API
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    'Content-Security-Policy',
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://webapi.amap.com; connect-src 'self' https://restapi.amap.com https://webapi.amap.com; img-src 'self' data: https://*.amap.com https://*.gaode.com blob:; style-src 'self' 'unsafe-inline';"
  );
  next();
});

const prisma = new PrismaClient();
const prismaAny = prisma as any;
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
const backupsDir = path.join(__dirname, 'backups');
fs.mkdirSync(backupsDir, { recursive: true });

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '';
const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL || '';
const BACKUP_PASSWORD = process.env.BACKUP_PASSWORD || '';
const BACKUP_RETAIN_COUNT = Math.max(1, Number(process.env.BACKUP_RETAIN_COUNT || 20));
const WECHAT_MP_APPID = process.env.WECHAT_MP_APPID || process.env.WECHAT_APP_ID || '';
const WECHAT_MP_APP_SECRET =
  process.env.WECHAT_MP_APP_SECRET || process.env.WECHAT_MP_APPSECRET || process.env.WECHAT_APP_SECRET || '';
const WECHAT_LOGIN_MOCK = process.env.NODE_ENV !== 'production' && process.env.WECHAT_LOGIN_MOCK === 'true';

if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET. Please set it in .env.local');
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const AUTH_COOKIE_NAME = 'hsf_token';
const IS_PROD = process.env.NODE_ENV === 'production';
const UPLOAD_SESSION_TTL_MINUTES = Math.max(5, Number(process.env.UPLOAD_SESSION_TTL_MINUTES || 45));
const IMAGE_EMBEDDING_BATCH_SIZE = Math.max(1, Number(process.env.IMAGE_EMBEDDING_BATCH_SIZE || 100));
const IMAGE_SEARCH_RESULT_LIMIT = Math.max(1, Number(process.env.IMAGE_SEARCH_RESULT_LIMIT || 24));
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
]);

interface SessionJwtPayload extends JwtPayload {
  uid: string;
  role: PrismaUserRole;
}

interface WechatCodeSessionResponse {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

interface ApiUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  wechatBound: boolean;
  role: PrismaUserRole;
  status: UserStatus;
  banReason: string | null;
  bannedAt: string | null;
  level: number;
  bio: string;
}

type UserStatus = 'active' | 'banned';
type ContentStatus = 'draft' | 'pending' | 'published' | 'rejected';
type WikiBranchStatus = 'draft' | 'pending_review' | 'merged' | 'rejected' | 'conflict';
type WikiPullRequestStatus = 'open' | 'merged' | 'rejected';
type WikiRelationType = 'related_person' | 'work_relation' | 'timeline_relation' | 'custom';
type FavoriteTargetType = 'wiki' | 'post' | 'music';
type ModerationTargetType = 'wiki' | 'post';
type NotificationType = 'reply' | 'like' | 'review_result';
type BrowsingTargetType = 'wiki' | 'post' | 'music';
type PostSortType = 'latest' | 'hot' | 'recommended';
const MUSIC_SECTION_ID = 'music';

type WikiRelationRecord = {
  type: WikiRelationType;
  targetSlug: string;
  label?: string;
  bidirectional: boolean;
};

type WikiRelationResolved = WikiRelationRecord & {
  typeLabel: string;
  targetTitle: string;
  targetCategory: string;
  inferred: boolean;
  sourceSlug: string;
  sourceTitle: string;
};

type WikiRelationGraphNode = {
  slug: string;
  title: string;
  category: string;
  depth: 0 | 1 | 2;
  isCenter: boolean;
};

type WikiRelationGraphEdge = {
  sourceSlug: string;
  targetSlug: string;
  type: WikiRelationType;
  typeLabel: string;
  label: string | null;
  inferred: boolean;
};
type MusicPlatform = 'netease' | 'tencent' | 'kugou' | 'baidu' | 'kuwo';
type DisplayAlbumMode = 'none' | 'linked' | 'manual';
type MusicCollectionType = 'album' | 'playlist';

type MusicTrackWithRelations = {
  docId: string;
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  lyric: string | null;
  primaryPlatform: MusicPlatform;
  enabledPlatform: MusicPlatform | null;
  neteaseId: string | null;
  tencentId: string | null;
  kugouId: string | null;
  baiduId: string | null;
  kuwoId: string | null;
  displayAlbumMode: DisplayAlbumMode;
  manualAlbumName: string | null;
  defaultCoverSource: string | null;
  createdAt: Date;
  updatedAt: Date;
  covers: Array<{
    id: string;
    publicUrl: string;
    isDefault: boolean;
    sortOrder: number;
  }>;
  albumRelations: Array<{
    albumDocId: string;
    discNumber: number;
    trackOrder: number;
    isDisplay: boolean;
    album: {
      docId: string;
      title: string;
      artist: string;
      cover: string;
      defaultCoverSource: string | null;
      covers: Array<{
        id: string;
        publicUrl: string;
        isDefault: boolean;
      }>;
    };
  }>;
};

interface PlayUrlCacheValue {
  platform: MusicPlatform;
  sourceId: string;
  url: string;
  fetchedAt: number;
  expiresAt: number;
}

interface ImportSongInput {
  sourceId: string;
  title: string;
  artist: string;
  album: string;
  picId: string;
  urlId: string;
  lyricId: string;
  cover: string;
  sourceUrl: string;
}

const PLAY_URL_CACHE_TTL_MS = Math.max(60, Number(process.env.MUSIC_PLAY_URL_CACHE_TTL_SECONDS || 600)) * 1000;
const playUrlCache = new Map<string, PlayUrlCacheValue>();

type AuthenticatedRequest = Request & {
  authUser?: ApiUser;
};

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    const nonce = Math.random().toString(36).slice(2, 10);
    cb(null, `${Date.now()}_${nonce}_${base}${ext}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext) || !ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
      cb(new Error('仅支持 JPG、PNG、WEBP、GIF、BMP 图片上传'));
      return;
    }
    cb(null, true);
  },
});

const uploadBackup = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, backupsDir);
    },
    filename: (_req, _file, cb) => {
      cb(null, `upload_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.zip`);
    },
  }),
  limits: {
    fileSize: 1024 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.zip') {
      cb(new Error('仅支持 .zip 备份文件'));
      return;
    }
    cb(null, true);
  },
});

const searchImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (_req, _file, cb) => {
      const nonce = Math.random().toString(36).slice(2, 10);
      cb(null, `search_temp_${Date.now()}_${nonce}.tmp`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext) || !ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
      cb(new Error('仅支持 JPG、PNG、WEBP、GIF、BMP 图片上传'));
      return;
    }
    cb(null, true);
  },
});

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
  hsts: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      upgradeInsecureRequests: null,
      mediaSrc: ["'self'", "https://music.163.com"],
    },
  },
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (CORS_ORIGIN) {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
}

function serializeTags(value: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [];
}

const WIKI_RELATION_TYPE_LABELS: Record<WikiRelationType, string> = {
  related_person: '相关人物',
  work_relation: '作品关联',
  timeline_relation: '时间线关联',
  custom: '自定义关系',
};

const WIKI_RELATION_SCAN_LIMIT = 800;

function normalizeWikiSlug(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function normalizeWikiRelationType(value: unknown): WikiRelationType | null {
  if (value === 'related_person' || value === 'work_relation' || value === 'timeline_relation' || value === 'custom') {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (normalized === '相关人物') return 'related_person';
  if (normalized === '作品关联') return 'work_relation';
  if (normalized === '时间线关联') return 'timeline_relation';
  if (normalized === '自定义关系') return 'custom';
  return null;
}

function normalizeWikiRelationLabel(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  return normalized.slice(0, 60);
}

function normalizeWikiRelationList(value: unknown, sourceSlug?: string) {
  if (!Array.isArray(value)) {
    return [] as WikiRelationRecord[];
  }

  const normalizedSourceSlug = normalizeWikiSlug(sourceSlug);
  const deduped = new Set<string>();
  const relations: WikiRelationRecord[] = [];

  value.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const record = item as Record<string, unknown>;

    const type = normalizeWikiRelationType(record.type);
    if (!type) return;

    const targetSlug = normalizeWikiSlug(record.targetSlug);
    if (!targetSlug) return;
    if (normalizedSourceSlug && targetSlug === normalizedSourceSlug) return;

    const label = normalizeWikiRelationLabel(record.label);
    const bidirectional = parseBoolean(record.bidirectional, true);

    const dedupeKey = `${type}|${targetSlug}|${(label || '').toLowerCase()}`;
    if (deduped.has(dedupeKey)) return;
    deduped.add(dedupeKey);

    relations.push({
      type,
      targetSlug,
      label,
      bidirectional,
    });
  });

  return relations.slice(0, 80);
}

function serializeRelations(value: unknown, sourceSlug?: string) {
  return normalizeWikiRelationList(value, sourceSlug);
}

function relationTypeLabel(type: WikiRelationType) {
  return WIKI_RELATION_TYPE_LABELS[type] || '自定义关系';
}

function relationIdentityKey(relation: Pick<WikiRelationRecord, 'type' | 'targetSlug' | 'label'>) {
  return `${relation.type}|${relation.targetSlug}|${(relation.label || '').toLowerCase()}`;
}

type WikiRelationPageLite = {
  slug: string;
  title: string;
  category: string;
  status: ContentStatus;
  lastEditorUid: string;
  relations: unknown;
};

type WikiResponseInput = {
  id: string;
  slug: string;
  title: string;
  category: string;
  content: string;
  tags: unknown;
  relations?: unknown;
  eventDate: string | null;
  locationCode?: string | null;
  status: ContentStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  viewCount?: number;
  favoritesCount: number;
  lastEditorUid: string;
  lastEditorName: string;
  createdAt: Date;
  updatedAt: Date;
  location?: { code: string; name: string; fullName: string } | null;
};

type WikiReverseRelationEntry = {
  sourcePage: WikiRelationPageLite;
  relation: WikiRelationRecord;
};

function buildWikiReverseRelationIndex(pages: WikiRelationPageLite[]) {
  const index = new Map<string, WikiReverseRelationEntry[]>();

  pages.forEach((page) => {
    const relations = serializeRelations(page.relations, page.slug);
    relations.forEach((relation) => {
      if (!relation.bidirectional) return;
      const list = index.get(relation.targetSlug) || [];
      list.push({
        sourcePage: page,
        relation,
      });
      index.set(relation.targetSlug, list);
    });
  });

  return index;
}

function buildResolvedWikiRelations(
  centerPage: WikiRelationPageLite,
  pageMap: Map<string, WikiRelationPageLite>,
  reverseIndex: Map<string, WikiReverseRelationEntry[]>,
) {
  const resolved: WikiRelationResolved[] = [];
  const seen = new Set<string>();

  const centerRelations = serializeRelations(centerPage.relations, centerPage.slug);
  centerRelations.forEach((relation) => {
    const target = pageMap.get(relation.targetSlug);
    if (!target) return;

    const key = relationIdentityKey({
      type: relation.type,
      targetSlug: target.slug,
      label: relation.label,
    });
    if (seen.has(key)) return;
    seen.add(key);

    resolved.push({
      type: relation.type,
      typeLabel: relationTypeLabel(relation.type),
      targetSlug: target.slug,
      targetTitle: target.title,
      targetCategory: target.category,
      label: relation.label,
      bidirectional: relation.bidirectional,
      inferred: false,
      sourceSlug: centerPage.slug,
      sourceTitle: centerPage.title,
    });
  });

  const reverseEntries = reverseIndex.get(centerPage.slug) || [];
  reverseEntries.forEach((entry) => {
    if (entry.sourcePage.slug === centerPage.slug) return;

    const key = relationIdentityKey({
      type: entry.relation.type,
      targetSlug: entry.sourcePage.slug,
      label: entry.relation.label,
    });
    if (seen.has(key)) return;
    seen.add(key);

    resolved.push({
      type: entry.relation.type,
      typeLabel: relationTypeLabel(entry.relation.type),
      targetSlug: entry.sourcePage.slug,
      targetTitle: entry.sourcePage.title,
      targetCategory: entry.sourcePage.category,
      label: entry.relation.label,
      bidirectional: entry.relation.bidirectional,
      inferred: true,
      sourceSlug: entry.sourcePage.slug,
      sourceTitle: entry.sourcePage.title,
    });
  });

  return resolved.sort((a, b) => {
    const typeCompare = a.typeLabel.localeCompare(b.typeLabel, 'zh-CN');
    if (typeCompare !== 0) return typeCompare;
    return a.targetTitle.localeCompare(b.targetTitle, 'zh-CN');
  });
}

function buildWikiRelationGraph(
  centerPage: WikiRelationPageLite,
  pageMap: Map<string, WikiRelationPageLite>,
  reverseIndex: Map<string, WikiReverseRelationEntry[]>,
) {
  const edges: WikiRelationGraphEdge[] = [];
  const edgeSet = new Set<string>();

  const addEdge = (sourceSlug: string, targetSlug: string, relation: WikiRelationRecord, inferred: boolean) => {
    if (sourceSlug === targetSlug) return;
    if (!pageMap.has(sourceSlug) || !pageMap.has(targetSlug)) return;

    const edgeKey = `${sourceSlug}|${targetSlug}|${relation.type}|${(relation.label || '').toLowerCase()}`;
    if (edgeSet.has(edgeKey)) return;
    edgeSet.add(edgeKey);

    edges.push({
      sourceSlug,
      targetSlug,
      type: relation.type,
      typeLabel: relationTypeLabel(relation.type),
      label: relation.label || null,
      inferred,
    });
  };

  const centerRelations = serializeRelations(centerPage.relations, centerPage.slug);
  centerRelations.forEach((relation) => addEdge(centerPage.slug, relation.targetSlug, relation, false));

  const centerReverse = reverseIndex.get(centerPage.slug) || [];
  centerReverse.forEach((entry) => addEdge(entry.sourcePage.slug, centerPage.slug, entry.relation, true));

  const firstLayer = new Set<string>();
  edges.forEach((edge) => {
    if (edge.sourceSlug === centerPage.slug) {
      firstLayer.add(edge.targetSlug);
    }
    if (edge.targetSlug === centerPage.slug) {
      firstLayer.add(edge.sourceSlug);
    }
  });

  firstLayer.forEach((slug) => {
    const page = pageMap.get(slug);
    if (!page) return;

    const relations = serializeRelations(page.relations, page.slug);
    relations.forEach((relation) => addEdge(page.slug, relation.targetSlug, relation, false));

    const reverseEntries = reverseIndex.get(page.slug) || [];
    reverseEntries.forEach((entry) => addEdge(entry.sourcePage.slug, page.slug, entry.relation, true));
  });

  const adjacency = new Map<string, Set<string>>();
  edges.forEach((edge) => {
    const sourceNeighbors = adjacency.get(edge.sourceSlug) || new Set<string>();
    sourceNeighbors.add(edge.targetSlug);
    adjacency.set(edge.sourceSlug, sourceNeighbors);

    const targetNeighbors = adjacency.get(edge.targetSlug) || new Set<string>();
    targetNeighbors.add(edge.sourceSlug);
    adjacency.set(edge.targetSlug, targetNeighbors);
  });

  const depthMap = new Map<string, number>();
  depthMap.set(centerPage.slug, 0);
  const queue: string[] = [centerPage.slug];

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    const currentDepth = depthMap.get(current);
    if (currentDepth === undefined || currentDepth >= 2) continue;

    const neighbors = adjacency.get(current);
    if (!neighbors) continue;

    neighbors.forEach((nextSlug) => {
      if (depthMap.has(nextSlug)) return;
      const nextDepth = currentDepth + 1;
      if (nextDepth > 2) return;
      depthMap.set(nextSlug, nextDepth);
      queue.push(nextSlug);
    });
  }

  const nodes: WikiRelationGraphNode[] = [];
  depthMap.forEach((depth, slug) => {
    const page = pageMap.get(slug);
    if (!page) return;

    nodes.push({
      slug,
      title: page.title,
      category: page.category,
      depth: depth as 0 | 1 | 2,
      isCenter: slug === centerPage.slug,
    });
  });

  const nodeSet = new Set(nodes.map((node) => node.slug));
  const filteredEdges = edges.filter((edge) => nodeSet.has(edge.sourceSlug) && nodeSet.has(edge.targetSlug));

  nodes.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    if (a.isCenter !== b.isCenter) return a.isCenter ? -1 : 1;
    return a.title.localeCompare(b.title, 'zh-CN');
  });

  return {
    nodes,
    edges: filteredEdges,
  };
}

type WikiRelationBundle = {
  centerPage: WikiRelationPageLite;
  relations: WikiRelationResolved[];
  graph: {
    nodes: WikiRelationGraphNode[];
    edges: WikiRelationGraphEdge[];
  };
};

async function findWikiRelationCenterPage(slug: string, authUser?: ApiUser) {
  const centerPage = await prisma.wikiPage.findUnique({
    where: { slug },
    select: {
      slug: true,
      title: true,
      category: true,
      status: true,
      lastEditorUid: true,
      relations: true,
    },
  });

  if (!centerPage || !canViewWikiPage(centerPage, authUser)) {
    return null;
  }

  return centerPage as WikiRelationPageLite;
}

async function buildWikiRelationBundle(centerPage: WikiRelationPageLite, authUser?: ApiUser): Promise<WikiRelationBundle> {
  const visibilityWhere = buildWikiVisibilityWhere(authUser);

  const relationPages = await prisma.wikiPage.findMany({
    where: visibilityWhere,
    select: {
      slug: true,
      title: true,
      category: true,
      status: true,
      lastEditorUid: true,
      relations: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: WIKI_RELATION_SCAN_LIMIT,
  });

  const pageMap = new Map<string, WikiRelationPageLite>();
  relationPages.forEach((page) => {
    pageMap.set(page.slug, page as WikiRelationPageLite);
  });

  if (!pageMap.has(centerPage.slug)) {
    pageMap.set(centerPage.slug, centerPage);
  }

  const directTargetSlugs = [...new Set(serializeRelations(centerPage.relations, centerPage.slug).map((item) => item.targetSlug))];
  const missingDirectTargets = directTargetSlugs.filter((slug) => !pageMap.has(slug));

  if (missingDirectTargets.length) {
    const extraPages = await prisma.wikiPage.findMany({
      where: {
        ...visibilityWhere,
        slug: { in: missingDirectTargets },
      },
      select: {
        slug: true,
        title: true,
        category: true,
        status: true,
        lastEditorUid: true,
        relations: true,
      },
    });

    extraPages.forEach((page) => {
      pageMap.set(page.slug, page as WikiRelationPageLite);
    });
  }

  const allPages = [...pageMap.values()];
  const reverseIndex = buildWikiReverseRelationIndex(allPages);
  const relations = buildResolvedWikiRelations(centerPage, pageMap, reverseIndex);
  const graph = buildWikiRelationGraph(centerPage, pageMap, reverseIndex);

  return {
    centerPage,
    relations,
    graph,
  };
}

function parseDate(date: string | Date | null | undefined) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseInteger(value: unknown, fallback: number, options?: { min?: number; max?: number }) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  let normalized = Math.floor(parsed);
  if (typeof options?.min === 'number') {
    normalized = Math.max(options.min, normalized);
  }
  if (typeof options?.max === 'number') {
    normalized = Math.min(options.max, normalized);
  }
  return normalized;
}

function parseBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true' || lowered === '1') return true;
    if (lowered === 'false' || lowered === '0') return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return fallback;
}

function extractBase64Payload(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('data:')) {
    const commaIndex = trimmed.indexOf(',');
    if (commaIndex < 0) {
      return null;
    }
    return trimmed.slice(commaIndex + 1);
  }

  return trimmed;
}

function parseMinSimilarityScore(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.max(0, Math.min(1, parsed));
}

function toEmbeddingPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const galleryId = typeof record.galleryId === 'string' ? record.galleryId : '';
  const galleryImageId = typeof record.galleryImageId === 'string' ? record.galleryImageId : '';
  if (!galleryId || !galleryImageId) {
    return null;
  }

  return {
    galleryId,
    galleryImageId,
    imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : '',
    imageName: typeof record.imageName === 'string' ? record.imageName : '',
  };
}

function normalizeTagList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 30);
}

async function normalizeWikiRelationListForWrite(value: unknown, sourceSlug?: string) {
  const normalizedSourceSlug = normalizeWikiSlug(sourceSlug);
  const relations = normalizeWikiRelationList(value, normalizedSourceSlug);
  if (!relations.length) {
    return [] as WikiRelationRecord[];
  }

  const uniqueTargets = [...new Set(relations.map((item) => item.targetSlug))];
  const existingTargets = await prisma.wikiPage.findMany({
    where: {
      slug: {
        in: uniqueTargets,
      },
    },
    select: {
      slug: true,
    },
  });
  const targetSet = new Set(existingTargets.map((item) => item.slug));
  return relations.filter((item) => targetSet.has(item.targetSlug));
}

function parseAssetIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const deduped = new Set<string>();
  value.forEach((item) => {
    if (typeof item !== 'string') return;
    const normalized = item.trim();
    if (!normalized) return;
    deduped.add(normalized);
  });
  return [...deduped];
}

const EDIT_LOCK_COLLECTION_ALLOWLIST = new Set([
  'songs',
  'albums',
  'galleries',
  'activities',
  'wiki',
  'posts',
]);

function normalizeEditLockCollection(value: unknown) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  if (EDIT_LOCK_COLLECTION_ALLOWLIST.has(normalized)) return normalized;
  return '';
}

function normalizeEditLockRecordId(value: unknown) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  if (!normalized) return '';
  if (normalized.length > 191) {
    return normalized.slice(0, 191);
  }
  return normalized;
}

function createUploadSessionExpiresAt() {
  return new Date(Date.now() + UPLOAD_SESSION_TTL_MINUTES * 60 * 1000);
}

function isUploadSessionExpired(expiresAt: Date) {
  return expiresAt.getTime() <= Date.now();
}

function buildUploadPublicUrl(fileName: string) {
  return `/uploads/${fileName}`;
}

function resolveUploadPathByStorageKey(storageKey: string) {
  const normalized = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
  const base = path.resolve(uploadsDir);
  const target = path.resolve(base, normalized);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    return null;
  }
  return target;
}

function extractStorageKeyFromUploadUrl(url: string) {
  if (!url.startsWith('/uploads/')) {
    return null;
  }
  const raw = url.slice('/uploads/'.length);
  if (!raw) {
    return null;
  }
  return decodeURIComponent(raw);
}

async function safeDeleteUploadFileByStorageKey(storageKey: string) {
  const filePath = resolveUploadPathByStorageKey(storageKey);
  if (!filePath) {
    return;
  }
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Delete upload file error:', error);
    }
  }
}

async function safeDeleteUploadFileByUrl(url: string) {
  const storageKey = extractStorageKeyFromUploadUrl(url);
  if (!storageKey) {
    return;
  }
  await safeDeleteUploadFileByStorageKey(storageKey);
}

async function validateUploadedImage(file: Express.Multer.File) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    throw new Error('不支持的图片扩展名');
  }

  const buffer = await fs.promises.readFile(file.path);
  const detectedMimeType = detectImageMimeType(buffer);
  if (!detectedMimeType || !ALLOWED_IMAGE_MIME_TYPES.has(detectedMimeType)) {
    throw new Error('文件内容与图片格式不匹配');
  }

  const expectedMimeByExt: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
  };
  const expectedMimeType = expectedMimeByExt[ext];
  if (!expectedMimeType || detectedMimeType !== expectedMimeType) {
    throw new Error('图片扩展名与文件内容不一致');
  }

  return {
    mimeType: detectedMimeType,
  };
}

function detectImageMimeType(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    buffer.length >= 6
    && buffer[0] === 0x47
    && buffer[1] === 0x49
    && buffer[2] === 0x46
    && buffer[3] === 0x38
    && (buffer[4] === 0x37 || buffer[4] === 0x39)
    && buffer[5] === 0x61
  ) {
    return 'image/gif';
  }

  if (
    buffer.length >= 12
    && buffer[0] === 0x52
    && buffer[1] === 0x49
    && buffer[2] === 0x46
    && buffer[3] === 0x46
    && buffer[8] === 0x57
    && buffer[9] === 0x45
    && buffer[10] === 0x42
    && buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return 'image/bmp';
  }

  return null;
}

function toUploadSessionResponse(session: {
  id: string;
  ownerUid: string;
  status: string;
  maxFiles: number;
  uploadedFiles: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: session.id,
    ownerUid: session.ownerUid,
    status: session.status,
    maxFiles: session.maxFiles,
    uploadedFiles: session.uploadedFiles,
    expiresAt: session.expiresAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

function toMediaAssetResponse(asset: {
  id: string;
  ownerUid: string;
  sessionId: string | null;
  storageKey: string;
  publicUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: asset.id,
    ownerUid: asset.ownerUid,
    sessionId: asset.sessionId,
    storageKey: asset.storageKey,
    url: asset.publicUrl,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    status: asset.status,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

function clearExpiredPlayUrlCache() {
  const now = Date.now();
  for (const [cacheKey, value] of playUrlCache.entries()) {
    if (value.expiresAt <= now) {
      playUrlCache.delete(cacheKey);
    }
  }
}

function getCachedPlayUrl(cacheKey: string) {
  const cached = playUrlCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    playUrlCache.delete(cacheKey);
    return null;
  }
  return cached;
}

function setCachedPlayUrl(cacheKey: string, value: Omit<PlayUrlCacheValue, 'fetchedAt' | 'expiresAt'>) {
  const now = Date.now();
  const record: PlayUrlCacheValue = {
    ...value,
    fetchedAt: now,
    expiresAt: now + PLAY_URL_CACHE_TTL_MS,
  };
  playUrlCache.set(cacheKey, record);
  return record;
}

function normalizeTrackDiscPayload(rawTracks: unknown) {
  if (!Array.isArray(rawTracks)) {
    return [] as Array<{
      disc: number;
      name: string;
      songs: Array<{ songDocId: string; trackOrder: number }>;
    }>;
  }

  const normalized = rawTracks
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const disc = parseInteger(record.disc, index + 1, { min: 1, max: 20 });
      const nameRaw = typeof record.name === 'string' ? record.name.trim() : '';
      const name = nameRaw || `Disc ${disc}`;
      const songsRaw = Array.isArray(record.songs) ? record.songs : [];

      const songs = songsRaw
        .map((songItem, songIndex) => {
          if (!songItem || typeof songItem !== 'object') {
            return null;
          }
          const songRecord = songItem as Record<string, unknown>;
          const songDocId = typeof songRecord.songDocId === 'string' ? songRecord.songDocId.trim() : '';
          if (!songDocId) {
            return null;
          }
          const trackOrder = parseInteger(songRecord.trackOrder, songIndex, { min: 0, max: 5000 });
          return {
            songDocId,
            trackOrder,
          };
        })
        .filter((entry): entry is { songDocId: string; trackOrder: number } => Boolean(entry));

      return {
        disc,
        name,
        songs,
      };
    })
    .filter((entry): entry is { disc: number; name: string; songs: Array<{ songDocId: string; trackOrder: number }> } => Boolean(entry));

  normalized.sort((a, b) => a.disc - b.disc);
  return normalized;
}

function resolveSongDisplayAlbum(song: {
  displayAlbumMode: DisplayAlbumMode;
  manualAlbumName: string | null;
  albumRelations: Array<{
    isDisplay: boolean;
    album: {
      docId: string;
      title: string;
    };
  }>;
}) {
  if (song.displayAlbumMode === 'none') {
    return {
      mode: 'none' as const,
      albumDocId: null,
      title: '',
    };
  }

  if (song.displayAlbumMode === 'manual') {
    return {
      mode: 'manual' as const,
      albumDocId: null,
      title: song.manualAlbumName || '',
    };
  }

  const displayRelation = song.albumRelations.find((item) => item.isDisplay) || song.albumRelations[0] || null;
  if (!displayRelation) {
    return {
      mode: 'linked' as const,
      albumDocId: null,
      title: '',
    };
  }

  return {
    mode: 'linked' as const,
    albumDocId: displayRelation.album.docId,
    title: displayRelation.album.title,
  };
}

function resolveSongCoverUrl(song: Pick<MusicTrackWithRelations, 'cover' | 'defaultCoverSource' | 'covers' | 'albumRelations'>) {
  const source = (song.defaultCoverSource || '').trim();
  if (!source || source === 'old_cover') {
    return song.cover || '';
  }

  if (source.startsWith('song_cover:')) {
    const coverId = source.slice('song_cover:'.length);
    const matched = song.covers.find((item) => item.id === coverId);
    return matched?.publicUrl || song.cover || '';
  }

  if (source.startsWith('album_cover:')) {
    const coverId = source.slice('album_cover:'.length);
    for (const relation of song.albumRelations) {
      const matched = relation.album.covers.find((item) => item.id === coverId);
      if (matched?.publicUrl) {
        return matched.publicUrl;
      }
    }
    return song.cover || '';
  }

  return song.cover || '';
}

function toSongResponse(song: MusicTrackWithRelations, options?: { favoritedByMe?: boolean }) {
  const displayAlbum = resolveSongDisplayAlbum(song);
  const coverUrl = resolveSongCoverUrl(song);

  return {
    docId: song.docId,
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    cover: coverUrl,
    audioUrl: song.audioUrl,
    lyric: song.lyric,
    primaryPlatform: song.primaryPlatform,
    enabledPlatform: song.enabledPlatform,
    platformIds: {
      neteaseId: song.neteaseId,
      tencentId: song.tencentId,
      kugouId: song.kugouId,
      baiduId: song.baiduId,
      kuwoId: song.kuwoId,
    },
    displayAlbumMode: song.displayAlbumMode,
    displayAlbum,
    manualAlbumName: song.manualAlbumName,
    defaultCoverSource: song.defaultCoverSource,
    covers: song.covers.map((cover) => ({
      id: cover.id,
      url: cover.publicUrl,
      isDefault: cover.isDefault,
      sortOrder: cover.sortOrder,
    })),
    linkedAlbums: song.albumRelations.map((relation) => ({
      albumDocId: relation.albumDocId,
      albumId: relation.album.docId,
      title: relation.album.title,
      artist: relation.album.artist,
      discNumber: relation.discNumber,
      trackOrder: relation.trackOrder,
      isDisplay: relation.isDisplay,
    })),
    favoritedByMe: Boolean(options?.favoritedByMe),
    createdAt: song.createdAt.toISOString(),
    updatedAt: song.updatedAt.toISOString(),
  };
}

function toAlbumResponse(album: {
  docId: string;
  id: string;
  resourceType: MusicCollectionType;
  platform: MusicPlatform;
  sourceId: string;
  title: string;
  artist: string;
  cover: string;
  description: string | null;
  platformUrl: string | null;
  tracks: Prisma.JsonValue;
  defaultCoverSource: string | null;
  createdAt: Date;
  updatedAt: Date;
  covers?: Array<{
    id: string;
    publicUrl: string;
    isDefault: boolean;
    sortOrder: number;
  }>;
  songRelations?: Array<{
    songDocId: string;
    discNumber: number;
    trackOrder: number;
    isDisplay: boolean;
    song?: {
      docId: string;
      id: string;
      title: string;
      artist: string;
      cover: string;
    };
  }>;
}) {
  return {
    docId: album.docId,
    id: album.id,
    resourceType: album.resourceType,
    platform: album.platform,
    sourceId: album.sourceId,
    title: album.title,
    artist: album.artist,
    cover: album.cover,
    description: album.description,
    platformUrl: album.platformUrl,
    tracks: album.tracks || [],
    defaultCoverSource: album.defaultCoverSource,
    covers: (album.covers || []).map((cover) => ({
      id: cover.id,
      url: cover.publicUrl,
      isDefault: cover.isDefault,
      sortOrder: cover.sortOrder,
    })),
    songs: (album.songRelations || []).map((relation) => ({
      songDocId: relation.songDocId,
      discNumber: relation.discNumber,
      trackOrder: relation.trackOrder,
      isDisplay: relation.isDisplay,
      song: relation.song
        ? {
            docId: relation.song.docId,
            id: relation.song.id,
            title: relation.song.title,
            artist: relation.song.artist,
            cover: relation.song.cover,
          }
        : null,
    })),
    createdAt: album.createdAt.toISOString(),
    updatedAt: album.updatedAt.toISOString(),
  };
}

async function fetchSongWithRelationsByDocId(songDocId: string) {
  const song = await prismaAny.musicTrack.findUnique({
    where: { docId: songDocId },
    include: {
      covers: {
        orderBy: { sortOrder: 'asc' },
      },
      albumRelations: {
        include: {
          album: {
            include: {
              covers: {
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
        orderBy: [{ discNumber: 'asc' }, { trackOrder: 'asc' }],
      },
    },
  });
  return song as unknown as MusicTrackWithRelations | null;
}

async function resolveMusicPlayUrl(song: {
  docId: string;
  id: string;
  audioUrl: string;
  primaryPlatform: MusicPlatform;
  enabledPlatform: MusicPlatform | null;
  neteaseId: string | null;
  tencentId: string | null;
  kugouId: string | null;
  baiduId: string | null;
  kuwoId: string | null;
}) {
  clearExpiredPlayUrlCache();

  const candidates = buildPlaybackPlatformCandidates(song);
  const errors: Array<{ platform: MusicPlatform; reason: string }> = [];

  for (const platform of candidates) {
    const sourceId = getPlatformSourceId(song, platform);
    if (!sourceId) {
      continue;
    }

    const cacheKey = `${song.docId}:${platform}:${sourceId}`;
    const cached = getCachedPlayUrl(cacheKey);
    if (cached?.url) {
      return {
        platform: cached.platform,
        sourceId: cached.sourceId,
        playUrl: cached.url,
        cached: true,
        cacheExpiresAt: new Date(cached.expiresAt).toISOString(),
      };
    }

    try {
      const resolvedUrl = await resolveMetingAudioUrl(platform as ParsedMusicPlatform, sourceId);
      if (!resolvedUrl) {
        errors.push({ platform, reason: 'empty_url' });
        continue;
      }

      const cachedRecord = setCachedPlayUrl(cacheKey, {
        platform,
        sourceId,
        url: resolvedUrl,
      });

      return {
        platform,
        sourceId,
        playUrl: resolvedUrl,
        cached: false,
        cacheExpiresAt: new Date(cachedRecord.expiresAt).toISOString(),
      };
    } catch (error) {
      errors.push({ platform, reason: error instanceof Error ? error.message : 'resolve_failed' });
    }
  }

  const fallbackUrl = song.audioUrl?.trim() || '';
  if (fallbackUrl) {
    return {
      platform: song.primaryPlatform,
      sourceId: song.id,
      playUrl: fallbackUrl,
      cached: false,
      cacheExpiresAt: null,
      fallback: true,
      errors,
    };
  }

  return {
    platform: song.primaryPlatform,
    sourceId: song.id,
    playUrl: '',
    cached: false,
    cacheExpiresAt: null,
    errors,
  };
}

function normalizeMusicImportTracks(input: unknown) {
  if (!Array.isArray(input)) {
    return [] as ImportSongInput[];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const sourceId = typeof record.sourceId === 'string' ? record.sourceId.trim() : '';
      if (!sourceId) {
        return null;
      }

      return {
        sourceId,
        title: typeof record.title === 'string' ? record.title.trim() : '',
        artist: typeof record.artist === 'string' ? record.artist.trim() : '',
        album: typeof record.album === 'string' ? record.album.trim() : '',
        picId: typeof record.picId === 'string' ? record.picId.trim() : sourceId,
        urlId: typeof record.urlId === 'string' ? record.urlId.trim() : sourceId,
        lyricId: typeof record.lyricId === 'string' ? record.lyricId.trim() : sourceId,
        cover: typeof record.cover === 'string' ? record.cover.trim() : '',
        sourceUrl: typeof record.sourceUrl === 'string' ? record.sourceUrl.trim() : '',
      };
    })
    .filter((item): item is ImportSongInput => Boolean(item));
}

function buildAlbumTracksPayload(relations: Array<{
  songDocId: string;
  trackOrder: number;
  discNumber: number;
  song: {
    docId: string;
    title: string;
    artist: string;
    cover: string;
    id: string;
  };
}>) {
  const byDisc = new Map<number, Array<{ songDocId: string; trackOrder: number; song: { docId: string; title: string; artist: string; cover: string; id: string } }>>();

  relations.forEach((relation) => {
    const disc = relation.discNumber > 0 ? relation.discNumber : 1;
    if (!byDisc.has(disc)) {
      byDisc.set(disc, []);
    }
    byDisc.get(disc)!.push({
      songDocId: relation.songDocId,
      trackOrder: relation.trackOrder,
      song: relation.song,
    });
  });

  return [...byDisc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([disc, songs]) => ({
      disc,
      name: `Disc ${disc}`,
      songs: songs
        .sort((a, b) => a.trackOrder - b.trackOrder)
        .map((entry) => ({
          songDocId: entry.songDocId,
          trackOrder: entry.trackOrder,
          song: entry.song,
        })),
    }));
}

async function applyAlbumTracksToRelations(albumDocId: string, tracks: ReturnType<typeof normalizeTrackDiscPayload>) {
  await prismaAny.songAlbumRelation.deleteMany({ where: { albumDocId } });

  const createRows: Array<{
    songDocId: string;
    albumDocId: string;
    discNumber: number;
    trackOrder: number;
    isDisplay: boolean;
  }> = [];

  tracks.forEach((discEntry) => {
    discEntry.songs.forEach((songEntry) => {
      createRows.push({
        songDocId: songEntry.songDocId,
        albumDocId,
        discNumber: discEntry.disc,
        trackOrder: songEntry.trackOrder,
        isDisplay: false,
      });
    });
  });

  if (!createRows.length) {
    return;
  }

  await prismaAny.songAlbumRelation.createMany({
    data: createRows,
    skipDuplicates: true,
  });
}

async function addSongCoverFromAsset(songDocId: string, assetId: string, markDefault = false) {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      storageKey: true,
      publicUrl: true,
      status: true,
    },
  });

  if (!asset || asset.status !== 'ready') {
    throw new Error('媒体资源不存在或不可用');
  }

  const currentCount = await prismaAny.songCover.count({ where: { songDocId } });

  const cover = await prismaAny.songCover.create({
    data: {
      songDocId,
      assetId: asset.id,
      storageKey: asset.storageKey,
      publicUrl: asset.publicUrl,
      sortOrder: currentCount,
      isDefault: markDefault,
    },
  });

  if (markDefault) {
    await prismaAny.songCover.updateMany({
      where: {
        songDocId,
        id: { not: cover.id },
      },
      data: {
        isDefault: false,
      },
    });
    await prismaAny.musicTrack.update({
      where: { docId: songDocId },
      data: {
        defaultCoverSource: `song_cover:${cover.id}`,
      },
    });
  }

  return cover;
}

async function addAlbumCoverFromAsset(albumDocId: string, assetId: string, markDefault = false) {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      storageKey: true,
      publicUrl: true,
      status: true,
    },
  });

  if (!asset || asset.status !== 'ready') {
    throw new Error('媒体资源不存在或不可用');
  }

  const currentCount = await prismaAny.albumCover.count({ where: { albumDocId } });

  const cover = await prismaAny.albumCover.create({
    data: {
      albumDocId,
      assetId: asset.id,
      storageKey: asset.storageKey,
      publicUrl: asset.publicUrl,
      sortOrder: currentCount,
      isDefault: markDefault,
    },
  });

  if (markDefault) {
    await prismaAny.albumCover.updateMany({
      where: {
        albumDocId,
        id: { not: cover.id },
      },
      data: {
        isDefault: false,
      },
    });
    await prismaAny.album.update({
      where: { docId: albumDocId },
      data: {
        defaultCoverSource: `album_cover:${cover.id}`,
      },
    });
  }

  return cover;
}

async function createOrUpdateImportedSong(params: {
  platform: MusicPlatform;
  track: ImportSongInput;
  userUid: string;
  albumNameFallback?: string;
}) {
  const { platform, track, userUid, albumNameFallback } = params;
  const sourceField = getPlatformSourceField(platform);
  const platformId = track.sourceId;

  const existingByPlatformId = await prismaAny.musicTrack.findFirst({
    where: {
      OR: [
        { [sourceField]: platformId },
        { id: track.sourceId },
      ] as Prisma.MusicTrackWhereInput[],
    },
  });

  if (existingByPlatformId) {
    const fallbackTitle = `未命名歌曲 ${track.sourceId}`;
    const title = track.title || fallbackTitle;
    const artist = track.artist || '未知歌手';
    const album = track.album || albumNameFallback || '未知专辑';

    const resolvedCover = (await resolveMetingCoverUrl(platform as ParsedMusicPlatform, track.picId, track.cover)) || track.cover;
    const resolvedAudioUrl = (await resolveMetingAudioUrl(platform as ParsedMusicPlatform, track.urlId)) || '';
    const resolvedLyric = (await resolveMetingLyric(platform as ParsedMusicPlatform, track.lyricId)) || '';

    const song = await prismaAny.musicTrack.update({
      where: { docId: existingByPlatformId.docId },
      data: {
        id: existingByPlatformId.id || track.sourceId,
        title,
        artist,
        album,
        cover: resolvedCover || '',
        audioUrl: resolvedAudioUrl || '',
        lyric: resolvedLyric || null,
        primaryPlatform: platform,
        enabledPlatform: platform,
        [sourceField]: platformId,
      },
    });
    return {
      song,
      created: false,
      linked: false,
    };
  }

  const fallbackTitle = `未命名歌曲 ${track.sourceId}`;
  const title = track.title || fallbackTitle;
  const artist = track.artist || '未知歌手';
  const album = track.album || albumNameFallback || '未知专辑';

  const existingByTitleArtist = await prismaAny.musicTrack.findFirst({
    where: {
      AND: [
        { title: { equals: title } },
        { artist: { equals: artist } },
        {
          OR: [
            { neteaseId: { not: null } },
            { tencentId: { not: null } },
            { kugouId: { not: null } },
            { baiduId: { not: null } },
            { kuwoId: { not: null } },
          ],
        },
      ],
    } as Prisma.MusicTrackWhereInput,
  });

  const resolvedCover = (await resolveMetingCoverUrl(platform as ParsedMusicPlatform, track.picId, track.cover)) || track.cover;
  const resolvedAudioUrl = (await resolveMetingAudioUrl(platform as ParsedMusicPlatform, track.urlId)) || '';
  const resolvedLyric = (await resolveMetingLyric(platform as ParsedMusicPlatform, track.lyricId)) || '';

  if (existingByTitleArtist) {
    const conflictPlatformId = (existingByTitleArtist as Record<string, string | null>)[sourceField];
    if (conflictPlatformId) {
      const song = await prismaAny.musicTrack.create({
        data: {
          id: track.sourceId,
          title,
          artist,
          album,
          cover: resolvedCover || '',
          audioUrl: resolvedAudioUrl || '',
          lyric: resolvedLyric || null,
          primaryPlatform: platform,
          enabledPlatform: platform,
          [sourceField]: platformId,
          addedBy: userUid,
        },
      });
      return {
        song,
        created: true,
        linked: false,
      };
    }

    const updatedSong = await prismaAny.musicTrack.update({
      where: { docId: existingByTitleArtist.docId },
      data: {
        id: existingByTitleArtist.id || track.sourceId,
        title,
        artist,
        album,
        cover: resolvedCover || '',
        audioUrl: resolvedAudioUrl || '',
        lyric: resolvedLyric || null,
        primaryPlatform: platform,
        enabledPlatform: platform,
        [sourceField]: platformId,
      },
    });
    return {
      song: updatedSong,
      created: false,
      linked: true,
      linkedFrom: {
        docId: existingByTitleArtist.docId,
        title: existingByTitleArtist.title,
        artist: existingByTitleArtist.artist,
      },
    };
  }

  const song = await prismaAny.musicTrack.create({
    data: {
      id: track.sourceId,
      title,
      artist,
      album,
      cover: resolvedCover || '',
      audioUrl: resolvedAudioUrl || '',
      lyric: resolvedLyric || null,
      primaryPlatform: platform,
      enabledPlatform: platform,
      [sourceField]: platformId,
      addedBy: userUid,
    },
  });

  return {
    song,
    created: true,
    linked: false,
  };
}

async function fetchSongsWithRelations(where?: Record<string, unknown>) {
  const songs = await prismaAny.musicTrack.findMany({
    where,
    include: {
      covers: {
        orderBy: { sortOrder: 'asc' },
      },
      albumRelations: {
        include: {
          album: {
            include: {
              covers: {
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
        orderBy: [{ discNumber: 'asc' }, { trackOrder: 'asc' }],
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return songs as MusicTrackWithRelations[];
}

function ensureDisplayRelation(relations: any[]) {
  const hasDisplay = relations.some((relation) => relation.isDisplay);
  if (hasDisplay || !relations.length) {
    return relations;
  }
  return relations.map((relation, index) => ({
    ...relation,
    isDisplay: index === 0,
  }));
}

function createWechatPlaceholderEmail(openId: string) {
  const safe = openId.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64);
  const fallback = safe || `wx_${Date.now().toString(36)}`;
  return `${fallback}@wechat.local`;
}

async function exchangeWechatLoginCode(rawCode: string) {
  const code = rawCode.trim();
  if (!code) {
    throw new Error('缺少 code');
  }

  if (WECHAT_LOGIN_MOCK) {
    const mockPayload = code.replace(/^mock:/, '');
    const [openIdPart, unionIdPart] = mockPayload.split(':');
    const openId = (openIdPart || `mock_openid_${Date.now().toString(36)}`).slice(0, 128);
    const unionId = unionIdPart ? unionIdPart.slice(0, 128) : null;
    return { openId, unionId };
  }

  if (!WECHAT_MP_APPID || !WECHAT_MP_APP_SECRET) {
    throw new Error('服务器未配置微信登录参数');
  }

  const response = await axios.get<WechatCodeSessionResponse>('https://api.weixin.qq.com/sns/jscode2session', {
    params: {
      appid: WECHAT_MP_APPID,
      secret: WECHAT_MP_APP_SECRET,
      js_code: code,
      grant_type: 'authorization_code',
    },
    timeout: 10_000,
  });

  const data = response.data;
  if (typeof data?.errcode === 'number' && data.errcode !== 0) {
    throw new Error(`微信登录失败：${data.errmsg || `errcode=${data.errcode}`}`);
  }

  if (!data?.openid) {
    throw new Error('微信登录失败：未获取到 openid');
  }

  return {
    openId: data.openid,
    unionId: data.unionid || null,
  };
}

async function buildUniqueWechatEmail(openId: string) {
  const base = createWechatPlaceholderEmail(openId);
  const [name, domain] = base.split('@');
  let candidate = base;

  for (let i = 0; i < 8; i += 1) {
    const existing = await prisma.user.findUnique({
      where: { email: candidate },
      select: { uid: true },
    });
    if (!existing) {
      return candidate;
    }
    candidate = `${name}_${i + 1}@${domain || 'wechat.local'}`;
  }

  return `${name}_${Date.now().toString(36)}@${domain || 'wechat.local'}`;
}

function parsePostSort(value: unknown): PostSortType {
  if (value === 'hot' || value === 'recommended') {
    return value;
  }
  return 'latest';
}

function normalizeOptionalDocId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 64);
}

function calculatePostHotScore(post: {
  likesCount: number;
  commentsCount: number;
  viewCount?: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  const now = Date.now();
  const anchor = post.updatedAt && post.updatedAt > post.createdAt ? post.updatedAt : post.createdAt;
  const hoursSince = Math.max(0, (now - anchor.getTime()) / (1000 * 60 * 60));
  const timeDecay = 6 / (1 + (hoursSince / 24));
  const score = post.likesCount * 3 + post.commentsCount * 2 + (post.viewCount ?? 0) * 0.2 + timeDecay;
  return Number(score.toFixed(3));
}

function toNotificationResponse(notification: {
  id: string;
  userUid: string;
  type: NotificationType;
  payload: unknown;
  isRead: boolean;
  createdAt: Date;
}) {
  return {
    id: notification.id,
    userUid: notification.userUid,
    type: notification.type,
    payload: notification.payload,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
  };
}

async function createNotification(userUid: string, type: NotificationType, payload: Record<string, unknown>) {
  try {
    await prisma.notification.create({
      data: {
        userUid,
        type,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error('Create notification error:', error);
  }
}

async function recordBrowsingHistory(userUid: string, targetType: BrowsingTargetType, targetId: string) {
  const dedupeAfter = new Date(Date.now() - 30 * 60 * 1000);
  try {
    const existing = await prisma.browsingHistory.findFirst({
      where: {
        userUid,
        targetType,
        targetId,
        createdAt: {
          gte: dedupeAfter,
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      await prisma.browsingHistory.create({
        data: {
          userUid,
          targetType,
          targetId,
        },
      });
    }
  } catch (error) {
    console.error('Record browsing history error:', error);
  }
}

async function increaseSearchKeywordCount(rawKeyword: string) {
  const keyword = normalizeKeyword(rawKeyword);
  if (!keyword) return;

  try {
    await prisma.searchKeyword.upsert({
      where: { keyword },
      update: {
        count: {
          increment: 1,
        },
      },
      create: {
        keyword,
        count: 1,
      },
    });
  } catch (error) {
    console.error('Increase search keyword count error:', error);
  }
}

async function refreshPostHotScore(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      likesCount: true,
      commentsCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!post) return 0;

  const viewCountRow = await prisma.$queryRaw<Array<{ viewCount: number }>>`
    SELECT "viewCount" AS "viewCount"
    FROM "Post"
    WHERE "id" = ${postId}
    LIMIT 1
  `;
  const viewCount = Number(viewCountRow[0]?.viewCount || 0);

  const hotScore = calculatePostHotScore({
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    viewCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  });

  await prisma.$executeRaw`UPDATE "Post" SET "hotScore" = ${hotScore} WHERE "id" = ${postId}`;
  return hotScore;
}

function userToApiUser(user: {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  wechatOpenId?: string | null;
  role: PrismaUserRole;
  status: UserStatus;
  banReason: string | null;
  bannedAt: Date | null;
  level: number;
  bio: string;
}): ApiUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    wechatBound: Boolean(user.wechatOpenId),
    role: user.role,
    status: user.status,
    banReason: user.banReason,
    bannedAt: user.bannedAt ? user.bannedAt.toISOString() : null,
    level: user.level,
    bio: user.bio,
  };
}

function toUserResponse(user: {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: PrismaUserRole;
  status: UserStatus;
  banReason: string | null;
  bannedAt: Date | null;
  level: number;
  bio: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...user,
    bannedAt: user.bannedAt ? user.bannedAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function isAdminRole(role: PrismaUserRole | undefined) {
  return role === 'admin' || role === 'super_admin';
}

function canViewWikiPage(page: { status: ContentStatus; lastEditorUid: string }, authUser?: ApiUser) {
  if (page.status === 'published') return true;
  if (!authUser) return false;
  if (isAdminRole(authUser.role)) return true;
  return page.lastEditorUid === authUser.uid;
}

function canViewPost(post: { status: ContentStatus; authorUid: string }, authUser?: ApiUser) {
  if (post.status === 'published') return true;
  if (!authUser) return false;
  if (isAdminRole(authUser.role)) return true;
  return post.authorUid === authUser.uid;
}

function canViewGallery(gallery: { published: boolean; authorUid: string }, authUser?: ApiUser) {
  if (gallery.published) return true;
  if (!authUser) return false;
  if (isAdminRole(authUser.role)) return true;
  return gallery.authorUid === authUser.uid;
}

function canManageGallery(gallery: { authorUid: string }, authUser?: ApiUser) {
  if (!authUser) return false;
  if (isAdminRole(authUser.role)) return true;
  return gallery.authorUid === authUser.uid;
}

function buildWikiVisibilityWhere(authUser?: ApiUser) {
  if (!authUser) {
    return { status: 'published' as ContentStatus };
  }
  if (isAdminRole(authUser.role)) {
    return {};
  }
  return {
    OR: [
      { status: 'published' as ContentStatus },
      { lastEditorUid: authUser.uid },
    ],
  };
}

function buildPostVisibilityWhere(authUser?: ApiUser) {
  if (!authUser) {
    return { status: 'published' as ContentStatus };
  }
  if (isAdminRole(authUser.role)) {
    return {};
  }
  return {
    OR: [
      { status: 'published' as ContentStatus },
      { authorUid: authUser.uid },
    ],
  };
}

function parseContentStatus(value: unknown): ContentStatus | null {
  if (value === 'draft' || value === 'pending' || value === 'published' || value === 'rejected') {
    return value;
  }
  return null;
}

function normalizeWikiWriteStatus(rawStatus: unknown, authUser: ApiUser) {
  const status = parseContentStatus(rawStatus);
  if (isAdminRole(authUser.role)) {
    return status || 'published';
  }
  if (status === 'pending') return 'pending';
  if (status === 'rejected') return 'rejected';
  return 'draft';
}

function normalizePostWriteStatus(rawStatus: unknown, authUser: ApiUser) {
  const status = parseContentStatus(rawStatus);
  if (isAdminRole(authUser.role)) {
    return status || 'published';
  }
  if (status === 'pending') return 'pending';
  if (status === 'rejected') return 'rejected';
  return 'draft';
}

function parseFavoriteType(value: unknown): FavoriteTargetType | null {
  if (value === 'wiki' || value === 'post' || value === 'music') {
    return value;
  }
  return null;
}

function parseMusicPlatform(value: unknown): MusicPlatform | null {
  if (value === 'netease' || value === 'tencent' || value === 'kugou' || value === 'baidu' || value === 'kuwo') {
    return value;
  }
  return null;
}

function parseDisplayAlbumMode(value: unknown): DisplayAlbumMode | null {
  if (value === 'none' || value === 'linked' || value === 'manual') {
    return value;
  }
  return null;
}

function parseMusicCollectionType(value: unknown): MusicCollectionType | null {
  if (value === 'album' || value === 'playlist') {
    return value;
  }
  return null;
}

function getPlatformSourceId(song: {
  neteaseId?: string | null;
  tencentId?: string | null;
  kugouId?: string | null;
  baiduId?: string | null;
  kuwoId?: string | null;
  id?: string | null;
}, platform: MusicPlatform): string {
  if (platform === 'netease') return song.neteaseId?.trim() || '';
  if (platform === 'tencent') return song.tencentId?.trim() || '';
  if (platform === 'kugou') return song.kugouId?.trim() || '';
  if (platform === 'baidu') return song.baiduId?.trim() || '';
  if (platform === 'kuwo') return song.kuwoId?.trim() || '';
  return song.id?.trim() || '';
}

function getPlatformSourceField(platform: MusicPlatform):
  | 'neteaseId'
  | 'tencentId'
  | 'kugouId'
  | 'baiduId'
  | 'kuwoId' {
  if (platform === 'netease') return 'neteaseId';
  if (platform === 'tencent') return 'tencentId';
  if (platform === 'kugou') return 'kugouId';
  if (platform === 'baidu') return 'baiduId';
  return 'kuwoId';
}

const DEFAULT_MUSIC_PLATFORMS: MusicPlatform[] = ['netease', 'tencent', 'kugou', 'baidu', 'kuwo'];

function buildPlaybackPlatformCandidates(song: {
  enabledPlatform?: MusicPlatform | null;
  primaryPlatform?: MusicPlatform | null;
}): MusicPlatform[] {
  const preferred = song.enabledPlatform || song.primaryPlatform || null;
  const deduped = new Set<MusicPlatform>();
  if (preferred) {
    deduped.add(preferred);
  }
  DEFAULT_MUSIC_PLATFORMS.forEach((platform) => deduped.add(platform));
  return [...deduped.values()];
}

function parseBrowsingTargetType(value: unknown): BrowsingTargetType | null {
  if (value === 'wiki' || value === 'post' || value === 'music') {
    return value;
  }
  return null;
}

function parseModerationTargetType(value: unknown): ModerationTargetType | null {
  if (value === 'wiki' || value === 'post') {
    return value;
  }
  return null;
}

function normalizeModerationTargetType(value: unknown): ModerationTargetType | null {
  if (value === 'posts') {
    return 'post';
  }
  return parseModerationTargetType(value);
}

function createToken(user: ApiUser) {
  return jwt.sign(
    {
      uid: user.uid,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

function shouldUseSecureCookie(req: Request) {
  const override = process.env.COOKIE_SECURE;
  if (override === 'true') return true;
  if (override === 'false') return false;
  if (!IS_PROD) return false;

  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    return forwardedProto.split(',')[0].trim() === 'https';
  }

  return req.secure;
}

function setAuthCookie(req: Request, res: Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookie(req),
    maxAge: 7 * ONE_DAY_MS,
    path: '/',
  });
}

function clearAuthCookie(req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookie(req),
    path: '/',
  });
}

function getTokenFromRequest(req: Request) {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

async function authMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = getTokenFromRequest(req);
  if (!token) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as SessionJwtPayload;
    const user = await prisma.user.findUnique({
      where: { uid: payload.uid },
    });
    if (user) {
      req.authUser = userToApiUser(user);
    }
  } catch (error) {
    console.error('Invalid auth token:', error);
  }

  next();
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    res.status(401).json({ error: '请先登录' });
    return;
  }
  next();
}

function requireActiveUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    res.status(401).json({ error: '请先登录' });
    return;
  }

  if (req.authUser.status === 'banned') {
    res.status(403).json({
      error: req.authUser.banReason ? `账号已被封禁：${req.authUser.banReason}` : '账号已被封禁，无法执行写操作',
      code: 'USER_BANNED',
      banReason: req.authUser.banReason,
      bannedAt: req.authUser.bannedAt,
    });
    return;
  }

  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser || !isAdminRole(req.authUser.role)) {
    res.status(403).json({ error: '需要管理员权限' });
    return;
  }
  if (req.authUser.status === 'banned') {
    res.status(403).json({ error: '账号已被封禁，无法执行管理操作' });
    return;
  }
  next();
}

function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser || req.authUser.role !== 'super_admin') {
    res.status(403).json({ error: '需要超级管理员权限' });
    return;
  }
  if (req.authUser.status === 'banned') {
    res.status(403).json({ error: '账号已被封禁，无法执行管理操作' });
    return;
  }
  next();
}

function toWikiResponse(page: WikiResponseInput) {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    category: page.category,
    content: page.content,
    tags: serializeTags(page.tags),
    relations: serializeRelations(page.relations, page.slug),
    eventDate: page.eventDate,
    locationCode: page.locationCode || null,
    locationName: page.location?.fullName || null,
    status: page.status,
    reviewNote: page.reviewNote,
    reviewedBy: page.reviewedBy,
    reviewedAt: page.reviewedAt ? page.reviewedAt.toISOString() : null,
    viewCount: page.viewCount ?? 0,
    favoritesCount: page.favoritesCount,
    lastEditorUid: page.lastEditorUid,
    lastEditorName: page.lastEditorName,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}

type WikiBranchWithPage = {
  id: string;
  pageSlug: string;
  editorUid: string;
  editorName: string;
  status: WikiBranchStatus;
  latestRevisionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  page?: {
    slug: string;
    title: string;
    category: string;
  } | null;
};

type WikiPullRequestWithRelations = {
  id: string;
  branchId: string;
  pageSlug: string;
  title: string;
  description: string | null;
  status: WikiPullRequestStatus;
  createdByUid: string;
  createdByName: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  mergedAt: Date | null;
  baseRevisionId: string | null;
  conflictData: unknown;
  createdAt: Date;
  updatedAt: Date;
  branch?: WikiBranchWithPage | null;
  page?: {
    slug: string;
    title: string;
    category: string;
  } | null;
  comments?: {
    id: string;
    prId: string;
    authorUid: string;
    authorName: string;
    content: string;
    createdAt: Date;
  }[];
};

function toWikiBranchResponse(branch: WikiBranchWithPage) {
  return {
    id: branch.id,
    pageSlug: branch.pageSlug,
    editorUid: branch.editorUid,
    editorName: branch.editorName,
    status: branch.status,
    latestRevisionId: branch.latestRevisionId,
    createdAt: branch.createdAt.toISOString(),
    updatedAt: branch.updatedAt.toISOString(),
    page: branch.page
      ? {
          slug: branch.page.slug,
          title: branch.page.title,
          category: branch.page.category,
        }
      : null,
  };
}

function toWikiPullRequestResponse(pr: WikiPullRequestWithRelations) {
  return {
    id: pr.id,
    branchId: pr.branchId,
    pageSlug: pr.pageSlug,
    title: pr.title,
    description: pr.description,
    status: pr.status,
    createdByUid: pr.createdByUid,
    createdByName: pr.createdByName,
    reviewedBy: pr.reviewedBy,
    reviewedAt: pr.reviewedAt ? pr.reviewedAt.toISOString() : null,
    mergedAt: pr.mergedAt ? pr.mergedAt.toISOString() : null,
    baseRevisionId: pr.baseRevisionId,
    conflictData: pr.conflictData ?? null,
    createdAt: pr.createdAt.toISOString(),
    updatedAt: pr.updatedAt.toISOString(),
    branch: pr.branch ? toWikiBranchResponse(pr.branch) : null,
    page: pr.page
      ? {
          slug: pr.page.slug,
          title: pr.page.title,
          category: pr.page.category,
        }
      : null,
    comments: (pr.comments || []).map((comment) => ({
      id: comment.id,
      prId: comment.prId,
      authorUid: comment.authorUid,
      authorName: comment.authorName,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    })),
  };
}

function canManageWikiPullRequest(pr: { createdByUid: string }, authUser: ApiUser) {
  if (isAdminRole(authUser.role)) return true;
  return pr.createdByUid === authUser.uid;
}

function toPostResponse(post: {
  id: string;
  title: string;
  section: string;
  musicDocId?: string | null;
  albumDocId?: string | null;
  content: string;
  tags: unknown;
  locationCode?: string | null;
  authorUid: string;
  status: ContentStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  hotScore?: number;
  viewCount?: number;
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  isPinned?: boolean;
  createdAt: Date;
  updatedAt: Date;
  location?: { code: string; name: string; fullName: string } | null;
}) {
  return {
    ...post,
    locationCode: post.locationCode || null,
    locationName: post.location?.fullName || null,
    hotScore: post.hotScore ?? 0,
    viewCount: post.viewCount ?? 0,
    tags: serializeTags(post.tags),
    musicDocId: post.musicDocId || null,
    albumDocId: post.albumDocId || null,
    reviewedAt: post.reviewedAt ? post.reviewedAt.toISOString() : null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

function toCommentResponse(comment: {
  id: string;
  postId: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string | null;
  content: string;
  parentId: string | null;
  createdAt: Date;
}) {
  return {
    ...comment,
    createdAt: comment.createdAt.toISOString(),
  };
}

function toGalleryResponse(gallery: {
  id: string;
  title: string;
  description: string;
  authorUid: string;
  authorName: string;
  tags: unknown;
  locationCode?: string | null;
  published: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  location?: { code: string; name: string; fullName: string } | null;
  images: {
    id: string;
    url: string;
    name: string;
    sortOrder: number;
    assetId?: string | null;
    asset?: {
      id: string;
      publicUrl: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      status: string;
    } | null;
  }[];
}) {
  return {
    id: gallery.id,
    title: gallery.title,
    description: gallery.description,
    authorUid: gallery.authorUid,
    authorName: gallery.authorName,
    tags: serializeTags(gallery.tags),
    locationCode: gallery.locationCode || null,
    locationName: gallery.location?.fullName || null,
    published: gallery.published,
    publishedAt: gallery.publishedAt ? gallery.publishedAt.toISOString() : null,
    createdAt: gallery.createdAt.toISOString(),
    updatedAt: gallery.updatedAt.toISOString(),
    images: gallery.images
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((image) => ({
        id: image.id,
        assetId: image.assetId || image.asset?.id || null,
        url: image.asset?.publicUrl || image.url,
        name: image.asset?.fileName || image.name,
        mimeType: image.asset?.mimeType || null,
        sizeBytes: image.asset?.sizeBytes || null,
      })),
  };
}

function toMusicResponse(track: {
  docId: string;
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  lyric?: string | null;
  primaryPlatform: string;
  enabledPlatform?: string | null;
  neteaseId?: string | null;
  tencentId?: string | null;
  kugouId?: string | null;
  baiduId?: string | null;
  kuwoId?: string | null;
  displayAlbumMode: string;
  manualAlbumName?: string | null;
  defaultCoverSource?: string | null;
  addedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    docId: track.docId,
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    cover: track.cover || track.defaultCoverSource || '',
    audioUrl: track.audioUrl,
    lyric: track.lyric || null,
    primaryPlatform: track.primaryPlatform,
    enabledPlatform: track.enabledPlatform || null,
    platforms: {
      netease: track.neteaseId,
      tencent: track.tencentId,
      kugou: track.kugouId,
      baidu: track.baiduId,
      kuwo: track.kuwoId,
    },
    displayAlbumMode: track.displayAlbumMode,
    manualAlbumName: track.manualAlbumName || null,
    addedBy: track.addedBy || null,
    createdAt: track.createdAt.toISOString(),
    updatedAt: track.updatedAt.toISOString(),
  };
}

function toEditLockResponse(lock: {
  id: string;
  collection: string;
  recordId: string;
  userId: string;
  username: string;
  createdAt: Date;
  expiresAt: Date;
}) {
  return {
    ...lock,
    createdAt: lock.createdAt.toISOString(),
    expiresAt: lock.expiresAt.toISOString(),
  };
}

app.use(authMiddleware);

registerRegionRoutes(app);
registerExifRoutes(app);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/auth/me', async (req: AuthenticatedRequest, res) => {
  if (!req.authUser) {
    res.json({ user: null });
    return;
  }

  res.json({
    user: {
      ...req.authUser,
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerData: [
        {
          providerId: 'password',
          displayName: req.authUser.displayName,
          email: req.authUser.email,
          photoURL: req.authUser.photoURL,
        },
      ],
    },
  });
});

app.post('/api/auth/register', authRateLimiter, async (req, res) => {
  try {
    const { email, password, displayName } = req.body as {
      email?: string;
      password?: string;
      displayName?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: '邮箱和密码不能为空' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: '密码至少需要6个字符' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const name = (displayName || normalizedEmail.split('@')[0] || '匿名用户').trim();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      res.status(409).json({ error: '该邮箱已注册' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const role = SUPER_ADMIN_EMAIL && normalizedEmail === SUPER_ADMIN_EMAIL ? PrismaUserRole.super_admin : PrismaUserRole.user;

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        displayName: name,
        role,
        bio: '',
      },
    });

    const apiUser = userToApiUser(user);
    const token = createToken(apiUser);
    setAuthCookie(req, res, token);

    res.status(201).json({ user: apiUser });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: '邮箱和密码不能为空' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      res.status(401).json({ error: '邮箱或密码错误' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: '邮箱或密码错误' });
      return;
    }

    const apiUser = userToApiUser(user);
    const token = createToken(apiUser);
    setAuthCookie(req, res, token);

    res.json({ user: apiUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

app.post('/api/auth/wechat/login', authRateLimiter, async (req, res) => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const displayNameRaw = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
    const photoURLRaw = typeof req.body?.photoURL === 'string' ? req.body.photoURL.trim() : '';

    if (!code.trim()) {
      res.status(400).json({ error: 'code 不能为空' });
      return;
    }

    const { openId, unionId } = await exchangeWechatLoginCode(code);

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { wechatOpenId: openId },
          ...(unionId ? [{ wechatUnionId: unionId }] : []),
        ],
      },
    });

    if (!user) {
      const generatedEmail = await buildUniqueWechatEmail(openId);
      const generatedPassword = `wx_${openId}_${Date.now()}`;
      const passwordHash = await bcrypt.hash(generatedPassword, 12);
      const fallbackName = displayNameRaw || `微信用户${openId.slice(-6)}`;

      user = await prisma.user.create({
        data: {
          email: generatedEmail,
          passwordHash,
          displayName: fallbackName,
          photoURL: photoURLRaw || null,
          bio: '',
          wechatOpenId: openId,
          wechatUnionId: unionId,
        },
      });
    } else {
      const shouldUpdateProfile =
        (displayNameRaw && displayNameRaw !== user.displayName) ||
        (photoURLRaw && photoURLRaw !== (user.photoURL || '')) ||
        user.wechatOpenId !== openId ||
        (!user.wechatUnionId && !!unionId);

      if (shouldUpdateProfile) {
        user = await prisma.user.update({
          where: { uid: user.uid },
          data: {
            displayName: displayNameRaw || undefined,
            photoURL: photoURLRaw || undefined,
            wechatOpenId: openId,
            wechatUnionId: unionId || user.wechatUnionId,
          },
        });
      }
    }

    const apiUser = userToApiUser(user);
    const token = createToken(apiUser);
    setAuthCookie(req, res, token);

    res.json({
      user: apiUser,
      token,
      wechat: {
        openId,
        unionId,
      },
    });
  } catch (error) {
    console.error('WeChat login error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : '微信登录失败' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(req, res);
  res.json({ success: true });
});

app.patch('/api/users/me', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { displayName, bio, photoURL } = req.body as {
      displayName?: string;
      bio?: string;
      photoURL?: string;
    };

    const user = await prisma.user.update({
      where: { uid: req.authUser!.uid },
      data: {
        displayName: typeof displayName === 'string' ? displayName : undefined,
        bio: typeof bio === 'string' ? bio : undefined,
        photoURL: typeof photoURL === 'string' ? photoURL : undefined,
      },
    });

    res.json({ user: userToApiUser(user) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: '更新资料失败' });
  }
});

app.post('/api/users/me/avatar', requireAuth, requireActiveUser, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: '请选择图片文件' });
      return;
    }

    let mimeType = '';
    try {
      const validated = await validateUploadedImage(file);
      mimeType = validated.mimeType;
    } catch (error) {
      await safeDeleteUploadFileByStorageKey(file.filename);
      res.status(400).json({ error: error instanceof Error ? error.message : '非法图片文件' });
      return;
    }

    const asset = await prisma.mediaAsset.create({
      data: {
        ownerUid: req.authUser!.uid,
        storageKey: file.filename,
        publicUrl: buildUploadPublicUrl(file.filename),
        fileName: file.originalname,
        mimeType,
        sizeBytes: file.size,
        status: 'ready',
      },
    });

    const user = await prisma.user.update({
      where: { uid: req.authUser!.uid },
      data: { photoURL: asset.publicUrl },
    });

    res.status(201).json({
      photoURL: user.photoURL,
      asset: {
        assetId: asset.id,
        storageKey: asset.storageKey,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        url: asset.publicUrl,
      },
    });
  } catch (error) {
    if (req.file?.filename) {
      await safeDeleteUploadFileByStorageKey(req.file.filename);
    }
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: '上传头像失败' });
  }
});

app.get('/api/sections', async (_req, res) => {
  try {
    const sections = await prisma.section.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    res.json({ sections });
  } catch (error) {
    console.error('Fetch sections error:', error);
    res.status(500).json({ error: '获取版块失败' });
  }
});

app.post('/api/sections', requireAdmin, async (req, res) => {
  try {
    const { name, description, order } = req.body as {
      name?: string;
      description?: string;
      order?: number;
    };

    if (!name) {
      res.status(400).json({ error: '版块名称不能为空' });
      return;
    }

    const id = name.toLowerCase().trim().replace(/\s+/g, '-');
    const section = await prisma.section.upsert({
      where: { id },
      update: {
        name,
        description: description || '',
        order: typeof order === 'number' ? order : 0,
      },
      create: {
        id,
        name,
        description: description || '',
        order: typeof order === 'number' ? order : 0,
      },
    });

    res.status(201).json({ section });
  } catch (error) {
    console.error('Create section error:', error);
    res.status(500).json({ error: '新增版块失败' });
  }
});

app.delete('/api/sections/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.section.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete section error:', error);
    res.status(500).json({ error: '删除版块失败' });
  }
});

app.get('/api/announcements/latest', async (_req, res) => {
  try {
    const announcement = await prisma.announcement.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ announcement });
  } catch (error) {
    console.error('Fetch latest announcement error:', error);
    res.status(500).json({ error: '获取公告失败' });
  }
});

app.get('/api/announcements', requireAdmin, async (_req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ announcements });
  } catch (error) {
    console.error('Fetch announcements error:', error);
    res.status(500).json({ error: '获取公告失败' });
  }
});

app.post('/api/announcements', requireAdmin, async (req, res) => {
  try {
    const { content, link, active } = req.body as {
      content?: string;
      link?: string;
      active?: boolean;
    };

    if (!content) {
      res.status(400).json({ error: '公告内容不能为空' });
      return;
    }

    const announcement = await prisma.announcement.create({
      data: {
        content,
        link: link || null,
        active: active ?? true,
      },
    });

    res.status(201).json({ announcement });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: '发布公告失败' });
  }
});

app.patch('/api/announcements/:id', requireAdmin, async (req, res) => {
  try {
    const { active, content, link } = req.body as {
      active?: boolean;
      content?: string;
      link?: string;
    };

    const announcement = await prisma.announcement.update({
      where: { id: req.params.id },
      data: {
        active: typeof active === 'boolean' ? active : undefined,
        content: typeof content === 'string' ? content : undefined,
        link: typeof link === 'string' ? link : undefined,
      },
    });

    res.json({ announcement });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ error: '更新公告失败' });
  }
});

app.delete('/api/announcements/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.announcement.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: '删除公告失败' });
  }
});

app.get('/api/users', requireAdmin, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        uid: true,
        email: true,
        displayName: true,
        photoURL: true,
        role: true,
        status: true,
        banReason: true,
        bannedAt: true,
        level: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ users: users.map(toUserResponse) });
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: '获取用户失败' });
  }
});

app.patch('/api/users/:uid/role', requireSuperAdmin, async (req, res) => {
  try {
    const { role } = req.body as { role?: PrismaUserRole };
    if (!role || !['user', 'admin', 'super_admin'].includes(role)) {
      res.status(400).json({ error: '无效角色' });
      return;
    }

    const user = await prisma.user.update({
      where: { uid: req.params.uid },
      data: { role },
      select: {
        uid: true,
        email: true,
        displayName: true,
        photoURL: true,
        role: true,
        status: true,
        banReason: true,
        bannedAt: true,
        level: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ user: toUserResponse(user) });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: '更新角色失败' });
  }
});

app.post('/api/admin/users/:uid/ban', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUid = req.params.uid;
    if (!targetUid) {
      res.status(400).json({ error: '无效用户' });
      return;
    }

    if (req.authUser?.uid === targetUid) {
      res.status(400).json({ error: '不能封禁自己' });
      return;
    }

    const noteRaw = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    const reasonRaw = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const finalReason = reasonRaw || noteRaw || '违反社区规范';

    const user = await prisma.user.update({
      where: { uid: targetUid },
      data: {
        status: 'banned',
        banReason: finalReason,
        bannedAt: new Date(),
      },
      select: {
        uid: true,
        email: true,
        displayName: true,
        photoURL: true,
        role: true,
        status: true,
        banReason: true,
        bannedAt: true,
        level: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.userBanLog.create({
      data: {
        targetUid,
        operatorUid: req.authUser!.uid,
        action: 'ban',
        note: finalReason,
      },
    });

    res.json({ user: toUserResponse(user) });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ error: '封禁用户失败' });
  }
});

app.post('/api/admin/users/:uid/unban', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUid = req.params.uid;
    if (!targetUid) {
      res.status(400).json({ error: '无效用户' });
      return;
    }

    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    const user = await prisma.user.update({
      where: { uid: targetUid },
      data: {
        status: 'active',
        banReason: null,
        bannedAt: null,
      },
      select: {
        uid: true,
        email: true,
        displayName: true,
        photoURL: true,
        role: true,
        status: true,
        banReason: true,
        bannedAt: true,
        level: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.userBanLog.create({
      data: {
        targetUid,
        operatorUid: req.authUser!.uid,
        action: 'unban',
        note: note || null,
      },
    });

    res.json({ user: toUserResponse(user) });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ error: '解封用户失败' });
  }
});

app.get('/api/users/:uid', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.authUser?.uid !== req.params.uid && req.authUser?.role === 'user') {
      res.status(403).json({ error: '无权访问该用户信息' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { uid: req.params.uid },
      select: {
        uid: true,
        email: true,
        displayName: true,
        photoURL: true,
        role: true,
        status: true,
        banReason: true,
        bannedAt: true,
        level: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    res.json({ user: toUserResponse(user) });
  } catch (error) {
    console.error('Fetch user detail error:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

app.get('/api/users/:uid/posts', async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.params.uid;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const visibilityWhere = buildPostVisibilityWhere(req.authUser);

    const where = {
      authorUid: uid,
      ...visibilityWhere,
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.post.count({ where }),
    ]);

    const likedPostSet = new Set<string>();
    const favoritedPostSet = new Set<string>();
    const dislikedPostSet = new Set<string>();
    if (req.authUser && posts.length) {
      const [likedPosts, favoritedPosts, dislikedPosts] = await Promise.all([
        prisma.postLike.findMany({
          where: {
            userUid: req.authUser.uid,
            postId: { in: posts.map((item) => item.id) },
          },
          select: { postId: true },
        }),
        prisma.favorite.findMany({
          where: {
            userUid: req.authUser.uid,
            targetType: 'post',
            targetId: { in: posts.map((item) => item.id) },
          },
          select: { targetId: true },
        }),
        prisma.postDislike.findMany({
          where: {
            userUid: req.authUser.uid,
            postId: { in: posts.map((item) => item.id) },
          },
          select: { postId: true },
        }),
      ]);
      likedPosts.forEach((item) => likedPostSet.add(item.postId));
      favoritedPosts.forEach((item) => favoritedPostSet.add(item.targetId));
      dislikedPosts.forEach((item) => dislikedPostSet.add(item.postId));
    }

    res.json({
      posts: posts.map((post) => ({
        ...toPostResponse(post),
        likedByMe: likedPostSet.has(post.id),
        favoritedByMe: favoritedPostSet.has(post.id),
        dislikedByMe: dislikedPostSet.has(post.id),
      })),
    });
  } catch (error) {
    console.error('Fetch user posts error:', error);
    res.status(500).json({ error: '获取用户帖子失败' });
  }
});

app.get('/api/users/:uid/comments', async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.params.uid;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const visibilityWhere = buildPostVisibilityWhere(req.authUser);

    const comments = await prisma.postComment.findMany({
      where: {
        authorUid: uid,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });

    const postIds = [...new Set(comments.map((c) => c.postId))];
    const postsMap = new Map<string, { id: string; title: string; status: string }>();

    if (postIds.length) {
      const posts = await prisma.post.findMany({
        where: {
          id: { in: postIds },
          ...visibilityWhere,
        },
        select: { id: true, title: true, status: true },
      });
      posts.forEach((p) => postsMap.set(p.id, p));
    }

    const total = await prisma.postComment.count({ where: { authorUid: uid } });

    res.json({
      comments: comments.map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        authorUid: comment.authorUid,
        authorName: comment.authorName,
        authorPhoto: comment.authorPhoto,
        content: comment.content,
        parentId: comment.parentId,
        createdAt: comment.createdAt.toISOString(),
        post: comment.postId && postsMap.has(comment.postId) ? postsMap.get(comment.postId)! : null,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Fetch user comments error:', error);
    res.status(500).json({ error: '获取用户评论失败' });
  }
});

app.get('/api/users/me/history', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userUid = req.authUser!.uid;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const rawType = req.query.type;
    const targetType: BrowsingTargetType | undefined =
      rawType === 'wiki' || rawType === 'post' || rawType === 'music'
        ? rawType
        : undefined;

    const where: Prisma.BrowsingHistoryWhereInput = {
      userUid,
      ...(targetType ? { targetType } : {}),
    };

    const [history, total] = await Promise.all([
      prisma.browsingHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.browsingHistory.count({ where }),
    ]);

    const wikiSlugs = history.filter((h) => h.targetType === 'wiki').map((h) => h.targetId);
    const postIds = history.filter((h) => h.targetType === 'post').map((h) => h.targetId);

    const [wikiPages, posts] = await Promise.all([
      wikiSlugs.length
        ? prisma.wikiPage.findMany({
            where: { slug: { in: wikiSlugs } },
            select: { slug: true, title: true, category: true, status: true },
          })
        : Promise.resolve([]),
      postIds.length
        ? prisma.post.findMany({
            where: { id: { in: postIds } },
            select: { id: true, title: true, status: true },
          })
        : Promise.resolve([]),
    ]);

    const wikiMap = new Map(wikiPages.map((w) => [w.slug, w]));
    const postMap = new Map(posts.map((p) => [p.id, p]));

    res.json({
      history: history.map((h) => {
        let target: Record<string, unknown> | null = null;
        if (h.targetType === 'wiki' && wikiMap.has(h.targetId)) {
          target = { ...wikiMap.get(h.targetId)!, type: 'wiki' as const };
        } else if (h.targetType === 'post' && postMap.has(h.targetId)) {
          target = { ...postMap.get(h.targetId)!, type: 'post' as const };
        } else if (h.targetType === 'music') {
          target = { id: h.targetId, type: 'music' as const };
        }
        return {
          id: h.id,
          targetType: h.targetType,
          targetId: h.targetId,
          createdAt: h.createdAt.toISOString(),
          target,
        };
      }),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Fetch browsing history error:', error);
    res.status(500).json({ error: '获取浏览历史失败' });
  }
});

app.get('/api/notifications', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userUid = req.authUser!.uid;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const unreadOnly = req.query.unread === 'true';
    const typeFilter = typeof req.query.type === 'string' && req.query.type ? req.query.type : null;

    const where: Record<string, unknown> = {
      userUid,
      ...(unreadOnly ? { isRead: false } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userUid, isRead: false } }),
    ]);

    res.json({
      notifications: notifications.map(toNotificationResponse),
      total,
      unreadCount,
      page,
      limit,
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ error: '获取通知失败' });
  }
});

app.post('/api/notifications/:id/read', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userUid = req.authUser!.uid;
    const notificationId = req.params.id;

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, userUid: true, isRead: true },
    });

    if (!notification) {
      res.status(404).json({ error: '通知不存在' });
      return;
    }

    if (notification.userUid !== userUid) {
      res.status(403).json({ error: '无权操作该通知' });
      return;
    }

    if (!notification.isRead) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: '标记已读失败' });
  }
});

app.post('/api/notifications/read-all', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userUid = req.authUser!.uid;

    await prisma.notification.updateMany({
      where: { userUid, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: '全部标记已读失败' });
  }
});

app.get('/api/wiki', async (req: AuthenticatedRequest, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : 'all';
    const visibilityWhere = buildWikiVisibilityWhere(req.authUser);
    const where = {
      ...(category && category !== 'all' ? { category } : {}),
      ...visibilityWhere,
    };

    const pages = await prisma.wikiPage.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    });

    const favoritedWikiSet = new Set<string>();
    const likedWikiSet = new Set<string>();
    const dislikedWikiSet = new Set<string>();

    if (req.authUser && pages.length) {
      const [favorites, likes, dislikes] = await Promise.all([
        prisma.favorite.findMany({
          where: {
            userUid: req.authUser.uid,
            targetType: 'wiki',
            targetId: { in: pages.map((item) => item.slug) },
          },
          select: { targetId: true },
        }),
        prisma.wikiLike.findMany({
          where: {
            userUid: req.authUser.uid,
            pageSlug: { in: pages.map((item) => item.slug) },
          },
          select: { pageSlug: true },
        }),
        prisma.wikiDislike.findMany({
          where: {
            userUid: req.authUser.uid,
            pageSlug: { in: pages.map((item) => item.slug) },
          },
          select: { pageSlug: true },
        }),
      ]);
      favorites.forEach((item) => favoritedWikiSet.add(item.targetId));
      likes.forEach((item) => likedWikiSet.add(item.pageSlug));
      dislikes.forEach((item) => dislikedWikiSet.add(item.pageSlug));
    }

    res.json({
      pages: pages.map((page) => ({
        ...toWikiResponse(page),
        favoritedByMe: favoritedWikiSet.has(page.slug),
        likedByMe: likedWikiSet.has(page.slug),
        dislikedByMe: dislikedWikiSet.has(page.slug),
      })),
    });
  } catch (error) {
    console.error('Fetch wiki pages error:', error);
    res.status(500).json({ error: '获取百科失败' });
  }
});

app.get('/api/mp/wiki', async (req: AuthenticatedRequest, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : 'all';
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const where = {
      status: 'published' as ContentStatus,
      ...(category && category !== 'all' ? { category } : {}),
    };

    const [pages, total] = await Promise.all([
      prisma.wikiPage.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        take: limit,
        skip,
        select: {
          slug: true,
          title: true,
          category: true,
          tags: true,
          eventDate: true,
          updatedAt: true,
          favoritesCount: true,
        },
      }),
      prisma.wikiPage.count({ where }),
    ]);

    res.json({
      items: pages.map((page) => ({
        slug: page.slug,
        title: page.title,
        category: page.category,
        tags: serializeTags(page.tags),
        eventDate: page.eventDate,
        favoritesCount: page.favoritesCount,
        updatedAt: page.updatedAt.toISOString(),
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Fetch mp wiki list error:', error);
    res.status(500).json({ error: '获取小程序百科失败' });
  }
});

app.get('/api/wiki/timeline', async (req: AuthenticatedRequest, res) => {
  try {
    const pages = await prisma.wikiPage.findMany({
      where: {
        ...buildWikiVisibilityWhere(req.authUser),
        eventDate: {
          not: null,
        },
      },
      orderBy: {
        eventDate: 'asc',
      },
    });

    const favoritedWikiSet = new Set<string>();
    if (req.authUser && pages.length) {
      const favorites = await prisma.favorite.findMany({
        where: {
          userUid: req.authUser.uid,
          targetType: 'wiki',
          targetId: { in: pages.map((item) => item.slug) },
        },
        select: { targetId: true },
      });
      favorites.forEach((item) => favoritedWikiSet.add(item.targetId));
    }

    res.json({
      events: pages.map((page) => ({
        ...toWikiResponse(page),
        favoritedByMe: favoritedWikiSet.has(page.slug),
      })),
    });
  } catch (error) {
    console.error('Fetch wiki timeline error:', error);
    res.status(500).json({ error: '获取时间轴失败' });
  }
});

app.get('/api/wiki/recommended', async (req: AuthenticatedRequest, res) => {
  try {
    const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';
    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 24);

    const visibilityWhere = buildWikiVisibilityWhere(req.authUser);

    const basePage = slug
      ? await prisma.wikiPage.findUnique({
          where: { slug },
          select: {
            slug: true,
            category: true,
            tags: true,
            status: true,
            lastEditorUid: true,
          },
        })
      : null;

    if (basePage && !canViewWikiPage(basePage, req.authUser)) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    const candidates = await prisma.wikiPage.findMany({
      where: {
        ...visibilityWhere,
        ...(slug ? { slug: { not: slug } } : {}),
      },
      orderBy: [{ favoritesCount: 'desc' }, { viewCount: 'desc' }, { updatedAt: 'desc' }],
      take: 120,
    });

    const baseTags = new Set<string>(serializeTags(basePage?.tags).map((item) => String(item).toLowerCase()));

    const scored = candidates.map((item) => {
      let score = item.favoritesCount * 3 + (item.viewCount ?? 0) * 0.35;
      if (basePage && item.category === basePage.category) {
        score += 2;
      }

      if (baseTags.size) {
        const tags = serializeTags(item.tags).map((tag) => String(tag).toLowerCase());
        const sharedCount = tags.filter((tag) => baseTags.has(tag)).length;
        score += sharedCount * 0.8;
      }

      const hoursSince = Math.max(0, (Date.now() - item.updatedAt.getTime()) / (1000 * 60 * 60));
      score += 3 / (1 + (hoursSince / 48));

      return {
        item,
        score: Number(score.toFixed(3)),
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, limit);

    const favoritedWikiSet = new Set<string>();
    if (req.authUser && top.length) {
      const favorites = await prisma.favorite.findMany({
        where: {
          userUid: req.authUser.uid,
          targetType: 'wiki',
          targetId: { in: top.map((entry) => entry.item.slug) },
        },
        select: { targetId: true },
      });
      favorites.forEach((favorite) => favoritedWikiSet.add(favorite.targetId));
    }

    res.json({
      items: top.map((entry) => ({
        ...toWikiResponse(entry.item),
        score: entry.score,
        favoritedByMe: favoritedWikiSet.has(entry.item.slug),
      })),
    });
  } catch (error) {
    console.error('Fetch wiki recommended error:', error);
    res.status(500).json({ error: '获取推荐百科失败' });
  }
});

app.get('/api/wiki/:slug', async (req: AuthenticatedRequest, res) => {
  try {
    const page = await prisma.wikiPage.findUnique({
      where: { slug: req.params.slug },
    });

    if (!page || !canViewWikiPage(page, req.authUser)) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    await prisma.$executeRaw`UPDATE "WikiPage" SET "viewCount" = "viewCount" + 1 WHERE "slug" = ${req.params.slug}`;
    const freshPage = await prisma.wikiPage.findUnique({
      where: { slug: req.params.slug },
    });

    if (!freshPage) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    if (req.authUser) {
      await recordBrowsingHistory(req.authUser.uid, 'wiki', req.params.slug);
    }

    const backlinks = await prisma.wikiPage.findMany({
      where: {
        ...buildWikiVisibilityWhere(req.authUser),
        slug: { not: req.params.slug },
        content: {
          contains: `[[${req.params.slug}]]`,
        },
      },
      take: 100,
      orderBy: { updatedAt: 'desc' },
    });

    const relationBundle = await buildWikiRelationBundle(
      {
        slug: freshPage.slug,
        title: freshPage.title,
        category: freshPage.category,
        status: freshPage.status,
        lastEditorUid: freshPage.lastEditorUid,
        relations: freshPage.relations,
      },
      req.authUser,
    );

    const favoritedByMe = req.authUser
      ? (await prisma.favorite.count({
          where: {
            userUid: req.authUser.uid,
            targetType: 'wiki',
            targetId: req.params.slug,
          },
        })) > 0
      : false;

    const likedByMe = req.authUser
      ? (await prisma.wikiLike.count({
          where: {
            userUid: req.authUser.uid,
            pageSlug: req.params.slug,
          },
        })) > 0
      : false;

    const dislikedByMe = req.authUser
      ? (await prisma.wikiDislike.count({
          where: {
            userUid: req.authUser.uid,
            pageSlug: req.params.slug,
          },
        })) > 0
      : false;

    res.json({
      page: {
        ...toWikiResponse(freshPage),
        favoritedByMe,
        likedByMe,
        dislikedByMe,
      },
      backlinks: backlinks.map(toWikiResponse),
      relations: relationBundle.relations,
      relationGraph: relationBundle.graph,
    });
  } catch (error) {
    console.error('Fetch wiki page error:', error);
    res.status(500).json({ error: '获取页面失败' });
  }
});

app.post('/api/wiki/:slug/like', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const slug = req.params.slug;
    const page = await prisma.wikiPage.findUnique({
      where: { slug },
      select: {
        slug: true,
        status: true,
        lastEditorUid: true,
      },
    });

    if (!page || !canViewWikiPage(page, req.authUser)) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      try {
        await tx.wikiLike.create({
          data: {
            pageSlug: slug,
            userUid: req.authUser!.uid,
          },
        });
      } catch {
        return;
      }

      await tx.wikiPage.update({
        where: { slug },
        data: {
          likesCount: { increment: 1 },
        },
      });
    });

    const likesCount = await prisma.wikiLike.count({ where: { pageSlug: slug } });

    res.json({ liked: true, likesCount });
  } catch (error) {
    console.error('Like wiki page error:', error);
    res.status(500).json({ error: '点赞失败' });
  }
});

app.delete('/api/wiki/:slug/like', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const slug = req.params.slug;

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.wikiLike.deleteMany({
        where: {
          pageSlug: slug,
          userUid: req.authUser!.uid,
        },
      });

      if (!deleted.count) {
        return;
      }

      await tx.wikiPage.update({
        where: { slug },
        data: {
          likesCount: { decrement: 1 },
        },
      });
    });

    const likesCount = await prisma.wikiLike.count({ where: { pageSlug: slug } });

    res.json({ liked: false, likesCount });
  } catch (error) {
    console.error('Unlike wiki page error:', error);
    res.status(500).json({ error: '取消点赞失败' });
  }
});

app.post('/api/wiki/:slug/dislike', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const slug = req.params.slug;
    const page = await prisma.wikiPage.findUnique({
      where: { slug },
      select: {
        slug: true,
        status: true,
        lastEditorUid: true,
      },
    });

    if (!page || !canViewWikiPage(page, req.authUser)) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      try {
        await tx.wikiDislike.create({
          data: {
            pageSlug: slug,
            userUid: req.authUser!.uid,
          },
        });
      } catch {
        return;
      }

      await tx.wikiPage.update({
        where: { slug },
        data: {
          dislikesCount: { increment: 1 },
        },
      });
    });

    const dislikesCount = await prisma.wikiDislike.count({ where: { pageSlug: slug } });

    res.json({ disliked: true, dislikesCount });
  } catch (error) {
    console.error('Dislike wiki page error:', error);
    res.status(500).json({ error: '踩失败' });
  }
});

app.delete('/api/wiki/:slug/dislike', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const slug = req.params.slug;

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.wikiDislike.deleteMany({
        where: {
          pageSlug: slug,
          userUid: req.authUser!.uid,
        },
      });

      if (!deleted.count) {
        return;
      }

      await tx.wikiPage.update({
        where: { slug },
        data: {
          dislikesCount: { decrement: 1 },
        },
      });
    });

    const dislikesCount = await prisma.wikiDislike.count({ where: { pageSlug: slug } });

    res.json({ disliked: false, dislikesCount });
  } catch (error) {
    console.error('Undislike wiki page error:', error);
    res.status(500).json({ error: '取消踩失败' });
  }
});

app.post('/api/wiki/:slug/pin', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const slug = req.params.slug;

    const page = await prisma.wikiPage.findUnique({
      where: { slug },
      select: { slug: true, isPinned: true },
    });

    if (!page) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    const updatedPage = await prisma.wikiPage.update({
      where: { slug },
      data: { isPinned: true },
    });

    res.json({ isPinned: updatedPage.isPinned });
  } catch (error) {
    console.error('Pin wiki page error:', error);
    res.status(500).json({ error: '置顶页面失败' });
  }
});

app.delete('/api/wiki/:slug/pin', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const slug = req.params.slug;

    const page = await prisma.wikiPage.findUnique({
      where: { slug },
      select: { slug: true, isPinned: true },
    });

    if (!page) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    const updatedPage = await prisma.wikiPage.update({
      where: { slug },
      data: { isPinned: false },
    });

    res.json({ isPinned: updatedPage.isPinned });
  } catch (error) {
    console.error('Unpin wiki page error:', error);
    res.status(500).json({ error: '取消置顶失败' });
  }
});

app.get('/api/wiki/:slug/history', async (req: AuthenticatedRequest, res) => {
  try {
    const page = await prisma.wikiPage.findUnique({
      where: { slug: req.params.slug },
      select: {
        slug: true,
        status: true,
        lastEditorUid: true,
      },
    });

    if (!page) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    if (!canViewWikiPage(page, req.authUser)) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    const revisions = await prisma.wikiRevision.findMany({
      where: { pageSlug: req.params.slug },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      revisions: revisions.map((revision) => ({
        ...revision,
        createdAt: revision.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Fetch wiki history error:', error);
    res.status(500).json({ error: '获取历史记录失败' });
  }
});

app.post('/api/wiki/:slug/submit', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const slug = req.params.slug;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    const page = await prisma.wikiPage.findUnique({
      where: { slug },
      select: {
        slug: true,
        lastEditorUid: true,
        status: true,
      },
    });

    if (!page) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    const isOwner = page.lastEditorUid === req.authUser!.uid;
    if (!isOwner && !isAdminRole(req.authUser!.role)) {
      res.status(403).json({ error: '无权提交该页面' });
      return;
    }

    const updated = await prisma.wikiPage.update({
      where: { slug },
      data: {
        status: 'pending',
        reviewNote: note || null,
        reviewedBy: null,
        reviewedAt: null,
      },
    });

    await prisma.moderationLog.create({
      data: {
        targetType: 'wiki',
        targetId: slug,
        action: 'submit',
        operatorUid: req.authUser!.uid,
        note: note || null,
      },
    });

    res.json({ page: toWikiResponse(updated) });
  } catch (error) {
    console.error('Submit wiki review error:', error);
    res.status(500).json({ error: '提交审核失败' });
  }
});

app.post('/api/wiki', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const hasTagsInPayload = Object.prototype.hasOwnProperty.call(req.body, 'tags');
    const hasRelationsInPayload = Object.prototype.hasOwnProperty.call(req.body, 'relations');
    const {
      title,
      slug,
      category,
      content,
      tags,
      relations,
      eventDate,
      status,
      locationCode,
    } = req.body as {
      title?: string;
      slug?: string;
      category?: string;
      content?: string;
      tags?: string[];
      relations?: unknown;
      eventDate?: string;
      status?: ContentStatus;
      locationCode?: string;
    };

    if (!title || !slug || !category || !content) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    if (category === 'music' && req.authUser?.role === 'user') {
      res.status(403).json({ error: '只有管理员可以编辑音乐分类内容' });
      return;
    }

    const pageSlug = slug.trim().toLowerCase();
    const existing = await prisma.wikiPage.findUnique({ where: { slug: pageSlug } });
    const nextStatus = normalizeWikiWriteStatus(status, req.authUser!);
    const normalizedRelations = hasRelationsInPayload
      ? await normalizeWikiRelationListForWrite(relations, pageSlug)
      : serializeRelations(existing?.relations, pageSlug);
    const normalizedTags = hasTagsInPayload
      ? (Array.isArray(tags) ? tags : [])
      : serializeTags(existing?.tags);

    if (existing && !isAdminRole(req.authUser!.role) && existing.lastEditorUid !== req.authUser!.uid) {
      res.status(409).json({ error: '该 slug 已存在' });
      return;
    }

    const page = await prisma.wikiPage.upsert({
      where: { slug: pageSlug },
      create: {
        slug: pageSlug,
        title,
        category,
        content,
        tags: normalizedTags,
        relations: normalizedRelations,
        eventDate: eventDate || null,
        status: nextStatus,
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        lastEditorUid: req.authUser!.uid,
        lastEditorName: req.authUser!.displayName,
        locationCode: locationCode || null,
      },
      update: {
        title,
        category,
        content,
        tags: normalizedTags,
        relations: normalizedRelations,
        eventDate: eventDate || null,
        status: nextStatus,
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        lastEditorUid: req.authUser!.uid,
        lastEditorName: req.authUser!.displayName,
        locationCode: locationCode || null,
      },
    });

    const revision = await prisma.wikiRevision.create({
      data: {
        pageSlug,
        title,
        content,
        slug: pageSlug,
        category,
        tags: normalizedTags,
        relations: normalizedRelations,
        eventDate: eventDate || null,
        editorUid: req.authUser!.uid,
        editorName: req.authUser!.displayName,
      },
    });

    if (!page.mainBranchId) {
      const mainBranch = await prisma.wikiBranch.create({
        data: {
          pageSlug,
          editorUid: req.authUser!.uid,
          editorName: req.authUser!.displayName,
          status: 'merged',
          latestRevisionId: revision.id,
        },
      });
      await prisma.wikiPage.update({
        where: { slug: pageSlug },
        data: {
          mainBranchId: mainBranch.id,
          mergedAt: new Date(),
        },
      });
    }

    if (nextStatus === 'pending') {
      await prisma.moderationLog.create({
        data: {
          targetType: 'wiki',
          targetId: pageSlug,
          action: 'submit',
          operatorUid: req.authUser!.uid,
          note: null,
        },
      });
    }

    res.status(201).json({ page: toWikiResponse(page) });
  } catch (error) {
    console.error('Create wiki page error:', error);
    res.status(500).json({ error: '保存页面失败' });
  }
});

app.post('/api/wiki/legacy', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const hasTagsInPayload = Object.prototype.hasOwnProperty.call(req.body, 'tags');
    const hasRelationsInPayload = Object.prototype.hasOwnProperty.call(req.body, 'relations');
    const {
      title,
      slug,
      category,
      content,
      tags,
      relations,
      eventDate,
      status,
    } = req.body as {
      title?: string;
      slug?: string;
      category?: string;
      content?: string;
      tags?: string[];
      relations?: unknown;
      eventDate?: string;
      status?: ContentStatus;
    };

    if (!title || !slug || !category || !content) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    if (category === 'music' && req.authUser?.role === 'user') {
      res.status(403).json({ error: '只有管理员可以编辑音乐分类内容' });
      return;
    }

    const pageSlug = slug.trim().toLowerCase();
    const existing = await prisma.wikiPage.findUnique({ where: { slug: pageSlug } });

    if (existing && !isAdminRole(req.authUser!.role) && existing.lastEditorUid !== req.authUser!.uid) {
      res.status(409).json({ error: '该 slug 已存在' });
      return;
    }

    const nextStatus = normalizeWikiWriteStatus(status, req.authUser!);
    const normalizedRelations = hasRelationsInPayload
      ? await normalizeWikiRelationListForWrite(relations, pageSlug)
      : serializeRelations(existing?.relations, pageSlug);
    const normalizedTags = hasTagsInPayload
      ? (Array.isArray(tags) ? tags : [])
      : serializeTags(existing?.tags);
    const page = await prisma.wikiPage.upsert({
      where: { slug: pageSlug },
      create: {
        slug: pageSlug,
        title,
        category,
        content,
        tags: normalizedTags,
        relations: normalizedRelations,
        eventDate: eventDate || null,
        status: nextStatus,
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        lastEditorUid: req.authUser!.uid,
        lastEditorName: req.authUser!.displayName,
      },
      update: {
        title,
        category,
        content,
        tags: normalizedTags,
        relations: normalizedRelations,
        eventDate: eventDate || null,
        status: nextStatus,
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        lastEditorUid: req.authUser!.uid,
        lastEditorName: req.authUser!.displayName,
      },
    });

    await prisma.wikiRevision.create({
      data: {
        pageSlug,
        title,
        content,
        slug: pageSlug,
        category,
        tags: normalizedTags,
        relations: normalizedRelations,
        eventDate: eventDate || null,
        editorUid: req.authUser!.uid,
        editorName: req.authUser!.displayName,
      },
    });

    res.status(201).json({ page: toWikiResponse(page) });
  } catch (error) {
    console.error('Create legacy wiki page error:', error);
    res.status(500).json({ error: '保存页面失败' });
  }
});

app.put('/api/wiki/:slug', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const hasTagsInPayload = Object.prototype.hasOwnProperty.call(req.body, 'tags');
    const hasRelationsInPayload = Object.prototype.hasOwnProperty.call(req.body, 'relations');
    const {
      title,
      category,
      content,
      tags,
      relations,
      eventDate,
      status,
      locationCode,
    } = req.body as {
      title?: string;
      category?: string;
      content?: string;
      tags?: string[];
      relations?: unknown;
      eventDate?: string;
      status?: ContentStatus;
      locationCode?: string;
    };

    if (!title || !category || !content) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    const page = await prisma.wikiPage.findUnique({ where: { slug: req.params.slug } });
    if (!page) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    if (!isAdminRole(req.authUser!.role) && page.lastEditorUid !== req.authUser!.uid) {
      res.status(403).json({ error: '无权编辑该页面' });
      return;
    }

    const nextStatus = normalizeWikiWriteStatus(status, req.authUser!);
    const normalizedRelations = hasRelationsInPayload
      ? await normalizeWikiRelationListForWrite(relations, req.params.slug)
      : serializeRelations(page.relations, page.slug);
    const normalizedTags = hasTagsInPayload ? (Array.isArray(tags) ? tags : []) : serializeTags(page.tags);
    const updated = await prisma.wikiPage.update({
      where: { slug: req.params.slug },
      data: {
        title,
        category,
        content,
        tags: normalizedTags,
        relations: normalizedRelations,
        eventDate: eventDate || null,
        status: nextStatus,
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        lastEditorUid: req.authUser!.uid,
        lastEditorName: req.authUser!.displayName,
        locationCode: locationCode || null,
      },
    });

    await prisma.wikiRevision.create({
      data: {
        pageSlug: req.params.slug,
        title,
        content,
        slug: req.params.slug,
        category,
        tags: normalizedTags,
        relations: normalizedRelations,
        eventDate: eventDate || null,
        editorUid: req.authUser!.uid,
        editorName: req.authUser!.displayName,
      },
    });

    res.json({ page: toWikiResponse(updated) });
  } catch (error) {
    console.error('Update wiki page error:', error);
    res.status(500).json({ error: '更新页面失败' });
  }
});

app.post('/api/wiki/:slug/branches', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const pageSlug = req.params.slug;
    const page = await prisma.wikiPage.findUnique({ where: { slug: pageSlug } });
    if (!page || !canViewWikiPage(page, req.authUser)) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    const existing = await prisma.wikiBranch.findUnique({
      where: {
        pageSlug_editorUid: {
          pageSlug,
          editorUid: req.authUser!.uid,
        },
      },
      include: {
        page: { select: { slug: true, title: true, category: true } },
      },
    });
    if (existing) {
      res.json({ branch: toWikiBranchResponse(existing as WikiBranchWithPage) });
      return;
    }

    const revision = await prisma.wikiRevision.create({
      data: {
        pageSlug,
        title: page.title,
        content: page.content,
        slug: page.slug,
        category: page.category,
        tags: page.tags,
        relations: page.relations,
        eventDate: page.eventDate,
        editorUid: req.authUser!.uid,
        editorName: req.authUser!.displayName,
        isAutoSave: false,
      },
    });

    const branch = await prisma.wikiBranch.create({
      data: {
        pageSlug,
        editorUid: req.authUser!.uid,
        editorName: req.authUser!.displayName,
        status: 'draft',
        latestRevisionId: revision.id,
      },
      include: {
        page: { select: { slug: true, title: true, category: true } },
      },
    });

    await prisma.wikiRevision.update({
      where: { id: revision.id },
      data: { branchId: branch.id },
    });

    res.status(201).json({ branch: toWikiBranchResponse(branch as WikiBranchWithPage) });
  } catch (error) {
    console.error('Create wiki branch error:', error);
    res.status(500).json({ error: '创建分支失败' });
  }
});

app.get('/api/wiki/:slug/branches', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const page = await prisma.wikiPage.findUnique({ where: { slug: req.params.slug } });
    if (!page || !canViewWikiPage(page, req.authUser)) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    const where = isAdminRole(req.authUser!.role)
      ? { pageSlug: req.params.slug }
      : { pageSlug: req.params.slug, OR: [{ editorUid: req.authUser!.uid }, { status: 'pending_review' as WikiBranchStatus }, { status: 'conflict' as WikiBranchStatus }] };

    const branches = await prisma.wikiBranch.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        page: { select: { slug: true, title: true, category: true } },
      },
    });

    res.json({ branches: branches.map((branch) => toWikiBranchResponse(branch as WikiBranchWithPage)) });
  } catch (error) {
    console.error('Get wiki branches error:', error);
    res.status(500).json({ error: '获取分支失败' });
  }
});

app.get('/api/wiki/branches/mine', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const branches = await prisma.wikiBranch.findMany({
      where: {
        editorUid: req.authUser!.uid,
        status: { in: ['draft', 'pending_review', 'conflict'] },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        page: { select: { slug: true, title: true, category: true } },
      },
    });

    res.json({ branches: branches.map((branch) => toWikiBranchResponse(branch as WikiBranchWithPage)) });
  } catch (error) {
    console.error('Get my wiki branches error:', error);
    res.status(500).json({ error: '获取分支失败' });
  }
});

app.get('/api/wiki/branches/:branchId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const branch = await prisma.wikiBranch.findUnique({
      where: { id: req.params.branchId },
      include: {
        page: true,
      },
    });
    if (!branch || !branch.page || !canViewWikiPage(branch.page, req.authUser)) {
      res.status(404).json({ error: '分支未找到' });
      return;
    }
    if (!isAdminRole(req.authUser!.role) && branch.editorUid !== req.authUser!.uid && branch.status !== 'pending_review' && branch.status !== 'conflict') {
      res.status(403).json({ error: '无权访问该分支' });
      return;
    }

    const latestRevision = branch.latestRevisionId
      ? await prisma.wikiRevision.findUnique({ where: { id: branch.latestRevisionId } })
      : null;

    res.json({
      branch: toWikiBranchResponse(branch as WikiBranchWithPage),
      latestRevision: latestRevision
        ? {
            ...latestRevision,
            tags: serializeTags(latestRevision.tags),
            relations: serializeRelations(latestRevision.relations, latestRevision.pageSlug),
            createdAt: latestRevision.createdAt.toISOString(),
          }
        : null,
    });
  } catch (error) {
    console.error('Get wiki branch error:', error);
    res.status(500).json({ error: '获取分支失败' });
  }
});

app.get('/api/wiki/branches/:branchId/revisions', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const branch = await prisma.wikiBranch.findUnique({
      where: { id: req.params.branchId },
      include: { page: true },
    });
    if (!branch || !branch.page || !canViewWikiPage(branch.page, req.authUser)) {
      res.status(404).json({ error: '分支未找到' });
      return;
    }
    if (!isAdminRole(req.authUser!.role) && branch.editorUid !== req.authUser!.uid) {
      res.status(403).json({ error: '无权查看修订历史' });
      return;
    }

    const revisions = await prisma.wikiRevision.findMany({
      where: { branchId: branch.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({
      revisions: revisions.map((revision) => ({
        ...revision,
        tags: serializeTags(revision.tags),
        relations: serializeRelations(revision.relations, revision.pageSlug),
        createdAt: revision.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Get wiki branch revisions error:', error);
    res.status(500).json({ error: '获取分支版本失败' });
  }
});

app.post('/api/wiki/branches/:branchId/revisions', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const branch = await prisma.wikiBranch.findUnique({
      where: { id: req.params.branchId },
      include: { page: true },
    });
    if (!branch || !branch.page) {
      res.status(404).json({ error: '分支未找到' });
      return;
    }
    if (branch.editorUid !== req.authUser!.uid && !isAdminRole(req.authUser!.role)) {
      res.status(403).json({ error: '无权编辑该分支' });
      return;
    }

    const hasTagsInPayload = Object.prototype.hasOwnProperty.call(req.body, 'tags');
    const hasRelationsInPayload = Object.prototype.hasOwnProperty.call(req.body, 'relations');

    const {
      title,
      content,
      slug,
      category,
      tags,
      relations,
      eventDate,
      isAutoSave,
    } = req.body as {
      title?: string;
      content?: string;
      slug?: string;
      category?: string;
      tags?: string[];
      relations?: unknown;
      eventDate?: string | null;
      isAutoSave?: boolean;
    };

    if (!title || !content || !category) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    const baseRevision = branch.latestRevisionId
      ? await prisma.wikiRevision.findUnique({
          where: { id: branch.latestRevisionId },
          select: { tags: true, relations: true },
        })
      : null;
    const normalizedRelations = hasRelationsInPayload
      ? await normalizeWikiRelationListForWrite(relations, branch.pageSlug)
      : serializeRelations(baseRevision?.relations ?? branch.page.relations, branch.pageSlug);
    const normalizedTags = hasTagsInPayload
      ? (Array.isArray(tags) ? tags : [])
      : serializeTags(baseRevision?.tags ?? branch.page.tags);

    const revision = await prisma.wikiRevision.create({
      data: {
        pageSlug: branch.pageSlug,
        branchId: branch.id,
        title,
        content,
        slug: (slug || branch.pageSlug).trim().toLowerCase(),
        category,
        tags: normalizedTags,
        relations: normalizedRelations,
        eventDate: eventDate || null,
        editorUid: req.authUser!.uid,
        editorName: req.authUser!.displayName,
        isAutoSave: Boolean(isAutoSave),
      },
    });

    const hasOpenPr = await prisma.wikiPullRequest.findFirst({
      where: { branchId: branch.id, status: 'open' },
      select: { id: true },
    });

    const nextBranchStatus: WikiBranchStatus = hasOpenPr ? 'pending_review' : 'draft';
    await prisma.wikiBranch.update({
      where: { id: branch.id },
      data: {
        latestRevisionId: revision.id,
        status: branch.status === 'conflict' ? 'conflict' : nextBranchStatus,
      },
    });

    res.status(201).json({
      revision: {
        ...revision,
        tags: serializeTags(revision.tags),
        relations: serializeRelations(revision.relations, revision.pageSlug),
        createdAt: revision.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create wiki branch revision error:', error);
    res.status(500).json({ error: '保存分支版本失败' });
  }
});

app.post('/api/wiki/branches/:branchId/pull-request', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const branch = await prisma.wikiBranch.findUnique({
      where: { id: req.params.branchId },
      include: { page: true },
    });
    if (!branch || !branch.page) {
      res.status(404).json({ error: '分支未找到' });
      return;
    }
    if (branch.editorUid !== req.authUser!.uid && !isAdminRole(req.authUser!.role)) {
      res.status(403).json({ error: '无权提交该分支' });
      return;
    }
    if (!branch.latestRevisionId) {
      res.status(400).json({ error: '分支暂无可提交内容' });
      return;
    }

    const existingOpen = await prisma.wikiPullRequest.findFirst({ where: { branchId: branch.id, status: 'open' } });
    if (existingOpen) {
      res.json({ pullRequest: toWikiPullRequestResponse(existingOpen as WikiPullRequestWithRelations) });
      return;
    }

    const latestRevision = await prisma.wikiRevision.findUnique({ where: { id: branch.latestRevisionId } });
    if (!latestRevision) {
      res.status(400).json({ error: '分支最新版本不存在' });
      return;
    }

    const currentMainRevision = await prisma.wikiRevision.findFirst({
      where: { pageSlug: branch.pageSlug, branchId: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const payload = req.body as { title?: string; description?: string };
    const pr = await prisma.wikiPullRequest.create({
      data: {
        branchId: branch.id,
        pageSlug: branch.pageSlug,
        title: payload.title?.trim() || latestRevision.title,
        description: payload.description?.trim() || null,
        createdByUid: req.authUser!.uid,
        createdByName: req.authUser!.displayName,
        status: 'open',
        baseRevisionId: currentMainRevision?.id || null,
      },
    });

    await prisma.wikiBranch.update({
      where: { id: branch.id },
      data: { status: 'pending_review' },
    });

    res.status(201).json({ pullRequest: toWikiPullRequestResponse(pr as WikiPullRequestWithRelations) });
  } catch (error) {
    console.error('Create wiki pull request error:', error);
    res.status(500).json({ error: '提交 PR 失败' });
  }
});

app.get('/api/wiki/pull-requests/list', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const status = req.query.status === 'merged' || req.query.status === 'rejected' ? req.query.status : 'open';
    const where = isAdminRole(req.authUser!.role)
      ? { status: status as WikiPullRequestStatus }
      : { status: status as WikiPullRequestStatus, createdByUid: req.authUser!.uid };

    const pullRequests = await prisma.wikiPullRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        branch: {
          include: {
            page: { select: { slug: true, title: true, category: true } },
          },
        },
        page: { select: { slug: true, title: true, category: true } },
      },
      take: 200,
    });

    res.json({ pullRequests: pullRequests.map((pr) => toWikiPullRequestResponse(pr as WikiPullRequestWithRelations)) });
  } catch (error) {
    console.error('List wiki pull requests error:', error);
    res.status(500).json({ error: '获取 PR 列表失败' });
  }
});

app.get('/api/wiki/pull-requests/:prId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const pr = await prisma.wikiPullRequest.findUnique({
      where: { id: req.params.prId },
      include: {
        branch: {
          include: {
            page: { select: { slug: true, title: true, category: true } },
          },
        },
        page: { select: { slug: true, title: true, category: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!pr) {
      res.status(404).json({ error: 'PR 不存在' });
      return;
    }
    if (!isAdminRole(req.authUser!.role) && pr.createdByUid !== req.authUser!.uid) {
      res.status(403).json({ error: '无权查看该 PR' });
      return;
    }

    res.json({ pullRequest: toWikiPullRequestResponse(pr as WikiPullRequestWithRelations) });
  } catch (error) {
    console.error('Get wiki pull request error:', error);
    res.status(500).json({ error: '获取 PR 失败' });
  }
});

app.get('/api/wiki/pull-requests/:prId/diff', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const pr = await prisma.wikiPullRequest.findUnique({
      where: { id: req.params.prId },
      include: { branch: true, page: true },
    });
    if (!pr) {
      res.status(404).json({ error: 'PR 不存在' });
      return;
    }
    if (!isAdminRole(req.authUser!.role) && pr.createdByUid !== req.authUser!.uid) {
      res.status(403).json({ error: '无权查看该 PR' });
      return;
    }

    const [branchRevision, mainRevision] = await Promise.all([
      pr.branch.latestRevisionId ? prisma.wikiRevision.findUnique({ where: { id: pr.branch.latestRevisionId } }) : null,
      prisma.wikiRevision.findFirst({ where: { pageSlug: pr.pageSlug, branchId: null }, orderBy: { createdAt: 'desc' } }),
    ]);

    res.json({
      diff: {
        base: mainRevision
          ? {
              title: mainRevision.title,
              content: mainRevision.content,
              category: mainRevision.category || pr.page.category,
              tags: serializeTags(mainRevision.tags),
              relations: serializeRelations(mainRevision.relations, pr.pageSlug),
              eventDate: mainRevision.eventDate,
            }
          : {
              title: pr.page.title,
              content: pr.page.content,
              category: pr.page.category,
              tags: serializeTags(pr.page.tags),
              relations: serializeRelations(pr.page.relations, pr.page.slug),
              eventDate: pr.page.eventDate,
            },
        head: branchRevision
          ? {
              title: branchRevision.title,
              content: branchRevision.content,
              category: branchRevision.category || pr.page.category,
              tags: serializeTags(branchRevision.tags),
              relations: serializeRelations(branchRevision.relations, pr.pageSlug),
              eventDate: branchRevision.eventDate,
            }
          : {
              title: pr.page.title,
              content: pr.page.content,
              category: pr.page.category,
              tags: serializeTags(pr.page.tags),
              relations: serializeRelations(pr.page.relations, pr.page.slug),
              eventDate: pr.page.eventDate,
            },
      },
    });
  } catch (error) {
    console.error('Get wiki pull request diff error:', error);
    res.status(500).json({ error: '获取 PR Diff 失败' });
  }
});

app.post('/api/wiki/pull-requests/:prId/comments', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const pr = await prisma.wikiPullRequest.findUnique({ where: { id: req.params.prId } });
    if (!pr) {
      res.status(404).json({ error: 'PR 不存在' });
      return;
    }
    if (!isAdminRole(req.authUser!.role) && pr.createdByUid !== req.authUser!.uid) {
      res.status(403).json({ error: '无权评论该 PR' });
      return;
    }

    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!content) {
      res.status(400).json({ error: '评论内容不能为空' });
      return;
    }

    const comment = await prisma.wikiPullRequestComment.create({
      data: {
        prId: pr.id,
        authorUid: req.authUser!.uid,
        authorName: req.authUser!.displayName,
        content,
      },
    });

    res.status(201).json({
      comment: {
        ...comment,
        createdAt: comment.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create wiki PR comment error:', error);
    res.status(500).json({ error: '发表评论失败' });
  }
});

app.post('/api/wiki/pull-requests/:prId/merge', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const pr = await prisma.wikiPullRequest.findUnique({
      where: { id: req.params.prId },
      include: {
        branch: true,
        page: true,
      },
    });
    if (!pr) {
      res.status(404).json({ error: 'PR 不存在' });
      return;
    }
    if (pr.status !== 'open') {
      res.status(400).json({ error: '该 PR 已处理' });
      return;
    }
    if (!pr.branch.latestRevisionId) {
      res.status(400).json({ error: '分支没有可合并内容' });
      return;
    }

    const [headRevision, currentMainRevision] = await Promise.all([
      prisma.wikiRevision.findUnique({ where: { id: pr.branch.latestRevisionId } }),
      prisma.wikiRevision.findFirst({ where: { pageSlug: pr.pageSlug, branchId: null }, orderBy: { createdAt: 'desc' } }),
    ]);

    if (!headRevision) {
      res.status(400).json({ error: '分支版本不存在' });
      return;
    }

    if (pr.baseRevisionId && currentMainRevision && currentMainRevision.id !== pr.baseRevisionId) {
      const conflictData = {
        reason: 'base_mismatch',
        baseRevisionId: pr.baseRevisionId,
        currentMainRevisionId: currentMainRevision.id,
        detectedAt: new Date().toISOString(),
      };
      await prisma.$transaction([
        prisma.wikiBranch.update({ where: { id: pr.branchId }, data: { status: 'conflict' } }),
        prisma.wikiPullRequest.update({ where: { id: pr.id }, data: { conflictData } }),
      ]);
      res.status(409).json({ error: '检测到冲突，请先解决冲突后再合并', conflictData });
      return;
    }

    const mergedSnapshot = await prisma.wikiRevision.create({
      data: {
        pageSlug: pr.pageSlug,
        title: headRevision.title,
        content: headRevision.content,
        slug: headRevision.slug || pr.pageSlug,
        category: headRevision.category || pr.page.category,
        tags: headRevision.tags || [],
        relations: headRevision.relations || [],
        eventDate: headRevision.eventDate || null,
        editorUid: req.authUser!.uid,
        editorName: req.authUser!.displayName,
      },
    });

    const mergedAt = new Date();
    await prisma.$transaction([
      prisma.wikiPage.update({
        where: { slug: pr.pageSlug },
        data: {
          title: mergedSnapshot.title,
          content: mergedSnapshot.content,
          category: mergedSnapshot.category || pr.page.category,
          tags: mergedSnapshot.tags || [],
          relations: mergedSnapshot.relations || [],
          eventDate: mergedSnapshot.eventDate || null,
          status: 'published',
          reviewNote: null,
          reviewedBy: req.authUser!.uid,
          reviewedAt: mergedAt,
          lastEditorUid: req.authUser!.uid,
          lastEditorName: req.authUser!.displayName,
          mergedAt,
        },
      }),
      prisma.wikiBranch.update({
        where: { id: pr.branchId },
        data: {
          status: 'merged',
        },
      }),
      prisma.wikiPullRequest.update({
        where: { id: pr.id },
        data: {
          status: 'merged',
          reviewedBy: req.authUser!.uid,
          reviewedAt: mergedAt,
          mergedAt,
          conflictData: null,
        },
      }),
      prisma.moderationLog.create({
        data: {
          targetType: 'wiki',
          targetId: pr.pageSlug,
          action: 'approve',
          operatorUid: req.authUser!.uid,
          note: `Merge PR ${pr.id}`,
        },
      }),
    ]);

    const updatedPage = await prisma.wikiPage.findUnique({ where: { slug: pr.pageSlug } });
    res.json({ page: updatedPage ? toWikiResponse(updatedPage) : null });
  } catch (error) {
    console.error('Merge wiki PR error:', error);
    res.status(500).json({ error: '合并 PR 失败' });
  }
});

app.post('/api/wiki/pull-requests/:prId/reject', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const pr = await prisma.wikiPullRequest.findUnique({ where: { id: req.params.prId } });
    if (!pr) {
      res.status(404).json({ error: 'PR 不存在' });
      return;
    }
    if (pr.status !== 'open') {
      res.status(400).json({ error: '该 PR 已处理' });
      return;
    }

    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    const reviewedAt = new Date();
    await prisma.$transaction([
      prisma.wikiPullRequest.update({
        where: { id: pr.id },
        data: {
          status: 'rejected',
          reviewedBy: req.authUser!.uid,
          reviewedAt,
        },
      }),
      prisma.wikiBranch.update({
        where: { id: pr.branchId },
        data: { status: 'rejected' },
      }),
      prisma.moderationLog.create({
        data: {
          targetType: 'wiki',
          targetId: pr.pageSlug,
          action: 'reject',
          operatorUid: req.authUser!.uid,
          note: note || `Reject PR ${pr.id}`,
        },
      }),
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Reject wiki PR error:', error);
    res.status(500).json({ error: '驳回 PR 失败' });
  }
});

app.post('/api/wiki/branches/:branchId/resolve-conflict', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const branch = await prisma.wikiBranch.findUnique({ where: { id: req.params.branchId } });
    if (!branch) {
      res.status(404).json({ error: '分支未找到' });
      return;
    }

    const openPr = await prisma.wikiPullRequest.findFirst({
      where: { branchId: branch.id, status: 'open' },
      orderBy: { createdAt: 'desc' },
    });
    if (!openPr) {
      res.status(404).json({ error: '该分支没有待处理 PR' });
      return;
    }

    const allowed = isAdminRole(req.authUser!.role) || openPr.createdByUid === req.authUser!.uid;
    if (!allowed) {
      res.status(403).json({ error: '无权解决该冲突' });
      return;
    }

    const payload = req.body as {
      title?: string;
      content?: string;
      category?: string;
      tags?: string[];
      relations?: unknown;
      eventDate?: string | null;
    };
    if (!payload.title || !payload.content || !payload.category) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    const hasTagsInPayload = Object.prototype.hasOwnProperty.call(req.body, 'tags');
    const hasRelationsInPayload = Object.prototype.hasOwnProperty.call(req.body, 'relations');

    const baseRevision = branch.latestRevisionId
      ? await prisma.wikiRevision.findUnique({
          where: { id: branch.latestRevisionId },
          select: { tags: true, relations: true },
        })
      : null;

    const normalizedRelations = hasRelationsInPayload
      ? await normalizeWikiRelationListForWrite(payload.relations, branch.pageSlug)
      : serializeRelations(baseRevision?.relations, branch.pageSlug);
    const normalizedTags = hasTagsInPayload
      ? (Array.isArray(payload.tags) ? payload.tags : [])
      : serializeTags(baseRevision?.tags);

    const revision = await prisma.wikiRevision.create({
      data: {
        pageSlug: branch.pageSlug,
        branchId: branch.id,
        title: payload.title,
        content: payload.content,
        slug: branch.pageSlug,
        category: payload.category,
        tags: normalizedTags,
        relations: normalizedRelations,
        eventDate: payload.eventDate || null,
        editorUid: req.authUser!.uid,
        editorName: req.authUser!.displayName,
      },
    });

    const currentMainRevision = await prisma.wikiRevision.findFirst({
      where: { pageSlug: branch.pageSlug, branchId: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    await prisma.$transaction([
      prisma.wikiBranch.update({
        where: { id: branch.id },
        data: {
          latestRevisionId: revision.id,
          status: 'pending_review',
        },
      }),
      prisma.wikiPullRequest.update({
        where: { id: openPr.id },
        data: {
          conflictData: null,
          baseRevisionId: currentMainRevision?.id || null,
        },
      }),
    ]);

    res.json({
      revision: {
        ...revision,
        tags: serializeTags(revision.tags),
        relations: serializeRelations(revision.relations, revision.pageSlug),
        createdAt: revision.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Resolve wiki conflict error:', error);
    res.status(500).json({ error: '解决冲突失败' });
  }
});

app.post('/api/wiki/:slug/rollback/:revisionId', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const revision = await prisma.wikiRevision.findUnique({
      where: { id: req.params.revisionId },
    });
    if (!revision || revision.pageSlug !== req.params.slug) {
      res.status(404).json({ error: '历史版本不存在' });
      return;
    }

    const currentPage = await prisma.wikiPage.findUnique({
      where: { slug: req.params.slug },
      select: {
        slug: true,
        lastEditorUid: true,
      },
    });

    if (!currentPage) {
      res.status(404).json({ error: '页面未找到' });
      return;
    }

    if (!isAdminRole(req.authUser!.role) && currentPage.lastEditorUid !== req.authUser!.uid) {
      res.status(403).json({ error: '无权回滚该页面' });
      return;
    }

    const page = await prisma.wikiPage.update({
      where: { slug: req.params.slug },
      data: {
        title: revision.title,
        content: revision.content,
        category: revision.category || undefined,
        tags: revision.tags || undefined,
        relations: revision.relations || undefined,
        eventDate: revision.eventDate || undefined,
        status: isAdminRole(req.authUser!.role) ? 'published' : 'pending',
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        lastEditorUid: req.authUser!.uid,
        lastEditorName: req.authUser!.displayName,
      },
    });

    await prisma.moderationLog.create({
      data: {
        targetType: 'wiki',
        targetId: req.params.slug,
        action: 'rollback',
        operatorUid: req.authUser!.uid,
        note: `回滚到版本 ${req.params.revisionId}`,
      },
    });

    res.json({ page: toWikiResponse(page) });
  } catch (error) {
    console.error('Rollback wiki page error:', error);
    res.status(500).json({ error: '回滚失败' });
  }
});

app.post('/api/wiki/:slug/revisions', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, content } = req.body as {
      title?: string;
      content?: string;
    };

    if (!title || !content) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    const revision = await prisma.wikiRevision.create({
      data: {
        pageSlug: req.params.slug,
        title,
        content,
        editorUid: req.authUser!.uid,
        editorName: req.authUser!.displayName,
      },
    });

    res.status(201).json({
      revision: {
        ...revision,
        createdAt: revision.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create wiki revision error:', error);
    res.status(500).json({ error: '保存历史版本失败' });
  }
});

app.get('/api/posts', async (req: AuthenticatedRequest, res) => {
  try {
    const section = typeof req.query.section === 'string' ? req.query.section : 'all';
    const limit = Number(req.query.limit) || 100;
    const sort = parsePostSort(req.query.sort);
    const visibilityWhere = buildPostVisibilityWhere(req.authUser);
    const where = {
      ...(section !== 'all' ? { section } : {}),
      ...visibilityWhere,
    };

    let orderBy: Array<Record<string, 'asc' | 'desc'>>;
    if (sort === 'hot') {
      orderBy = [{ isPinned: 'desc' }, { hotScore: 'desc' }, { updatedAt: 'desc' }];
    } else if (sort === 'recommended') {
      orderBy = [{ isPinned: 'desc' }, { commentsCount: 'desc' }, { likesCount: 'desc' }, { updatedAt: 'desc' }];
    } else {
      orderBy = [{ isPinned: 'desc' }, { updatedAt: 'desc' }];
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy,
      take: Math.min(limit, 200),
    });

    if (sort !== 'latest' && posts.length) {
      const updates = posts
        .map((post) => ({
          id: post.id,
          hotScore: calculatePostHotScore(post),
        }))
        .filter((item) => Number.isFinite(item.hotScore));

      await Promise.all(
        updates.map((item) =>
          prisma.post.update({
            where: { id: item.id },
            data: { hotScore: item.hotScore },
          }),
        ),
      );
    }

    const likedPostSet = new Set<string>();
    const favoritedPostSet = new Set<string>();
    if (req.authUser && posts.length) {
      const [likedPosts, favoritedPosts] = await Promise.all([
        prisma.postLike.findMany({
          where: {
            userUid: req.authUser.uid,
            postId: { in: posts.map((item) => item.id) },
          },
          select: { postId: true },
        }),
        prisma.favorite.findMany({
          where: {
            userUid: req.authUser.uid,
            targetType: 'post',
            targetId: { in: posts.map((item) => item.id) },
          },
          select: { targetId: true },
        }),
      ]);
      likedPosts.forEach((item) => likedPostSet.add(item.postId));
      favoritedPosts.forEach((item) => favoritedPostSet.add(item.targetId));
    }

    res.json({
      posts: posts.map((post) => ({
        ...toPostResponse(post),
        likedByMe: likedPostSet.has(post.id),
        favoritedByMe: favoritedPostSet.has(post.id),
      })),
    });
  } catch (error) {
    console.error('Fetch posts error:', error);
    res.status(500).json({ error: '获取帖子失败' });
  }
});

app.get('/api/home/feed', async (req: AuthenticatedRequest, res) => {
  try {
    const visibilityWhere = buildPostVisibilityWhere(req.authUser);

    const [announcements, hotPosts, recentPosts] = await Promise.all([
      prisma.announcement.findMany({
        where: { active: true },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      prisma.post.findMany({
        where: { ...visibilityWhere, status: 'published' },
        orderBy: [{ hotScore: 'desc' }, { updatedAt: 'desc' }],
        take: 6,
      }),
      prisma.post.findMany({
        where: { ...visibilityWhere, status: 'published' },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    ]);

    const likedHotSet = new Set<string>();
    const favoritedHotSet = new Set<string>();
    if (req.authUser && hotPosts.length) {
      const [likedPosts, favoritedPosts] = await Promise.all([
        prisma.postLike.findMany({
          where: { userUid: req.authUser.uid, postId: { in: hotPosts.map((p) => p.id) } },
          select: { postId: true },
        }),
        prisma.favorite.findMany({
          where: { userUid: req.authUser.uid, targetType: 'post', targetId: { in: hotPosts.map((p) => p.id) } },
          select: { targetId: true },
        }),
      ]);
      likedPosts.forEach((item) => likedHotSet.add(item.postId));
      favoritedPosts.forEach((item) => favoritedHotSet.add(item.targetId));
    }

    res.json({
      announcements: announcements.map((a) => ({
        id: a.id,
        content: a.content,
        link: a.link,
        createdAt: a.createdAt.toISOString(),
      })),
      hotPosts: hotPosts.map((post) => ({
        ...toPostResponse(post),
        likedByMe: likedHotSet.has(post.id),
        favoritedByMe: favoritedHotSet.has(post.id),
      })),
      recentPosts: recentPosts.map(toPostResponse),
    });
  } catch (error) {
    console.error('Fetch home feed error:', error);
    res.status(500).json({ error: '获取首页信息失败' });
  }
});

app.get('/api/posts/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
    });

    if (!post || !canViewPost(post, req.authUser)) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    await prisma.$executeRaw`UPDATE "Post" SET "viewCount" = "viewCount" + 1 WHERE "id" = ${req.params.id}`;
    const freshPost = await prisma.post.findUnique({
      where: { id: req.params.id },
    });
    if (!freshPost) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    const hotScore = calculatePostHotScore(freshPost);
    await prisma.post.update({
      where: { id: req.params.id },
      data: { hotScore },
    });

    if (req.authUser) {
      await recordBrowsingHistory(req.authUser.uid, 'post', req.params.id);
    }

    const comments = await prisma.postComment.findMany({
      where: { postId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });

    const [likedByMe, favoritedByMe, dislikedByMe] = req.authUser
      ? await Promise.all([
          prisma.postLike.count({
            where: {
              postId: req.params.id,
              userUid: req.authUser.uid,
            },
          }).then((count) => count > 0),
          prisma.favorite.count({
            where: {
              targetType: 'post',
              targetId: req.params.id,
              userUid: req.authUser.uid,
            },
          }).then((count) => count > 0),
          prisma.postDislike.count({
            where: {
              postId: req.params.id,
              userUid: req.authUser.uid,
            },
          }).then((count) => count > 0),
        ])
      : [false, false, false];

    res.json({
      post: {
        ...toPostResponse({
          ...freshPost,
          hotScore,
        }),
        likedByMe,
        favoritedByMe,
        dislikedByMe,
      },
      comments: comments.map(toCommentResponse),
    });
  } catch (error) {
    console.error('Fetch post detail error:', error);
    res.status(500).json({ error: '获取帖子详情失败' });
  }
});

app.post('/api/posts', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, section, content, tags, status, musicDocId, albumDocId } = req.body as {
      title?: string;
      section?: string;
      content?: string;
      tags?: string[];
      status?: ContentStatus;
      musicDocId?: string;
      albumDocId?: string;
    };

    if (!title || !section || !content) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    const normalizedMusicDocId = normalizeOptionalDocId(musicDocId);
    const normalizedAlbumDocId = normalizeOptionalDocId(albumDocId);

    let finalSection = section;
    if (normalizedMusicDocId || normalizedAlbumDocId) {
      const musicSection = await prisma.section.findUnique({
        where: { id: MUSIC_SECTION_ID },
        select: { id: true },
      });
      if (!musicSection) {
        res.status(500).json({ error: '音乐版块不存在，请先在后台创建' });
        return;
      }
      finalSection = MUSIC_SECTION_ID;
    }

    if (finalSection !== section) {
      const sectionExists = await prisma.section.findUnique({
        where: { id: section },
        select: { id: true },
      });
      if (!sectionExists) {
        res.status(400).json({ error: '版块不存在' });
        return;
      }
    }

    const nextStatus = normalizePostWriteStatus(status, req.authUser!);

    const post = await prisma.post.create({
      data: {
        title,
        section: finalSection,
        content,
        tags: tags || [],
        status: nextStatus,
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        authorUid: req.authUser!.uid,
        musicDocId: normalizedMusicDocId,
        albumDocId: normalizedAlbumDocId,
      },
    });

    if (nextStatus === 'pending') {
      await prisma.moderationLog.create({
        data: {
          targetType: 'post',
          targetId: post.id,
          action: 'submit',
          operatorUid: req.authUser!.uid,
          note: null,
        },
      });
    }

    res.status(201).json({ post: toPostResponse(post) });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: '发布帖子失败' });
  }
});

app.post('/api/mp/posts', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, section, content, tags } = req.body as {
      title?: string;
      section?: string;
      content?: string;
      tags?: string[];
    };

    if (!title || !section || !content) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    const sectionExists = await prisma.section.findUnique({
      where: { id: section },
      select: { id: true },
    });
    if (!sectionExists) {
      res.status(400).json({ error: '版块不存在' });
      return;
    }

    const post = await prisma.post.create({
      data: {
        title,
        section,
        content,
        tags: tags || [],
        status: isAdminRole(req.authUser!.role) ? 'published' : 'pending',
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        authorUid: req.authUser!.uid,
      },
    });

    if (!isAdminRole(req.authUser!.role)) {
      await prisma.moderationLog.create({
        data: {
          targetType: 'post',
          targetId: post.id,
          action: 'submit',
          operatorUid: req.authUser!.uid,
          note: 'mp 端投稿',
        },
      });
    }

    res.status(201).json({
      post: {
        id: post.id,
        title: post.title,
        section: post.section,
        status: post.status,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create mp post error:', error);
    res.status(500).json({ error: '小程序发帖失败' });
  }
});

app.post('/api/posts/:id/comments', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { content, parentId } = req.body as {
      content?: string;
      parentId?: string | null;
    };

    if (!content || !content.trim()) {
      res.status(400).json({ error: '评论内容不能为空' });
      return;
    }

    const currentPost = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        status: true,
        authorUid: true,
      },
    });

    if (!currentPost || !canViewPost(currentPost, req.authUser)) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    if (currentPost.status !== 'published') {
      res.status(403).json({ error: '仅已发布内容可评论' });
      return;
    }

    let replyTargetUid: string | null = null;
    if (parentId) {
      const parent = await prisma.postComment.findUnique({
        where: { id: parentId },
        select: {
          id: true,
          postId: true,
          authorUid: true,
        },
      });
      if (!parent || parent.postId !== req.params.id) {
        res.status(400).json({ error: '回复目标不存在' });
        return;
      }
      replyTargetUid = parent.authorUid;
    }

    const comment = await prisma.postComment.create({
      data: {
        postId: req.params.id,
        authorUid: req.authUser!.uid,
        authorName: req.authUser!.displayName,
        authorPhoto: req.authUser!.photoURL,
        content,
        parentId: parentId || null,
      },
    });

    await prisma.post.update({
      where: { id: req.params.id },
      data: {
        commentsCount: { increment: 1 },
      },
    });

    const notifyUid = replyTargetUid || currentPost.authorUid;
    if (notifyUid && notifyUid !== req.authUser!.uid) {
      await createNotification(notifyUid, 'reply', {
        postId: req.params.id,
        commentId: comment.id,
        actorUid: req.authUser!.uid,
        actorName: req.authUser!.displayName,
        preview: comment.content.slice(0, 120),
      });
    }

    res.status(201).json({ comment: toCommentResponse(comment) });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: '发表评论失败' });
  }
});

app.post('/api/mp/comments', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { postId, content, parentId } = req.body as {
      postId?: string;
      content?: string;
      parentId?: string | null;
    };

    if (!postId || !content || !content.trim()) {
      res.status(400).json({ error: 'postId 和评论内容不能为空' });
      return;
    }

    const currentPost = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        status: true,
        authorUid: true,
      },
    });

    if (!currentPost || !canViewPost(currentPost, req.authUser)) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    if (currentPost.status !== 'published') {
      res.status(403).json({ error: '仅已发布内容可评论' });
      return;
    }

    let replyTargetUid: string | null = null;
    if (parentId) {
      const parent = await prisma.postComment.findUnique({
        where: { id: parentId },
        select: {
          id: true,
          postId: true,
          authorUid: true,
        },
      });
      if (!parent || parent.postId !== postId) {
        res.status(400).json({ error: '回复目标不存在' });
        return;
      }
      replyTargetUid = parent.authorUid;
    }

    const comment = await prisma.postComment.create({
      data: {
        postId,
        authorUid: req.authUser!.uid,
        authorName: req.authUser!.displayName,
        authorPhoto: req.authUser!.photoURL,
        content,
        parentId: parentId || null,
      },
    });

    await prisma.post.update({
      where: { id: postId },
      data: {
        commentsCount: { increment: 1 },
      },
    });

    const notifyUid = replyTargetUid || currentPost.authorUid;
    if (notifyUid && notifyUid !== req.authUser!.uid) {
      await createNotification(notifyUid, 'reply', {
        postId,
        commentId: comment.id,
        actorUid: req.authUser!.uid,
        actorName: req.authUser!.displayName,
        preview: comment.content.slice(0, 120),
      });
    }

    res.status(201).json({
      comment: {
        id: comment.id,
        postId: comment.postId,
        authorUid: comment.authorUid,
        authorName: comment.authorName,
        content: comment.content,
        parentId: comment.parentId,
        createdAt: comment.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create mp comment error:', error);
    res.status(500).json({ error: '小程序评论失败' });
  }
});

app.post('/api/posts/:id/submit', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const postId = req.params.id;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorUid: true,
        status: true,
      },
    });

    if (!post) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    const isOwner = post.authorUid === req.authUser!.uid;
    if (!isOwner && !isAdminRole(req.authUser!.role)) {
      res.status(403).json({ error: '无权提交该帖子' });
      return;
    }

    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        status: 'pending',
        reviewNote: note || null,
        reviewedBy: null,
        reviewedAt: null,
      },
    });

    await prisma.moderationLog.create({
      data: {
        targetType: 'post',
        targetId: postId,
        action: 'submit',
        operatorUid: req.authUser!.uid,
        note: note || null,
      },
    });

    res.json({ post: toPostResponse(updated) });
  } catch (error) {
    console.error('Submit post review error:', error);
    res.status(500).json({ error: '提交审核失败' });
  }
});

app.put('/api/posts/:id', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, section, content, tags, status, musicDocId, albumDocId } = req.body as {
      title?: string;
      section?: string;
      content?: string;
      tags?: string[];
      status?: ContentStatus;
      musicDocId?: string;
      albumDocId?: string;
    };

    if (!title || !section || !content) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    const normalizedMusicDocId = normalizeOptionalDocId(musicDocId);
    const normalizedAlbumDocId = normalizeOptionalDocId(albumDocId);

    const existingPost = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        authorUid: true,
        status: true,
      },
    });

    if (!existingPost) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    const isOwner = existingPost.authorUid === req.authUser!.uid;
    const isAdmin = isAdminRole(req.authUser!.role);
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: '无权编辑该帖子' });
      return;
    }

    let finalSection = section;
    if (normalizedMusicDocId || normalizedAlbumDocId) {
      const musicSection = await prisma.section.findUnique({
        where: { id: MUSIC_SECTION_ID },
        select: { id: true },
      });
      if (!musicSection) {
        res.status(500).json({ error: '音乐版块不存在，请先在后台创建' });
        return;
      }
      finalSection = MUSIC_SECTION_ID;
    }

    if (finalSection !== section) {
      const sectionExists = await prisma.section.findUnique({
        where: { id: section },
        select: { id: true },
      });
      if (!sectionExists) {
        res.status(400).json({ error: '版块不存在' });
        return;
      }
    }

    let nextStatus: ContentStatus;
    if (isAdmin) {
      nextStatus = parseContentStatus(status) || existingPost.status;
    } else if (existingPost.status === 'published') {
      nextStatus = 'pending';
    } else {
      const normalized = normalizePostWriteStatus(status ?? existingPost.status, req.authUser!);
      nextStatus = existingPost.status === 'pending' && normalized === 'draft' ? 'pending' : normalized;
    }

    const post = await prisma.post.update({
      where: { id: req.params.id },
      data: {
        title,
        section: finalSection,
        content,
        tags: Array.isArray(tags) ? tags : [],
        status: nextStatus,
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        musicDocId: normalizedMusicDocId,
        albumDocId: normalizedAlbumDocId,
      },
    });

    if (nextStatus === 'pending') {
      await prisma.moderationLog.create({
        data: {
          targetType: 'post',
          targetId: post.id,
          action: 'submit',
          operatorUid: req.authUser!.uid,
          note: !isAdmin && existingPost.status === 'published' ? '编辑后重新提交审核' : null,
        },
      });
    }

    res.json({ post: toPostResponse(post) });
  } catch (error) {
    console.error('Edit post error:', error);
    res.status(500).json({ error: '编辑帖子失败' });
  }
});

app.post('/api/posts/:id/like', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const postId = req.params.id;
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        status: true,
        authorUid: true,
      },
    });

    if (!post || !canViewPost(post, req.authUser)) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      try {
        await tx.postLike.create({
          data: {
            postId,
            userUid: req.authUser!.uid,
          },
        });
      } catch {
        return;
      }

      await tx.post.update({
        where: { id: postId },
        data: {
          likesCount: { increment: 1 },
        },
      });
    });

    const likesCount = await prisma.postLike.count({ where: { postId } });

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        likesCount,
      },
    });

    const hotScore = calculatePostHotScore(updatedPost);
    await prisma.post.update({
      where: { id: postId },
      data: { hotScore },
    });

    if (post.authorUid !== req.authUser!.uid) {
      await createNotification(post.authorUid, 'like', {
        postId,
        actorUid: req.authUser!.uid,
        actorName: req.authUser!.displayName,
      });
    }

    res.json({ liked: true, likesCount });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: '点赞失败' });
  }
});

app.delete('/api/posts/:id/like', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const postId = req.params.id;

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.postLike.deleteMany({
        where: {
          postId,
          userUid: req.authUser!.uid,
        },
      });

      if (!deleted.count) {
        return;
      }

      await tx.post.update({
        where: { id: postId },
        data: {
          likesCount: { decrement: 1 },
        },
      });
    });

    const likesCount = await prisma.postLike.count({ where: { postId } });
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        likesCount,
      },
    });

    const hotScore = calculatePostHotScore(updatedPost);
    await prisma.post.update({
      where: { id: postId },
      data: { hotScore },
    });

    res.json({ liked: false, likesCount });
  } catch (error) {
    console.error('Unlike post error:', error);
    res.status(500).json({ error: '取消点赞失败' });
  }
});

app.post('/api/posts/:id/dislike', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const postId = req.params.id;
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        status: true,
        authorUid: true,
      },
    });

    if (!post || !canViewPost(post, req.authUser)) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      try {
        await tx.postDislike.create({
          data: {
            postId,
            userUid: req.authUser!.uid,
          },
        });
      } catch {
        return;
      }

      await tx.post.update({
        where: { id: postId },
        data: {
          dislikesCount: { increment: 1 },
        },
      });
    });

    const dislikesCount = await prisma.postDislike.count({ where: { postId } });

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        dislikesCount,
      },
    });

    const hotScore = calculatePostHotScore(updatedPost);
    await prisma.post.update({
      where: { id: postId },
      data: { hotScore },
    });

    res.json({ disliked: true, dislikesCount });
  } catch (error) {
    console.error('Dislike post error:', error);
    res.status(500).json({ error: '踩失败' });
  }
});

app.delete('/api/posts/:id/dislike', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const postId = req.params.id;

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.postDislike.deleteMany({
        where: {
          postId,
          userUid: req.authUser!.uid,
        },
      });

      if (!deleted.count) {
        return;
      }

      await tx.post.update({
        where: { id: postId },
        data: {
          dislikesCount: { decrement: 1 },
        },
      });
    });

    const dislikesCount = await prisma.postDislike.count({ where: { postId } });
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        dislikesCount,
      },
    });

    const hotScore = calculatePostHotScore(updatedPost);
    await prisma.post.update({
      where: { id: postId },
      data: { hotScore },
    });

    res.json({ disliked: false, dislikesCount });
  } catch (error) {
    console.error('Undislike post error:', error);
    res.status(500).json({ error: '取消踩失败' });
  }
});

app.post('/api/favorites', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const targetType = parseFavoriteType(req.body?.targetType);
    const targetId = typeof req.body?.targetId === 'string' ? req.body.targetId.trim() : '';

    if (!targetType || !targetId) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    if (targetType === 'wiki') {
      const page = await prisma.wikiPage.findUnique({
        where: { slug: targetId },
        select: {
          slug: true,
          status: true,
          lastEditorUid: true,
        },
      });
      if (!page || !canViewWikiPage(page, req.authUser)) {
        res.status(404).json({ error: '目标不存在' });
        return;
      }
    }

    if (targetType === 'post') {
      const post = await prisma.post.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          status: true,
          authorUid: true,
        },
      });
      if (!post || !canViewPost(post, req.authUser)) {
        res.status(404).json({ error: '目标不存在' });
        return;
      }
    }

    if (targetType === 'music') {
      const song = await prisma.musicTrack.findUnique({
        where: { docId: targetId },
        select: { docId: true },
      });
      if (!song) {
        res.status(404).json({ error: '目标不存在' });
        return;
      }
    }

    await prisma.favorite.upsert({
      where: {
        userUid_targetType_targetId: {
          userUid: req.authUser!.uid,
          targetType,
          targetId,
        },
      },
      update: {},
      create: {
        userUid: req.authUser!.uid,
        targetType,
        targetId,
      },
    });

    if (targetType === 'wiki') {
      const count = await prisma.favorite.count({
        where: {
          targetType,
          targetId,
        },
      });
      await prisma.wikiPage.update({
        where: { slug: targetId },
        data: { favoritesCount: count },
      });
    }

    res.status(201).json({ favorited: true });
  } catch (error) {
    console.error('Create favorite error:', error);
    res.status(500).json({ error: '收藏失败' });
  }
});

app.delete('/api/favorites/:type/:id', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const targetType = parseFavoriteType(req.params.type);
    const targetId = req.params.id;

    if (!targetType || !targetId) {
      res.status(400).json({ error: '参数错误' });
      return;
    }

    await prisma.favorite.deleteMany({
      where: {
        userUid: req.authUser!.uid,
        targetType,
        targetId,
      },
    });

    if (targetType === 'wiki') {
      const count = await prisma.favorite.count({
        where: {
          targetType,
          targetId,
        },
      });
      await prisma.wikiPage.update({
        where: { slug: targetId },
        data: { favoritesCount: count },
      }).catch(() => undefined);
    }

    res.json({ favorited: false });
  } catch (error) {
    console.error('Delete favorite error:', error);
    res.status(500).json({ error: '取消收藏失败' });
  }
});

app.get('/api/users/me/favorites', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const rawType = req.query.type;
    const requestedType = parseFavoriteType(rawType);
    if (rawType !== undefined && rawType !== null && rawType !== '' && !requestedType) {
      res.status(400).json({ error: '无效收藏类型' });
      return;
    }
    const favorites = await prisma.favorite.findMany({
      where: {
        userUid: req.authUser!.uid,
        ...(requestedType ? { targetType: requestedType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const wikiIds = favorites.filter((item) => item.targetType === 'wiki').map((item) => item.targetId);
    const postIds = favorites.filter((item) => item.targetType === 'post').map((item) => item.targetId);
    const musicIds = favorites.filter((item) => item.targetType === 'music').map((item) => item.targetId);

    const [wikiPages, posts, songs] = await Promise.all([
      wikiIds.length
        ? prisma.wikiPage.findMany({ where: { slug: { in: wikiIds } } })
        : Promise.resolve([]),
      postIds.length
        ? prisma.post.findMany({ where: { id: { in: postIds } } })
        : Promise.resolve([]),
      musicIds.length
        ? prisma.musicTrack.findMany({ where: { docId: { in: musicIds } } })
        : Promise.resolve([]),
    ]);

    const wikiMap = new Map(wikiPages.map((item) => [item.slug, item]));
    const postMap = new Map(posts.map((item) => [item.id, item]));
    const songMap = new Map(songs.map((item) => [item.docId, item]));

    const items = favorites
      .map((favorite) => {
        const base = {
          id: favorite.id,
          targetType: favorite.targetType,
          targetId: favorite.targetId,
          createdAt: favorite.createdAt.toISOString(),
        };

        if (favorite.targetType === 'wiki') {
          const page = wikiMap.get(favorite.targetId);
          if (!page || !canViewWikiPage(page, req.authUser)) return null;
          return {
            ...base,
            target: toWikiResponse(page),
          };
        }

        if (favorite.targetType === 'post') {
          const post = postMap.get(favorite.targetId);
          if (!post || !canViewPost(post, req.authUser)) return null;
          return {
            ...base,
            target: toPostResponse(post),
          };
        }

        if (favorite.targetType === 'music') {
          const song = songMap.get(favorite.targetId);
          if (!song) return null;
          return {
            ...base,
            target: {
              ...song,
              createdAt: song.createdAt.toISOString(),
              updatedAt: song.updatedAt.toISOString(),
            },
          };
        }

        return null;
      })
      .filter(Boolean);

    res.json({ favorites: items });
  } catch (error) {
    console.error('Get my favorites error:', error);
    res.status(500).json({ error: '获取收藏失败' });
  }
});

app.get('/api/admin/review-queue', requireAdmin, async (req, res) => {
  try {
    const type = normalizeModerationTargetType(req.query.type);
    const status = parseContentStatus(req.query.status) || 'pending';

    if (!type) {
      res.status(400).json({ error: 'type 必须为 wiki 或 posts' });
      return;
    }

    if (type === 'wiki') {
      const items = await prisma.wikiPage.findMany({
        where: { status },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      });
      res.json({ type, status, items: items.map(toWikiResponse) });
      return;
    }

    const items = await prisma.post.findMany({
      where: { status },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    res.json({ type: 'posts', status, items: items.map(toPostResponse) });
  } catch (error) {
    console.error('Fetch review queue error:', error);
    res.status(500).json({ error: '获取审核队列失败' });
  }
});

app.post('/api/admin/review/:type/:id/approve', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetType = normalizeModerationTargetType(req.params.type);
    const targetId = req.params.id;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    if (!targetType) {
      res.status(400).json({ error: '无效审核类型' });
      return;
    }

    const reviewedAt = new Date();

    if (targetType === 'wiki') {
      const page = await prisma.wikiPage.update({
        where: { slug: targetId },
        data: {
          status: 'published',
          reviewNote: note || null,
          reviewedBy: req.authUser!.uid,
          reviewedAt,
        },
      });

      await prisma.moderationLog.create({
        data: {
          targetType: 'wiki',
          targetId,
          action: 'approve',
          operatorUid: req.authUser!.uid,
          note: note || null,
        },
      });

      if (page.lastEditorUid && page.lastEditorUid !== req.authUser!.uid) {
        await createNotification(page.lastEditorUid, 'review_result', {
          approved: true,
          targetType: 'wiki',
          targetId,
          title: page.title,
          note: note || null,
        });
      }

      res.json({ item: toWikiResponse(page) });
      return;
    }

    const post = await prisma.post.update({
      where: { id: targetId },
      data: {
        status: 'published',
        reviewNote: note || null,
        reviewedBy: req.authUser!.uid,
        reviewedAt,
      },
    });

    await prisma.moderationLog.create({
      data: {
        targetType: 'post',
        targetId,
        action: 'approve',
        operatorUid: req.authUser!.uid,
        note: note || null,
      },
    });

    if (post.authorUid && post.authorUid !== req.authUser!.uid) {
      await createNotification(post.authorUid, 'review_result', {
        approved: true,
        targetType: 'post',
        targetId,
        title: post.title,
        note: note || null,
      });
    }

    res.json({ item: toPostResponse(post) });
  } catch (error) {
    console.error('Approve review item error:', error);
    res.status(500).json({ error: '审核通过失败' });
  }
});

app.post('/api/admin/review/:type/:id/reject', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetType = normalizeModerationTargetType(req.params.type);
    const targetId = req.params.id;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    if (!targetType) {
      res.status(400).json({ error: '无效审核类型' });
      return;
    }

    const reviewedAt = new Date();
    const rejectNote = note || '内容未通过审核';

    if (targetType === 'wiki') {
      const page = await prisma.wikiPage.update({
        where: { slug: targetId },
        data: {
          status: 'rejected',
          reviewNote: rejectNote,
          reviewedBy: req.authUser!.uid,
          reviewedAt,
        },
      });

      await prisma.moderationLog.create({
        data: {
          targetType: 'wiki',
          targetId,
          action: 'reject',
          operatorUid: req.authUser!.uid,
          note: rejectNote,
        },
      });

      if (page.lastEditorUid && page.lastEditorUid !== req.authUser!.uid) {
        await createNotification(page.lastEditorUid, 'review_result', {
          approved: false,
          targetType: 'wiki',
          targetId,
          title: page.title,
          note: rejectNote,
        });
      }

      res.json({ item: toWikiResponse(page) });
      return;
    }

    const post = await prisma.post.update({
      where: { id: targetId },
      data: {
        status: 'rejected',
        reviewNote: rejectNote,
        reviewedBy: req.authUser!.uid,
        reviewedAt,
      },
    });

    await prisma.moderationLog.create({
      data: {
        targetType: 'post',
        targetId,
        action: 'reject',
        operatorUid: req.authUser!.uid,
        note: rejectNote,
      },
    });

    if (post.authorUid && post.authorUid !== req.authUser!.uid) {
      await createNotification(post.authorUid, 'review_result', {
        approved: false,
        targetType: 'post',
        targetId,
        title: post.title,
        note: rejectNote,
      });
    }

    res.json({ item: toPostResponse(post) });
  } catch (error) {
    console.error('Reject review item error:', error);
    res.status(500).json({ error: '驳回失败' });
  }
});

app.patch('/api/posts/:id', requireAdmin, async (req, res) => {
  try {
    const { commentsCount, likesCount, dislikesCount, status } = req.body as {
      commentsCount?: number;
      likesCount?: number;
      dislikesCount?: number;
      status?: ContentStatus;
    };

    const parsedStatus = parseContentStatus(status);

    const post = await prisma.post.update({
      where: { id: req.params.id },
      data: {
        commentsCount: typeof commentsCount === 'number' ? commentsCount : undefined,
        likesCount: typeof likesCount === 'number' ? likesCount : undefined,
        dislikesCount: typeof dislikesCount === 'number' ? dislikesCount : undefined,
        status: parsedStatus || undefined,
      },
    });

    res.json({ post: toPostResponse(post) });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: '更新帖子失败' });
  }
});

app.post('/api/posts/:id/pin', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const postId = req.params.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, isPinned: true },
    });

    if (!post) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { isPinned: true },
    });

    res.json({ isPinned: updatedPost.isPinned });
  } catch (error) {
    console.error('Pin post error:', error);
    res.status(500).json({ error: '置顶帖子失败' });
  }
});

app.delete('/api/posts/:id/pin', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const postId = req.params.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, isPinned: true },
    });

    if (!post) {
      res.status(404).json({ error: '帖子未找到' });
      return;
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { isPinned: false },
    });

    res.json({ isPinned: updatedPost.isPinned });
  } catch (error) {
    console.error('Unpin post error:', error);
    res.status(500).json({ error: '取消置顶失败' });
  }
});

app.delete('/api/posts/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.post.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: '删除帖子失败' });
  }
});

app.get('/api/galleries', async (req: AuthenticatedRequest, res) => {
  try {
    const visibilityWhere = req.authUser
      ? (isAdminRole(req.authUser.role)
          ? {}
          : {
              OR: [
                { published: true },
                { authorUid: req.authUser.uid },
              ],
            })
      : { published: true };

    const galleries = await prisma.gallery.findMany({
      where: visibilityWhere,
      include: {
        images: {
          include: {
            asset: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ galleries: galleries.map(toGalleryResponse) });
  } catch (error) {
    console.error('Fetch galleries error:', error);
    res.status(500).json({ error: '获取图集失败' });
  }
});

app.get('/api/galleries/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const gallery = await prisma.gallery.findUnique({
      where: { id: req.params.id },
      include: {
        images: {
          include: {
            asset: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!gallery) {
      res.status(404).json({ error: '图集不存在' });
      return;
    }

    if (!canViewGallery(gallery, req.authUser)) {
      res.status(403).json({ error: '该图集尚未发布' });
      return;
    }

    res.json({ gallery: toGalleryResponse(gallery) });
  } catch (error) {
    console.error('Fetch gallery detail error:', error);
    res.status(500).json({ error: '获取图集详情失败' });
  }
});

app.post('/api/uploads/sessions', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const requestedMaxFiles = parseInteger(req.body?.maxFiles, 50, { min: 1, max: 200 });
    const session = await prisma.uploadSession.create({
      data: {
        ownerUid: req.authUser!.uid,
        maxFiles: requestedMaxFiles,
        expiresAt: createUploadSessionExpiresAt(),
      },
    });

    res.status(201).json({ session: toUploadSessionResponse(session) });
  } catch (error) {
    console.error('Create upload session error:', error);
    res.status(500).json({ error: '创建上传会话失败' });
  }
});

app.get('/api/uploads/sessions/:id', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const session = await prisma.uploadSession.findUnique({
      where: { id: req.params.id },
    });

    if (!session || session.ownerUid !== req.authUser!.uid) {
      res.status(404).json({ error: '上传会话不存在' });
      return;
    }

    if (session.status === 'open' && isUploadSessionExpired(session.expiresAt)) {
      const expired = await prisma.uploadSession.update({
        where: { id: session.id },
        data: { status: 'expired' },
      });
      res.json({ session: toUploadSessionResponse(expired) });
      return;
    }

    res.json({ session: toUploadSessionResponse(session) });
  } catch (error) {
    console.error('Fetch upload session error:', error);
    res.status(500).json({ error: '获取上传会话失败' });
  }
});

app.post('/api/uploads/sessions/:id/files', requireAuth, requireActiveUser, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  const file = req.file;
  try {
    if (!file) {
      res.status(400).json({ error: '请选择文件' });
      return;
    }

    const session = await prisma.uploadSession.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        ownerUid: true,
        status: true,
        maxFiles: true,
        uploadedFiles: true,
        expiresAt: true,
      },
    });

    if (!session || session.ownerUid !== req.authUser!.uid) {
      await safeDeleteUploadFileByStorageKey(file.filename);
      res.status(404).json({ error: '上传会话不存在' });
      return;
    }

    if (session.status !== 'open') {
      await safeDeleteUploadFileByStorageKey(file.filename);
      res.status(400).json({ error: '上传会话不可用' });
      return;
    }

    if (isUploadSessionExpired(session.expiresAt)) {
      await prisma.uploadSession.update({
        where: { id: session.id },
        data: { status: 'expired' },
      });
      await safeDeleteUploadFileByStorageKey(file.filename);
      res.status(410).json({ error: '上传会话已过期，请重新创建' });
      return;
    }

    if (session.uploadedFiles >= session.maxFiles) {
      await safeDeleteUploadFileByStorageKey(file.filename);
      res.status(400).json({ error: '上传文件数量超过会话上限' });
      return;
    }

    let validatedMimeType: string;
    try {
      const result = await validateUploadedImage(file);
      validatedMimeType = result.mimeType;
    } catch (error) {
      await safeDeleteUploadFileByStorageKey(file.filename);
      res.status(400).json({ error: error instanceof Error ? error.message : '非法图片文件' });
      return;
    }

    const created = await prisma.$transaction(async (tx) => {
      const updatedSession = await tx.uploadSession.update({
        where: { id: session.id },
        data: {
          uploadedFiles: { increment: 1 },
        },
      });

      const asset = await tx.mediaAsset.create({
        data: {
          ownerUid: req.authUser!.uid,
          sessionId: session.id,
          storageKey: file.filename,
          publicUrl: buildUploadPublicUrl(file.filename),
          fileName: file.originalname,
          mimeType: validatedMimeType,
          sizeBytes: file.size,
          status: 'ready',
        },
      });

      return {
        updatedSession,
        asset,
      };
    });

    res.status(201).json({
      session: toUploadSessionResponse(created.updatedSession),
      asset: toMediaAssetResponse(created.asset),
    });
  } catch (error) {
    if (file?.filename) {
      await safeDeleteUploadFileByStorageKey(file.filename);
    }
    console.error('Upload session file error:', error);
    res.status(500).json({ error: '上传图片失败' });
  }
});

app.post('/api/uploads/sessions/:id/finalize', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const session = await prisma.uploadSession.findUnique({
      where: { id: req.params.id },
      include: {
        assets: {
          where: {
            ownerUid: req.authUser!.uid,
            status: 'ready',
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session || session.ownerUid !== req.authUser!.uid) {
      res.status(404).json({ error: '上传会话不存在' });
      return;
    }

    if (session.status === 'finalized') {
      res.json({
        session: toUploadSessionResponse(session),
        assets: session.assets.map(toMediaAssetResponse),
      });
      return;
    }

    if (session.status === 'expired' || isUploadSessionExpired(session.expiresAt)) {
      if (session.status !== 'expired') {
        await prisma.uploadSession.update({
          where: { id: session.id },
          data: { status: 'expired' },
        });
      }
      res.status(410).json({ error: '上传会话已过期，请重新上传' });
      return;
    }

    if (!session.assets.length) {
      res.status(400).json({ error: '请先上传至少一张图片' });
      return;
    }

    const finalized = await prisma.uploadSession.update({
      where: { id: session.id },
      data: { status: 'finalized' },
    });

    res.json({
      session: toUploadSessionResponse(finalized),
      assets: session.assets.map(toMediaAssetResponse),
    });
  } catch (error) {
    console.error('Finalize upload session error:', error);
    res.status(500).json({ error: '完成上传会话失败' });
  }
});

app.post('/api/uploads', requireAuth, requireActiveUser, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: '请选择文件' });
      return;
    }

    let mimeType = '';
    try {
      const validated = await validateUploadedImage(file);
      mimeType = validated.mimeType;
    } catch (error) {
      await safeDeleteUploadFileByStorageKey(file.filename);
      res.status(400).json({ error: error instanceof Error ? error.message : '非法图片文件' });
      return;
    }

    const asset = await prisma.mediaAsset.create({
      data: {
        ownerUid: req.authUser!.uid,
        storageKey: file.filename,
        publicUrl: buildUploadPublicUrl(file.filename),
        fileName: file.originalname,
        mimeType,
        sizeBytes: file.size,
        status: 'ready',
      },
    });

    res.status(201).json({
      file: {
        assetId: asset.id,
        storageKey: asset.storageKey,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        url: asset.publicUrl,
        name: file.originalname,
      },
    });
  } catch (error) {
    if (req.file?.filename) {
      await safeDeleteUploadFileByStorageKey(req.file.filename);
    }
    console.error('Upload file error:', error);
    res.status(500).json({ error: '上传文件失败' });
  }
});

app.post('/api/galleries/upload', requireAuth, requireActiveUser, upload.array('images', 50), async (req: AuthenticatedRequest, res) => {
  const files = req.files as Express.Multer.File[];
  const createdAssetIds: string[] = [];
  try {
    const title = typeof req.body.title === 'string' ? req.body.title : '';
    const description = typeof req.body.description === 'string' ? req.body.description : '';
    const tagsRaw = typeof req.body.tags === 'string' ? req.body.tags : '';
    const tags = tagsRaw
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (!files || files.length === 0) {
      res.status(400).json({ error: '请上传至少一张图片' });
      return;
    }

    const finalTitle = title || '默认图集';
    const validatedFiles = await Promise.all(
      files.map(async (file) => {
        const { mimeType } = await validateUploadedImage(file);
        const asset = await prisma.mediaAsset.create({
          data: {
            ownerUid: req.authUser!.uid,
            storageKey: file.filename,
            publicUrl: buildUploadPublicUrl(file.filename),
            fileName: file.originalname,
            mimeType,
            sizeBytes: file.size,
            status: 'ready',
          },
        });
        createdAssetIds.push(asset.id);
        return {
          file,
          asset,
        };
      }),
    );

    const gallery = await prisma.gallery.create({
      data: {
        title: finalTitle,
        description: description || `${finalTitle} 图集`,
        authorUid: req.authUser!.uid,
        authorName: req.authUser!.displayName,
        tags,
        images: {
          create: validatedFiles.map((entry, index) => ({
            assetId: entry.asset.id,
            url: entry.asset.publicUrl,
            name: entry.asset.fileName,
            sortOrder: index,
          })),
        },
      },
      include: {
        images: {
          include: {
            asset: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    try {
      await enqueueGalleryImageEmbeddings(
        prisma,
        gallery.images.map((image) => image.id),
      );
    } catch (error) {
      console.error('Enqueue gallery image embeddings error:', error);
    }

    res.status(201).json({ gallery: toGalleryResponse(gallery) });
  } catch (error) {
    if (createdAssetIds.length > 0) {
      await prisma.mediaAsset.deleteMany({
        where: {
          id: { in: createdAssetIds },
        },
      });
    }
    await Promise.all(
      files.map((file) => safeDeleteUploadFileByStorageKey(file.filename)),
    );
    console.error('Upload gallery error:', error);
    const message = error instanceof Error ? error.message : '';
    if (message.includes('图片') || message.includes('文件')) {
      res.status(400).json({ error: message });
      return;
    }
    res.status(500).json({ error: '上传图集失败' });
  }
});

app.post('/api/galleries', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, description, tags, images, assetIds, uploadSessionId, locationCode } = req.body as {
      title?: string;
      description?: string;
      tags?: string[];
      images?: { url: string; name: string }[];
      assetIds?: string[];
      uploadSessionId?: string;
      locationCode?: string;
    };

    const normalizedAssetIds = parseAssetIdList(assetIds);

    if (normalizedAssetIds.length > 0) {
      const finalTitle = typeof title === 'string' && title.trim() ? title.trim() : '默认图集';
      const finalDescription = typeof description === 'string' && description.trim()
        ? description.trim()
        : `${finalTitle} 图集`;
      const finalTags = normalizeTagList(tags);

      const assets = await prisma.mediaAsset.findMany({
        where: {
          id: { in: normalizedAssetIds },
          ownerUid: req.authUser!.uid,
          status: 'ready',
        },
        orderBy: { createdAt: 'asc' },
      });

      if (assets.length !== normalizedAssetIds.length) {
        res.status(400).json({ error: '包含无效或无权限的图片资源' });
        return;
      }

      if (uploadSessionId && typeof uploadSessionId === 'string') {
        const session = await prisma.uploadSession.findUnique({
          where: { id: uploadSessionId },
          select: {
            id: true,
            ownerUid: true,
            status: true,
            expiresAt: true,
          },
        });

        if (!session || session.ownerUid !== req.authUser!.uid) {
          res.status(400).json({ error: '上传会话不存在' });
          return;
        }

        if (session.status === 'expired' || isUploadSessionExpired(session.expiresAt)) {
          if (session.status !== 'expired') {
            await prisma.uploadSession.update({
              where: { id: session.id },
              data: { status: 'expired' },
            });
          }
          res.status(410).json({ error: '上传会话已过期，请重新上传' });
          return;
        }

        if (session.status !== 'finalized') {
          res.status(400).json({ error: '请先完成上传会话' });
          return;
        }
      }

      const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
      const orderedAssets = normalizedAssetIds
        .map((id) => assetsById.get(id))
        .filter((asset): asset is typeof assets[number] => Boolean(asset));

      const gallery = await prisma.gallery.create({
        data: {
          title: finalTitle,
          description: finalDescription,
          authorUid: req.authUser!.uid,
          authorName: req.authUser!.displayName,
          tags: finalTags,
          locationCode: locationCode || null,
          images: {
            create: orderedAssets.map((asset, index) => ({
              assetId: asset.id,
              url: asset.publicUrl,
              name: asset.fileName || `image-${index + 1}`,
              sortOrder: index,
            })),
          },
        },
        include: {
          images: {
            orderBy: { sortOrder: 'asc' },
            include: {
              asset: true,
            },
          },
        },
      });

      try {
        await enqueueGalleryImageEmbeddings(
          prisma,
          gallery.images.map((image) => image.id),
        );
      } catch (error) {
        console.error('Enqueue gallery image embeddings error:', error);
      }

      res.status(201).json({ gallery: toGalleryResponse(gallery) });
      return;
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      res.status(400).json({ error: '图集至少需要一张图片' });
      return;
    }

    const normalizedTitle = typeof title === 'string' && title.trim() ? title.trim() : '默认图集';
    const normalizedDescription = typeof description === 'string' && description.trim() ? description.trim() : '无描述';
    const normalizedTags = normalizeTagList(tags);

    const normalizedImages = images
      .map((image, index) => {
        if (!image || typeof image.url !== 'string') {
          return null;
        }
        const url = image.url.trim();
        if (!url || !url.startsWith('/uploads/')) {
          return null;
        }
        const fallbackName = `image-${index + 1}`;
        const name = typeof image.name === 'string' && image.name.trim() ? image.name.trim() : fallbackName;
        return {
          url,
          name,
        };
      })
      .filter((item): item is { url: string; name: string } => Boolean(item));

    if (!normalizedImages.length || normalizedImages.length !== images.length) {
      res.status(400).json({ error: '图片地址不合法，请重新上传' });
      return;
    }

    const fallbackAssets = await prisma.mediaAsset.findMany({
      where: {
        ownerUid: req.authUser!.uid,
        status: 'ready',
        publicUrl: {
          in: normalizedImages.map((item) => item.url),
        },
      },
      select: {
        id: true,
        publicUrl: true,
      },
    });
    const assetByUrl = new Map(fallbackAssets.map((item) => [item.publicUrl, item.id]));

    const gallery = await prisma.gallery.create({
      data: {
        title: normalizedTitle,
        description: normalizedDescription,
        authorUid: req.authUser!.uid,
        authorName: req.authUser!.displayName,
        tags: normalizedTags,
        locationCode: locationCode || null,
        images: {
          create: normalizedImages.map((image, index) => ({
            assetId: assetByUrl.get(image.url) || null,
            url: image.url,
            name: image.name,
            sortOrder: index,
          })),
        },
      },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
          include: {
            asset: true,
          },
        },
      },
    });

    try {
      await enqueueGalleryImageEmbeddings(
        prisma,
        gallery.images.map((image) => image.id),
      );
    } catch (error) {
      console.error('Enqueue gallery image embeddings error:', error);
    }

    res.status(201).json({ gallery: toGalleryResponse(gallery) });
  } catch (error) {
    console.error('Create gallery error:', error);
    res.status(500).json({ error: '创建图集失败' });
  }
});

app.patch('/api/galleries/:id', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const gallery = await prisma.gallery.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        authorUid: true,
      },
    });

    if (!gallery) {
      res.status(404).json({ error: '图集不存在' });
      return;
    }

    if (!canManageGallery(gallery, req.authUser)) {
      res.status(403).json({ error: '无权限编辑该图集' });
      return;
    }

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : undefined;
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : undefined;
    const tags = req.body?.tags !== undefined ? normalizeTagList(req.body.tags) : undefined;
    const locationCode = req.body?.locationCode !== undefined ? (typeof req.body.locationCode === 'string' && req.body.locationCode.length > 0 ? req.body.locationCode : null) : undefined;

    const data: {
      title?: string;
      description?: string;
      tags?: string[];
      locationCode?: string | null;
    } = {};

    if (title !== undefined && title.length > 0) {
      data.title = title;
    }
    if (description !== undefined) {
      data.description = description || '无描述';
    }
    if (tags !== undefined) {
      data.tags = tags;
    }
    if (locationCode !== undefined) {
      data.locationCode = locationCode;
    }

    if (!Object.keys(data).length) {
      res.status(400).json({ error: '没有可更新的字段' });
      return;
    }

    const updated = await prisma.gallery.update({
      where: { id: req.params.id },
      data,
      include: {
        images: {
          include: {
            asset: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    res.json({ gallery: toGalleryResponse(updated) });
  } catch (error) {
    console.error('Update gallery error:', error);
    res.status(500).json({ error: '更新图集失败' });
  }
});

app.patch('/api/galleries/:id/publish', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const gallery = await prisma.gallery.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        authorUid: true,
        published: true,
      },
    });

    if (!gallery) {
      res.status(404).json({ error: '图集不存在' });
      return;
    }

    if (!canManageGallery(gallery, req.authUser)) {
      res.status(403).json({ error: '无权限修改图集发布状态' });
      return;
    }

    const nextPublished = parseBoolean(req.body?.published, !gallery.published);
    const updated = await prisma.gallery.update({
      where: { id: req.params.id },
      data: {
        published: nextPublished,
        publishedAt: nextPublished ? new Date() : null,
      },
      include: {
        images: {
          include: {
            asset: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    res.json({ gallery: toGalleryResponse(updated) });
  } catch (error) {
    console.error('Update gallery publish status error:', error);
    res.status(500).json({ error: '修改图集发布状态失败' });
  }
});

app.post('/api/galleries/:id/images', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const gallery = await prisma.gallery.findUnique({
      where: { id: req.params.id },
      include: {
        images: {
          select: {
            id: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!gallery) {
      res.status(404).json({ error: '图集不存在' });
      return;
    }

    if (!canManageGallery(gallery, req.authUser)) {
      res.status(403).json({ error: '无权限编辑该图集' });
      return;
    }

    const assetIds = parseAssetIdList(req.body?.assetIds);
    if (!assetIds.length) {
      res.status(400).json({ error: '请提供至少一个图片资源' });
      return;
    }

    const uploadSessionId = typeof req.body?.uploadSessionId === 'string' ? req.body.uploadSessionId.trim() : '';
    if (uploadSessionId) {
      const session = await prisma.uploadSession.findUnique({
        where: { id: uploadSessionId },
        select: {
          id: true,
          ownerUid: true,
          status: true,
          expiresAt: true,
        },
      });
      if (!session || session.ownerUid !== req.authUser!.uid) {
        res.status(400).json({ error: '上传会话不存在' });
        return;
      }
      if (session.status === 'expired' || isUploadSessionExpired(session.expiresAt)) {
        if (session.status !== 'expired') {
          await prisma.uploadSession.update({
            where: { id: session.id },
            data: { status: 'expired' },
          });
        }
        res.status(410).json({ error: '上传会话已过期，请重新上传' });
        return;
      }
      if (session.status !== 'finalized') {
        res.status(400).json({ error: '请先完成上传会话' });
        return;
      }
    }

    const assets = await prisma.mediaAsset.findMany({
      where: {
        id: { in: assetIds },
        ownerUid: req.authUser!.uid,
        status: 'ready',
      },
      orderBy: { createdAt: 'asc' },
    });

    if (assets.length !== assetIds.length) {
      res.status(400).json({ error: '包含无效或无权限的图片资源' });
      return;
    }

    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
    const orderedAssets = assetIds
      .map((id) => assetMap.get(id))
      .filter((asset): asset is typeof assets[number] => Boolean(asset));
    const baseSortOrder = gallery.images.length
      ? Math.max(...gallery.images.map((item) => item.sortOrder)) + 1
      : 0;

    await prisma.gallery.update({
      where: { id: gallery.id },
      data: {
        images: {
          create: orderedAssets.map((asset, index) => ({
            assetId: asset.id,
            url: asset.publicUrl,
            name: asset.fileName || `image-${baseSortOrder + index + 1}`,
            sortOrder: baseSortOrder + index,
          })),
        },
      },
    });

    const updated = await prisma.gallery.findUnique({
      where: { id: gallery.id },
      include: {
        images: {
          include: {
            asset: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (updated) {
      try {
        await enqueueGalleryImageEmbeddings(
          prisma,
          updated.images.map((image) => image.id),
        );
      } catch (error) {
        console.error('Enqueue gallery image embeddings error:', error);
      }

      res.json({ gallery: toGalleryResponse(updated) });
      return;
    }

    res.status(404).json({ error: '图集不存在' });
  } catch (error) {
    console.error('Append gallery images error:', error);
    res.status(500).json({ error: '追加图集图片失败' });
  }
});

app.delete('/api/galleries/:id/images/:imageId', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const gallery = await prisma.gallery.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        authorUid: true,
      },
    });

    if (!gallery) {
      res.status(404).json({ error: '图集不存在' });
      return;
    }

    if (!canManageGallery(gallery, req.authUser)) {
      res.status(403).json({ error: '无权限编辑该图集' });
      return;
    }

    const image = await prisma.galleryImage.findUnique({
      where: { id: req.params.imageId },
      select: {
        id: true,
        galleryId: true,
        assetId: true,
        url: true,
      },
    });

    if (!image || image.galleryId !== gallery.id) {
      res.status(404).json({ error: '图片不存在' });
      return;
    }

    const imageCount = await prisma.galleryImage.count({ where: { galleryId: gallery.id } });
    if (imageCount <= 1) {
      res.status(400).json({ error: '图集至少需要保留一张图片' });
      return;
    }

    await prisma.galleryImage.delete({ where: { id: image.id } });

    if (image.assetId) {
      const linked = await prisma.galleryImage.count({ where: { assetId: image.assetId } });
      if (linked === 0) {
        const asset = await prisma.mediaAsset.findUnique({ where: { id: image.assetId } });
        if (asset) {
          await safeDeleteUploadFileByStorageKey(asset.storageKey);
          await prisma.mediaAsset.update({
            where: { id: asset.id },
            data: { status: 'deleted' },
          });
        }
      }
    } else {
      await safeDeleteUploadFileByUrl(image.url);
    }

    const remaining = await prisma.galleryImage.findMany({
      where: { galleryId: gallery.id },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });

    await Promise.all(
      remaining.map((item, index) =>
        prisma.galleryImage.update({
          where: { id: item.id },
          data: { sortOrder: index },
        }),
      ),
    );

    const updated = await prisma.gallery.findUnique({
      where: { id: gallery.id },
      include: {
        images: {
          include: {
            asset: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!updated) {
      res.status(404).json({ error: '图集不存在' });
      return;
    }

    res.json({ gallery: toGalleryResponse(updated) });
  } catch (error) {
    console.error('Delete gallery image error:', error);
    res.status(500).json({ error: '删除图集图片失败' });
  }
});

app.patch('/api/galleries/:id/images/reorder', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const gallery = await prisma.gallery.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        authorUid: true,
      },
    });

    if (!gallery) {
      res.status(404).json({ error: '图集不存在' });
      return;
    }

    if (!canManageGallery(gallery, req.authUser)) {
      res.status(403).json({ error: '无权限编辑该图集' });
      return;
    }

    const imageIdsRaw = Array.isArray(req.body?.imageIds) ? req.body.imageIds : [];
    const imageIds = imageIdsRaw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!imageIds.length) {
      res.status(400).json({ error: '请提供图片排序列表' });
      return;
    }

    const existing = await prisma.galleryImage.findMany({
      where: { galleryId: gallery.id },
      select: { id: true },
    });
    const existingIds = existing.map((item) => item.id);
    if (existingIds.length !== imageIds.length) {
      res.status(400).json({ error: '排序列表与当前图片数量不一致' });
      return;
    }
    const existingSet = new Set(existingIds);
    if (imageIds.some((id) => !existingSet.has(id))) {
      res.status(400).json({ error: '排序列表包含无效图片' });
      return;
    }

    await prisma.$transaction(
      imageIds.map((imageId, index) =>
        prisma.galleryImage.update({
          where: { id: imageId },
          data: { sortOrder: index },
        }),
      ),
    );

    const updated = await prisma.gallery.findUnique({
      where: { id: gallery.id },
      include: {
        images: {
          include: {
            asset: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!updated) {
      res.status(404).json({ error: '图集不存在' });
      return;
    }

    res.json({ gallery: toGalleryResponse(updated) });
  } catch (error) {
    console.error('Reorder gallery images error:', error);
    res.status(500).json({ error: '重排图集图片失败' });
  }
});

app.post('/api/admin/locks', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    await prisma.editLock.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    const collection = normalizeEditLockCollection(req.body?.collection);
    const recordId = normalizeEditLockRecordId(req.body?.recordId);
    if (!collection || !recordId) {
      res.status(400).json({ error: '缺少有效的锁定目标' });
      return;
    }

    const ttlMinutes = parseInteger(req.body?.ttlMinutes, 15, { min: 3, max: 120 });
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const force = parseBoolean(req.body?.force, false);

    const existing = await prisma.editLock.findUnique({
      where: {
        collection_recordId: {
          collection,
          recordId,
        },
      },
    });

    if (existing && existing.userId !== req.authUser!.uid) {
      const isExpired = existing.expiresAt.getTime() <= Date.now();
      if (!isExpired && !(force && isAdminRole(req.authUser!.role))) {
        res.status(409).json({
          error: '该记录正在被其他用户编辑',
          lock: toEditLockResponse(existing),
        });
        return;
      }

      const takenOver = await prisma.editLock.update({
        where: { id: existing.id },
        data: {
          userId: req.authUser!.uid,
          username: req.authUser!.displayName,
          expiresAt,
        },
      });

      res.json({ lock: toEditLockResponse(takenOver), acquired: true, takeover: true });
      return;
    }

    if (existing && existing.userId === req.authUser!.uid) {
      const renewed = await prisma.editLock.update({
        where: { id: existing.id },
        data: {
          username: req.authUser!.displayName,
          expiresAt,
        },
      });
      res.json({ lock: toEditLockResponse(renewed), acquired: true, renewed: true });
      return;
    }

    const created = await prisma.editLock.create({
      data: {
        collection,
        recordId,
        userId: req.authUser!.uid,
        username: req.authUser!.displayName,
        expiresAt,
      },
    });

    res.status(201).json({ lock: toEditLockResponse(created), acquired: true });
  } catch (error) {
    console.error('Acquire edit lock error:', error);
    res.status(500).json({ error: '申请编辑锁失败' });
  }
});

app.patch('/api/admin/locks/:id/renew', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const lock = await prisma.editLock.findUnique({ where: { id: req.params.id } });
    if (!lock) {
      res.status(404).json({ error: '编辑锁不存在' });
      return;
    }

    const canManage = lock.userId === req.authUser!.uid || isAdminRole(req.authUser!.role);
    if (!canManage) {
      res.status(403).json({ error: '无权限续期该编辑锁' });
      return;
    }

    const ttlMinutes = parseInteger(req.body?.ttlMinutes, 15, { min: 3, max: 120 });
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const renewed = await prisma.editLock.update({
      where: { id: lock.id },
      data: {
        expiresAt,
        username: lock.userId === req.authUser!.uid ? req.authUser!.displayName : lock.username,
      },
    });

    res.json({ lock: toEditLockResponse(renewed), renewed: true });
  } catch (error) {
    console.error('Renew edit lock error:', error);
    res.status(500).json({ error: '续期编辑锁失败' });
  }
});

app.get('/api/admin/locks', requireAdmin, async (_req, res) => {
  try {
    await prisma.editLock.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    const locks = await prisma.editLock.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 200,
    });

    res.json({ locks: locks.map(toEditLockResponse) });
  } catch (error) {
    console.error('Fetch edit locks error:', error);
    res.status(500).json({ error: '获取编辑锁列表失败' });
  }
});

app.delete('/api/admin/locks/:id', requireAuth, requireActiveUser, async (req: AuthenticatedRequest, res) => {
  try {
    const lock = await prisma.editLock.findUnique({ where: { id: req.params.id } });
    if (!lock) {
      res.json({ success: true });
      return;
    }

    const canManage = lock.userId === req.authUser!.uid || isAdminRole(req.authUser!.role);
    if (!canManage) {
      res.status(403).json({ error: '无权限释放该编辑锁' });
      return;
    }

    await prisma.editLock.delete({ where: { id: lock.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Release edit lock error:', error);
    res.status(500).json({ error: '释放编辑锁失败' });
  }
});

app.delete('/api/admin/locks/:collection/:recordId', requireAdmin, async (req, res) => {
  try {
    const collection = normalizeEditLockCollection(req.params.collection);
    const recordId = normalizeEditLockRecordId(req.params.recordId);
    if (!collection || !recordId) {
      res.status(400).json({ error: '缺少有效的锁定目标' });
      return;
    }

    await prisma.editLock.deleteMany({
      where: {
        collection,
        recordId,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Force release edit lock error:', error);
    res.status(500).json({ error: '强制释放编辑锁失败' });
  }
});

app.get('/api/admin/moderation_logs', requireAdmin, async (req, res) => {
  try {
    const logs = await prisma.moderationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        operator: {
          select: { uid: true, displayName: true, email: true },
        },
      },
    });

    res.json({
      logs: logs.map(log => ({
        id: log.id,
        targetType: log.targetType,
        targetId: log.targetId,
        action: log.action,
        operatorUid: log.operatorUid,
        operatorName: log.operator.displayName || log.operator.email || 'Unknown',
        note: log.note,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Fetch moderation logs error:', error);
    res.status(500).json({ error: '获取操作日志失败' });
  }
});

app.get('/api/admin/ban_logs', requireAdmin, async (req, res) => {
  try {
    const logs = await prisma.userBanLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        target: {
          select: { uid: true, displayName: true, email: true },
        },
        operator: {
          select: { uid: true, displayName: true, email: true },
        },
      },
    });

    res.json({
      logs: logs.map(log => ({
        id: log.id,
        targetUid: log.targetUid,
        targetName: log.target.displayName || log.target.email || 'Unknown',
        action: log.action,
        operatorUid: log.operatorUid,
        operatorName: log.operator.displayName || log.operator.email || 'Unknown',
        note: log.note,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Fetch ban logs error:', error);
    res.status(500).json({ error: '获取封禁日志失败' });
  }
});

app.delete('/api/galleries/:id', requireAdmin, async (req, res) => {
  try {
    const gallery = await prisma.gallery.findUnique({
      where: { id: req.params.id },
      include: {
        images: true,
      },
    });

    if (!gallery) {
      res.status(404).json({ error: '图集不存在' });
      return;
    }

    await prisma.gallery.delete({
      where: { id: req.params.id },
    });

    await Promise.all(
      gallery.images.map(async (image) => {
        if (image.assetId) {
          const linked = await prisma.galleryImage.count({ where: { assetId: image.assetId } });
          if (linked === 0) {
            const asset = await prisma.mediaAsset.findUnique({ where: { id: image.assetId } });
            if (asset) {
              await safeDeleteUploadFileByStorageKey(asset.storageKey);
              await prisma.mediaAsset.update({
                where: { id: asset.id },
                data: { status: 'deleted' },
              });
            }
          }
        } else {
          await safeDeleteUploadFileByUrl(image.url);
        }
      }),
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Delete gallery error:', error);
    res.status(500).json({ error: '删除图集失败' });
  }
});

app.get('/api/music', async (req: AuthenticatedRequest, res) => {
  try {
    const albumDocId = typeof req.query.albumDocId === 'string' ? req.query.albumDocId.trim() : '';
    const where = albumDocId
      ? {
          albumRelations: {
            some: {
              albumDocId,
            },
          },
        }
      : undefined;

    const songs = await fetchSongsWithRelations(where);

    const favoritedMusicSet = new Set<string>();
    if (req.authUser && songs.length) {
      const favorites = await prisma.favorite.findMany({
        where: {
          userUid: req.authUser.uid,
          targetType: 'music',
          targetId: { in: songs.map((song) => song.docId) },
        },
        select: { targetId: true },
      });
      favorites.forEach((item) => favoritedMusicSet.add(item.targetId));
    }

    res.json({
      songs: songs.map((song) => toSongResponse(song, { favoritedByMe: favoritedMusicSet.has(song.docId) })),
    });
  } catch (error) {
    console.error('Fetch music error:', error);
    res.status(500).json({ error: '获取音乐失败' });
  }
});

app.post('/api/music', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const artist = typeof body.artist === 'string' ? body.artist.trim() : '';
    const album = typeof body.album === 'string' ? body.album.trim() : '';
    const cover = typeof body.cover === 'string' ? body.cover.trim() : '';
    const audioUrl = typeof body.audioUrl === 'string' ? body.audioUrl.trim() : '';
    const lyric = typeof body.lyric === 'string' ? body.lyric : null;
    const primaryPlatform = parseMusicPlatform(body.primaryPlatform || body.platform) || 'netease';
    const enabledPlatform = parseMusicPlatform(body.enabledPlatform) || primaryPlatform;

    if (!id || !title || !artist) {
      res.status(400).json({ error: '缺少歌曲信息' });
      return;
    }

    const existing = await prisma.musicTrack.findUnique({ where: { id } });
    if (existing) {
      res.status(409).json({ error: '该歌曲已存在' });
      return;
    }

    const sourceField = getPlatformSourceField(primaryPlatform);
    const song = await prismaAny.musicTrack.create({
      data: {
        id,
        title,
        artist,
        album,
        cover,
        audioUrl,
        lyric,
        primaryPlatform,
        enabledPlatform,
        [sourceField]: id,
        addedBy: req.authUser!.uid,
      },
    });

    const hydrated = await fetchSongWithRelationsByDocId(song.docId);
    res.status(201).json({
      song: hydrated ? toSongResponse(hydrated) : song,
    });
  } catch (error) {
    console.error('Add music error:', error);
    res.status(500).json({ error: '添加歌曲失败' });
  }
});

app.post('/api/music/parse-url', requireAdmin, async (req, res) => {
  try {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!rawUrl) {
      res.status(400).json({ error: '请提供音乐链接' });
      return;
    }

    const parsed = parseMusicUrl(rawUrl);
    if (!parsed) {
      res.status(400).json({ error: '无法识别的音乐链接' });
      return;
    }

    const preview = await getMusicResourcePreview(parsed.platform, parsed.type, parsed.id);

    res.json({
      resource: {
        ...preview,
        totalSongs: preview.songs.length,
      },
    });
  } catch (error) {
    console.error('Parse music url error:', error);
    res.status(500).json({ error: '解析音乐链接失败' });
  }
});

app.post('/api/music/import', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!rawUrl) {
      res.status(400).json({ error: '请提供音乐链接' });
      return;
    }

    const parsed = parseMusicUrl(rawUrl);
    if (!parsed) {
      res.status(400).json({ error: '无法识别的音乐链接' });
      return;
    }

    const preview = await getMusicResourcePreview(parsed.platform, parsed.type, parsed.id);
    const selectedSongIdsRaw = Array.isArray(req.body?.selectedSongIds) ? req.body.selectedSongIds : [];
    const selectedSongIds = selectedSongIdsRaw
      .filter((item: unknown): item is string => typeof item === 'string')
      .map((item: string) => item.trim())
      .filter(Boolean);
    const selectedSet = selectedSongIds.length ? new Set(selectedSongIds) : null;

    const tracks = normalizeMusicImportTracks(preview.songs).filter((track) => {
      if (!selectedSet) return true;
      return selectedSet.has(track.sourceId);
    });

    if (!tracks.length) {
      res.status(400).json({ error: '没有可导入的歌曲' });
      return;
    }

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let linked = 0;

    const importedSongs: Array<{ songDocId: string; trackOrder: number }> = [];
    const linkedSongs: Array<{ docId: string; title: string; artist: string; platform: string }> = [];
    for (let index = 0; index < tracks.length; index += 1) {
      const track = tracks[index];
      try {
        const result = await createOrUpdateImportedSong({
          platform: preview.platform,
          track,
          userUid: req.authUser!.uid,
          albumNameFallback: preview.title,
        });
        if (result.created) {
          imported += 1;
        } else {
          skipped += 1;
        }
        if (result.linked) {
          linked += 1;
          linkedSongs.push({
            docId: result.song.docId,
            title: result.song.title,
            artist: result.song.artist,
            platform: preview.platform,
          });
        }
        importedSongs.push({ songDocId: result.song.docId, trackOrder: index });
      } catch (error) {
        failed += 1;
        console.error('Import single song failed:', error);
      }
    }

    let collection: { docId: string; title: string; resourceType: ParsedMusicResourceType } | null = null;
    if (parsed.type === 'album' || parsed.type === 'playlist') {
      const resourceType: MusicCollectionType = parsed.type === 'album' ? 'album' : 'playlist';
      const albumUniqueId = `${preview.platform}_${resourceType}_${preview.id}`;
      const existingAlbum = await prismaAny.album.findFirst({
        where: {
          platform: preview.platform,
          sourceId: preview.id,
          resourceType,
        },
      });

      const normalizedTracks = [
        {
          disc: 1,
          name: 'Disc 1',
          songs: importedSongs,
        },
      ];

      let albumDocId = '';
      if (existingAlbum) {
        const updated = await prismaAny.album.update({
          where: { docId: existingAlbum.docId },
          data: {
            title: preview.title,
            artist: preview.artist,
            cover: preview.cover || existingAlbum.cover,
            description: preview.description || null,
            platformUrl: preview.platformUrl || null,
            tracks: normalizedTracks,
          },
        });
        albumDocId = updated.docId;
      } else {
        const createdAlbum = await prismaAny.album.create({
          data: {
            id: albumUniqueId,
            resourceType,
            platform: preview.platform,
            sourceId: preview.id,
            title: preview.title,
            artist: preview.artist,
            cover: preview.cover || '',
            description: preview.description || null,
            platformUrl: preview.platformUrl || null,
            tracks: normalizedTracks,
          },
        });
        albumDocId = createdAlbum.docId;
      }

      await applyAlbumTracksToRelations(albumDocId, normalizeTrackDiscPayload(normalizedTracks));
      await prismaAny.songAlbumRelation.updateMany({
        where: {
          albumDocId,
          songDocId: { in: importedSongs.map((item) => item.songDocId) },
        },
        data: {
          isDisplay: false,
        },
      });
      if (importedSongs[0]?.songDocId) {
        await prismaAny.songAlbumRelation.updateMany({
          where: {
            albumDocId,
            songDocId: importedSongs[0].songDocId,
          },
          data: {
            isDisplay: true,
          },
        });
      }

      collection = {
        docId: albumDocId,
        title: preview.title,
        resourceType: parsed.type,
      };
    }

    res.json({
      summary: {
        imported,
        skipped,
        failed,
      },
      collection,
    });
  } catch (error) {
    console.error('Import music error:', error);
    res.status(500).json({ error: '导入音乐失败' });
  }
});

app.post('/api/music/from-netease', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const id = typeof req.body?.id === 'string' || typeof req.body?.id === 'number'
      ? String(req.body.id).trim()
      : '';
    if (!id) {
      res.status(400).json({ error: '歌曲 ID 不能为空' });
      return;
    }

    const preview = await getMusicResourcePreview('netease', 'song', id);
    const track = normalizeMusicImportTracks(preview.songs)[0];
    if (!track) {
      res.status(404).json({ error: '未找到可导入的歌曲' });
      return;
    }

    const result = await createOrUpdateImportedSong({
      platform: 'netease',
      track,
      userUid: req.authUser!.uid,
      albumNameFallback: preview.title,
    });

    const song = await fetchSongWithRelationsByDocId(result.song.docId);
    res.status(result.created ? 201 : 200).json({
      song: song ? toSongResponse(song) : result.song,
    });
  } catch (error) {
    console.error('Add song from netease failed:', error);
    res.status(500).json({ error: '添加歌曲失败' });
  }
});

app.post('/api/music/from-qq', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const id = typeof req.body?.id === 'string' || typeof req.body?.id === 'number'
      ? String(req.body.id).trim()
      : '';
    if (!id) {
      res.status(400).json({ error: '歌曲 ID 不能为空' });
      return;
    }

    const preview = await getMusicResourcePreview('tencent', 'song', id);
    const track = normalizeMusicImportTracks(preview.songs)[0];
    if (!track) {
      res.status(404).json({ error: '未找到可导入的歌曲' });
      return;
    }

    const result = await createOrUpdateImportedSong({
      platform: 'tencent',
      track,
      userUid: req.authUser!.uid,
      albumNameFallback: preview.title,
    });

    const song = await fetchSongWithRelationsByDocId(result.song.docId);
    res.status(result.created ? 201 : 200).json({
      song: song ? toSongResponse(song) : result.song,
    });
  } catch (error) {
    console.error('Add song from qq failed:', error);
    res.status(500).json({ error: '添加歌曲失败' });
  }
});

app.post('/api/music/from-kugou', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const id = typeof req.body?.id === 'string' || typeof req.body?.id === 'number'
      ? String(req.body.id).trim()
      : '';
    if (!id) {
      res.status(400).json({ error: '歌曲 ID 不能为空' });
      return;
    }

    const preview = await getMusicResourcePreview('kugou', 'song', id);
    const track = normalizeMusicImportTracks(preview.songs)[0];
    if (!track) {
      res.status(404).json({ error: '未找到可导入的歌曲' });
      return;
    }

    const result = await createOrUpdateImportedSong({
      platform: 'kugou',
      track,
      userUid: req.authUser!.uid,
      albumNameFallback: preview.title,
    });

    const song = await fetchSongWithRelationsByDocId(result.song.docId);
    res.status(result.created ? 201 : 200).json({
      song: song ? toSongResponse(song) : result.song,
    });
  } catch (error) {
    console.error('Add song from kugou failed:', error);
    res.status(500).json({ error: '添加歌曲失败' });
  }
});

app.post('/api/music/from-baidu', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const id = typeof req.body?.id === 'string' || typeof req.body?.id === 'number'
      ? String(req.body.id).trim()
      : '';
    if (!id) {
      res.status(400).json({ error: '歌曲 ID 不能为空' });
      return;
    }

    const preview = await getMusicResourcePreview('baidu', 'song', id);
    const track = normalizeMusicImportTracks(preview.songs)[0];
    if (!track) {
      res.status(404).json({ error: '未找到可导入的歌曲' });
      return;
    }

    const result = await createOrUpdateImportedSong({
      platform: 'baidu',
      track,
      userUid: req.authUser!.uid,
      albumNameFallback: preview.title,
    });

    const song = await fetchSongWithRelationsByDocId(result.song.docId);
    res.status(result.created ? 201 : 200).json({
      song: song ? toSongResponse(song) : result.song,
    });
  } catch (error) {
    console.error('Add song from baidu failed:', error);
    res.status(500).json({ error: '添加歌曲失败' });
  }
});

app.post('/api/music/from-kuwo', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const id = typeof req.body?.id === 'string' || typeof req.body?.id === 'number'
      ? String(req.body.id).trim()
      : '';
    if (!id) {
      res.status(400).json({ error: '歌曲 ID 不能为空' });
      return;
    }

    const preview = await getMusicResourcePreview('kuwo', 'song', id);
    const track = normalizeMusicImportTracks(preview.songs)[0];
    if (!track) {
      res.status(404).json({ error: '未找到可导入的歌曲' });
      return;
    }

    const result = await createOrUpdateImportedSong({
      platform: 'kuwo',
      track,
      userUid: req.authUser!.uid,
      albumNameFallback: preview.title,
    });

    const song = await fetchSongWithRelationsByDocId(result.song.docId);
    res.status(result.created ? 201 : 200).json({
      song: song ? toSongResponse(song) : result.song,
    });
  } catch (error) {
    console.error('Add song from kuwo failed:', error);
    res.status(500).json({ error: '添加歌曲失败' });
  }
});

app.get('/api/music/:docId/play-url', async (req, res) => {
  try {
    const song = await prismaAny.musicTrack.findUnique({
      where: { docId: req.params.docId },
      select: {
        docId: true,
        id: true,
        audioUrl: true,
        primaryPlatform: true,
        enabledPlatform: true,
        neteaseId: true,
        tencentId: true,
        kugouId: true,
        baiduId: true,
        kuwoId: true,
      },
    });

    if (!song) {
      res.status(404).json({ error: '歌曲不存在' });
      return;
    }

    const resolved = await resolveMusicPlayUrl(song);
    if (!resolved.playUrl) {
      res.status(502).json({ error: '未获取到可播放地址', meta: resolved });
      return;
    }

    res.json({
      docId: song.docId,
      ...resolved,
    });
  } catch (error) {
    console.error('Resolve play url error:', error);
    res.status(500).json({ error: '获取播放地址失败' });
  }
});

app.get('/api/music/:docId', async (req: AuthenticatedRequest, res) => {
  try {
    const identifier = req.params.docId;
    let song = await fetchSongWithRelationsByDocId(identifier);

    if (!song) {
      const matched = await prismaAny.musicTrack.findFirst({
        where: {
          OR: [
            { id: identifier },
            { neteaseId: identifier },
            { tencentId: identifier },
            { kugouId: identifier },
            { baiduId: identifier },
            { kuwoId: identifier },
          ],
        },
        select: { docId: true },
      });

      if (matched?.docId) {
        song = await fetchSongWithRelationsByDocId(matched.docId);
      }
    }

    if (!song) {
      res.status(404).json({ error: '歌曲不存在' });
      return;
    }

    const favoritedByMe = req.authUser
      ? Boolean(await prisma.favorite.findFirst({
          where: {
            userUid: req.authUser.uid,
            targetType: 'music',
            targetId: song.docId,
          },
          select: { id: true },
        }))
      : false;

    const responseSong = toSongResponse(song, { favoritedByMe });
    res.json({ song: responseSong });
  } catch (error) {
    console.error('Fetch song detail error:', error);
    res.status(500).json({ error: '获取歌曲详情失败' });
  }
});

app.delete('/api/music/:docId', requireAdmin, async (req, res) => {
  try {
    const docId = req.params.docId;
    const song = await prismaAny.musicTrack.findUnique({
      where: { docId },
      include: {
        covers: true,
      },
    });

    if (!song) {
      res.status(404).json({ error: '歌曲不存在' });
      return;
    }

    await prismaAny.songInstrumentalRelation.deleteMany({
      where: {
        OR: [{ songDocId: docId }, { targetSongDocId: docId }],
      },
    });

    await prismaAny.songAlbumRelation.deleteMany({ where: { songDocId: docId } });

    for (const cover of song.covers || []) {
      if (cover.assetId) {
        const [songLinked, albumLinked, galleryLinked] = await Promise.all([
          prismaAny.songCover.count({ where: { assetId: cover.assetId, id: { not: cover.id } } }),
          prismaAny.albumCover.count({ where: { assetId: cover.assetId } }),
          prisma.galleryImage.count({ where: { assetId: cover.assetId } }),
        ]);
        if (songLinked + albumLinked + galleryLinked === 0) {
          const asset = await prisma.mediaAsset.findUnique({ where: { id: cover.assetId } });
          if (asset) {
            await safeDeleteUploadFileByStorageKey(asset.storageKey);
            await prisma.mediaAsset.update({
              where: { id: asset.id },
              data: { status: 'deleted' },
            });
          }
        }
      } else {
        await safeDeleteUploadFileByStorageKey(cover.storageKey);
      }
    }

    await prismaAny.songCover.deleteMany({ where: { songDocId: docId } });
    await prisma.musicTrack.delete({ where: { docId } });

    for (const cacheKey of [...playUrlCache.keys()]) {
      if (cacheKey.startsWith(`${docId}:`)) {
        playUrlCache.delete(cacheKey);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete music error:', error);
    res.status(500).json({ error: '删除歌曲失败' });
  }
});

app.patch('/api/music/:docId', requireAdmin, async (req, res) => {
  try {
    const docId = req.params.docId;
    const existing = await prismaAny.musicTrack.findUnique({ where: { docId } });
    if (!existing) {
      res.status(404).json({ error: '歌曲不存在' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const updateData: Record<string, unknown> = {};

    if (typeof body.title === 'string') updateData.title = body.title.trim();
    if (typeof body.artist === 'string') updateData.artist = body.artist.trim();
    if (typeof body.album === 'string') updateData.album = body.album.trim();
    if (typeof body.cover === 'string') updateData.cover = body.cover.trim();
    if (typeof body.audioUrl === 'string') updateData.audioUrl = body.audioUrl.trim();
    if (typeof body.lyric === 'string' || body.lyric === null) updateData.lyric = body.lyric;

    const primaryPlatform = parseMusicPlatform(body.primaryPlatform);
    if (primaryPlatform) updateData.primaryPlatform = primaryPlatform;
    const enabledPlatform = parseMusicPlatform(body.enabledPlatform);
    if (enabledPlatform) updateData.enabledPlatform = enabledPlatform;

    const displayAlbumMode = parseDisplayAlbumMode(body.displayAlbumMode);
    if (displayAlbumMode) {
      updateData.displayAlbumMode = displayAlbumMode;
      if (displayAlbumMode !== 'manual') {
        updateData.manualAlbumName = null;
      }
    }
    if (typeof body.manualAlbumName === 'string') {
      updateData.manualAlbumName = body.manualAlbumName.trim();
    }
    if (typeof body.defaultCoverSource === 'string' || body.defaultCoverSource === null) {
      updateData.defaultCoverSource = body.defaultCoverSource;
    }

    const neteaseId = typeof body.neteaseId === 'string' ? body.neteaseId.trim() : '';
    const tencentId = typeof body.tencentId === 'string' ? body.tencentId.trim() : '';
    const kugouId = typeof body.kugouId === 'string' ? body.kugouId.trim() : '';
    const baiduId = typeof body.baiduId === 'string' ? body.baiduId.trim() : '';
    const kuwoId = typeof body.kuwoId === 'string' ? body.kuwoId.trim() : '';
    if (neteaseId) updateData.neteaseId = neteaseId;
    if (tencentId) updateData.tencentId = tencentId;
    if (kugouId) updateData.kugouId = kugouId;
    if (baiduId) updateData.baiduId = baiduId;
    if (kuwoId) updateData.kuwoId = kuwoId;

    const platformIdFields: Array<{ field: string; value: string }> = [];
    if (neteaseId) platformIdFields.push({ field: 'neteaseId', value: neteaseId });
    if (tencentId) platformIdFields.push({ field: 'tencentId', value: tencentId });
    if (kugouId) platformIdFields.push({ field: 'kugouId', value: kugouId });
    if (baiduId) platformIdFields.push({ field: 'baiduId', value: baiduId });
    if (kuwoId) platformIdFields.push({ field: 'kuwoId', value: kuwoId });

    if (platformIdFields.length > 0) {
      for (const { field, value } of platformIdFields) {
        if (!value) continue;
        const conflict = await prismaAny.musicTrack.findFirst({
          where: {
            docId: { not: docId },
            [field]: value,
          },
          select: { docId: true, title: true, artist: true },
        });
        if (conflict) {
          res.status(409).json({
            error: `该平台ID已被歌曲「${conflict.title}」使用`,
            conflict: true,
            conflictingSong: {
              docId: conflict.docId,
              title: conflict.title,
              artist: conflict.artist,
            },
          });
          return;
        }
      }
    }

    await prismaAny.musicTrack.update({
      where: { docId },
      data: updateData,
    });

    const song = await fetchSongWithRelationsByDocId(docId);
    if (!song) {
      res.status(404).json({ error: '歌曲不存在' });
      return;
    }

    res.json({ song: toSongResponse(song) });
  } catch (error) {
    console.error('Update music error:', error);
    res.status(500).json({ error: '更新歌曲失败' });
  }
});

app.get('/api/music/match-suggestions', async (req: AuthenticatedRequest, res) => {
  try {
    const platform = typeof req.query.platform === 'string' ? req.query.platform.trim() : '';
    const title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
    const artist = typeof req.query.artist === 'string' ? req.query.artist.trim() : '';
    const docId = typeof req.query.docId === 'string' ? req.query.docId.trim() : '';

    if (!platform || !title || !artist) {
      res.status(400).json({ error: '缺少必要参数：platform, title, artist' });
      return;
    }

    const validPlatforms = ['netease', 'tencent', 'kugou', 'baidu', 'kuwo'];
    if (!validPlatforms.includes(platform)) {
      res.status(400).json({ error: '无效的平台' });
      return;
    }

    const searchResults = await searchMusicResources({
      platform: platform as MusicPlatform,
      keyword: `${title} ${artist}`,
      type: 'song',
      limit: 10,
    });

    const normalizedTitle = title.toLowerCase().replace(/\s+/g, '');
    const normalizedArtist = artist.toLowerCase().replace(/\s+/g, '');

    const scored = searchResults
      .map((item) => {
        const itemTitleNorm = item.title.toLowerCase().replace(/\s+/g, '');
        const itemArtistNorm = item.artist.toLowerCase().replace(/\s+/g, '');
        const titleScore = calculateSimilarity(normalizedTitle, itemTitleNorm);
        const artistScore = calculateSimilarity(normalizedArtist, itemArtistNorm);
        const avgScore = (titleScore + artistScore) / 2;
        return { ...item, score: avgScore };
      })
      .filter((item) => item.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    let autoSelectedIndex: number | null = null;
    if (scored.length === 1 && scored[0].score >= 0.8) {
      autoSelectedIndex = 0;
    } else if (scored.length > 1 && scored[0].score >= 0.85 && scored[1].score < scored[0].score - 0.15) {
      autoSelectedIndex = 0;
    }

    const existingSongsByPlatformId = await prismaAny.musicTrack.findMany({
      where: {
        OR: scored.map((item) => {
          const field = getPlatformSourceField(platform as MusicPlatform);
          return { [field]: item.sourceId };
        }),
      },
      select: { docId: true, id: true, title: true, artist: true },
    });

    const existingMap = new Map<string, { docId: string; title: string; artist: string }>();
    for (const s of existingSongsByPlatformId) {
      existingMap.set(s.id, { docId: s.docId, title: s.title, artist: s.artist });
    }

    const suggestions = scored.map((item, index) => {
      const existing = existingMap.get(item.sourceId);
      return {
        sourceId: item.sourceId,
        title: item.title,
        artist: item.artist,
        album: item.album,
        cover: item.picId,
        sourceUrl: item.sourceUrl,
        score: Math.round(item.score * 100),
        isAutoSelected: index === autoSelectedIndex,
        alreadyLinked: existing ? { docId: existing.docId, title: existing.title } : null,
      };
    });

    res.json({ suggestions, autoSelectedIndex });
  } catch (error) {
    console.error('Match suggestions error:', error);
    res.status(500).json({ error: '搜索匹配歌曲失败' });
  }
});

function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen > 50) {
    return a.includes(b) || b.includes(a) ? 0.85 : 0;
  }

  const d = Math.max(a.length, b.length);
  let similarity = 0;

  if (d <= 200) {
    similarity = levenshteinSimilarity(a, b);
  } else {
    const aSub = a.slice(0, 50);
    const bSub = b.slice(0, 50);
    similarity = levenshteinSimilarity(aSub, bSub);
  }

  if (a.includes(b) || b.includes(a)) {
    similarity = Math.max(similarity, 0.85);
  }

  return similarity;
}

function levenshteinSimilarity(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  const distance = matrix[b.length][a.length];
  return 1 - distance / Math.max(a.length, b.length);
}

app.get('/api/music/:docId/covers', async (req, res) => {
  try {
    const song = await prismaAny.musicTrack.findUnique({
      where: { docId: req.params.docId },
      include: {
        covers: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!song) {
      res.status(404).json({ error: '歌曲不存在' });
      return;
    }

    res.json({
      covers: (song.covers || []).map((cover: any) => ({
        id: cover.id,
        assetId: cover.assetId,
        storageKey: cover.storageKey,
        url: cover.publicUrl,
        isDefault: cover.isDefault,
        sortOrder: cover.sortOrder,
      })),
    });
  } catch (error) {
    console.error('Fetch song covers error:', error);
    res.status(500).json({ error: '获取歌曲封面失败' });
  }
});

app.post('/api/music/:docId/covers', requireAdmin, async (req, res) => {
  try {
    const songDocId = req.params.docId;
    const assetId = typeof req.body?.assetId === 'string' ? req.body.assetId.trim() : '';
    const isDefault = parseBoolean(req.body?.isDefault, false);

    if (!assetId) {
      res.status(400).json({ error: '缺少 assetId' });
      return;
    }

    const song = await prismaAny.musicTrack.findUnique({ where: { docId: songDocId } });
    if (!song) {
      res.status(404).json({ error: '歌曲不存在' });
      return;
    }

    const cover = await addSongCoverFromAsset(songDocId, assetId, isDefault);
    if (isDefault) {
      await prismaAny.musicTrack.update({
        where: { docId: songDocId },
        data: {
          cover: cover.publicUrl,
        },
      });
    }

    res.status(201).json({
      cover: {
        id: cover.id,
        assetId: cover.assetId,
        storageKey: cover.storageKey,
        url: cover.publicUrl,
        isDefault: cover.isDefault,
        sortOrder: cover.sortOrder,
      },
    });
  } catch (error) {
    console.error('Create song cover error:', error);
    res.status(500).json({ error: '添加歌曲封面失败' });
  }
});

app.delete('/api/music/:docId/covers/:coverId', requireAdmin, async (req, res) => {
  try {
    const { docId, coverId } = req.params;
    const cover = await prismaAny.songCover.findFirst({
      where: {
        id: coverId,
        songDocId: docId,
      },
    });

    if (!cover) {
      res.status(404).json({ error: '封面不存在' });
      return;
    }

    await prismaAny.songCover.delete({ where: { id: cover.id } });

    if (cover.assetId) {
      const [songLinked, albumLinked, galleryLinked] = await Promise.all([
        prismaAny.songCover.count({ where: { assetId: cover.assetId } }),
        prismaAny.albumCover.count({ where: { assetId: cover.assetId } }),
        prisma.galleryImage.count({ where: { assetId: cover.assetId } }),
      ]);
      if (songLinked + albumLinked + galleryLinked === 0) {
        const asset = await prisma.mediaAsset.findUnique({ where: { id: cover.assetId } });
        if (asset) {
          await safeDeleteUploadFileByStorageKey(asset.storageKey);
          await prisma.mediaAsset.update({
            where: { id: asset.id },
            data: { status: 'deleted' },
          });
        }
      }
    }

    const remaining = await prismaAny.songCover.findMany({
      where: { songDocId: docId },
      orderBy: { sortOrder: 'asc' },
    });

    if (!remaining.length) {
      await prismaAny.musicTrack.update({
        where: { docId },
        data: {
          defaultCoverSource: null,
          cover: '',
        },
      });
    } else {
      const hasDefault = remaining.some((item: any) => item.isDefault);
      const first = remaining[0];
      if (!hasDefault) {
        await prismaAny.songCover.update({
          where: { id: first.id },
          data: { isDefault: true },
        });
        await prismaAny.musicTrack.update({
          where: { docId },
          data: {
            defaultCoverSource: `song_cover:${first.id}`,
            cover: first.publicUrl,
          },
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete song cover error:', error);
    res.status(500).json({ error: '删除歌曲封面失败' });
  }
});

app.patch('/api/music/:docId/covers/:coverId/default', requireAdmin, async (req, res) => {
  try {
    const { docId, coverId } = req.params;
    const cover = await prismaAny.songCover.findFirst({
      where: {
        id: coverId,
        songDocId: docId,
      },
    });
    if (!cover) {
      res.status(404).json({ error: '封面不存在' });
      return;
    }

    await prismaAny.songCover.updateMany({
      where: { songDocId: docId },
      data: { isDefault: false },
    });
    await prismaAny.songCover.update({
      where: { id: coverId },
      data: { isDefault: true },
    });
    await prismaAny.musicTrack.update({
      where: { docId },
      data: {
        defaultCoverSource: `song_cover:${coverId}`,
        cover: cover.publicUrl,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Set song default cover error:', error);
    res.status(500).json({ error: '设置默认封面失败' });
  }
});

app.get('/api/music/:docId/albums', async (req, res) => {
  try {
    const songDocId = req.params.docId;
    const relationsRaw = await prismaAny.songAlbumRelation.findMany({
      where: { songDocId },
      include: {
        album: {
          include: {
            covers: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
      orderBy: [{ discNumber: 'asc' }, { trackOrder: 'asc' }],
    });

    const relations = ensureDisplayRelation(relationsRaw);
    for (const relation of relations) {
      await prismaAny.songAlbumRelation.update({
        where: { id: relation.id },
        data: { isDisplay: relation.isDisplay },
      });
    }

    res.json({
      relations: relations.map((relation) => ({
        id: relation.id,
        songDocId: relation.songDocId,
        albumDocId: relation.albumDocId,
        discNumber: relation.discNumber,
        trackOrder: relation.trackOrder,
        isDisplay: relation.isDisplay,
        album: {
          docId: relation.album.docId,
          title: relation.album.title,
          artist: relation.album.artist,
          cover: relation.album.cover,
          defaultCoverSource: relation.album.defaultCoverSource,
        },
      })),
    });
  } catch (error) {
    console.error('Fetch song albums error:', error);
    res.status(500).json({ error: '获取歌曲关联专辑失败' });
  }
});

app.post('/api/music/:docId/albums', requireAdmin, async (req, res) => {
  try {
    const songDocId = req.params.docId;
    const albumDocId = typeof req.body?.albumDocId === 'string' ? req.body.albumDocId.trim() : '';
    const discNumber = parseInteger(req.body?.discNumber, 1, { min: 1, max: 20 });
    const trackOrder = parseInteger(req.body?.trackOrder, 0, { min: 0, max: 5000 });
    const isDisplay = parseBoolean(req.body?.isDisplay, false);

    if (!albumDocId) {
      res.status(400).json({ error: '缺少 albumDocId' });
      return;
    }

    const [song, album] = await Promise.all([
      prismaAny.musicTrack.findUnique({ where: { docId: songDocId } }),
      prismaAny.album.findUnique({ where: { docId: albumDocId } }),
    ]);

    if (!song || !album) {
      res.status(404).json({ error: '歌曲或专辑不存在' });
      return;
    }

    const relation = await prismaAny.songAlbumRelation.upsert({
      where: {
        songDocId_albumDocId: {
          songDocId,
          albumDocId,
        },
      },
      create: {
        songDocId,
        albumDocId,
        discNumber,
        trackOrder,
        isDisplay,
      },
      update: {
        discNumber,
        trackOrder,
        isDisplay,
      },
    });

    if (isDisplay) {
      await prismaAny.songAlbumRelation.updateMany({
        where: {
          songDocId,
          id: { not: relation.id },
        },
        data: { isDisplay: false },
      });
    }

    const tracksFromAlbum = await prismaAny.songAlbumRelation.findMany({
      where: { albumDocId },
      include: {
        song: {
          select: {
            docId: true,
            id: true,
            title: true,
            artist: true,
            cover: true,
          },
        },
      },
      orderBy: [{ discNumber: 'asc' }, { trackOrder: 'asc' }],
    });
    await prismaAny.album.update({
      where: { docId: albumDocId },
      data: {
        tracks: buildAlbumTracksPayload(tracksFromAlbum),
      },
    });

    const updatedSong = await fetchSongWithRelationsByDocId(songDocId);
    res.status(201).json({
      song: updatedSong ? toSongResponse(updatedSong) : null,
    });
  } catch (error) {
    console.error('Create song album relation error:', error);
    res.status(500).json({ error: '创建歌曲专辑关联失败' });
  }
});

app.patch('/api/music/:docId/albums/:albumDocId', requireAdmin, async (req, res) => {
  try {
    const { docId: songDocId, albumDocId } = req.params;
    const existing = await prismaAny.songAlbumRelation.findUnique({
      where: {
        songDocId_albumDocId: {
          songDocId,
          albumDocId,
        },
      },
    });

    if (!existing) {
      res.status(404).json({ error: '关联不存在' });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (req.body?.discNumber !== undefined) {
      updateData.discNumber = parseInteger(req.body.discNumber, existing.discNumber, { min: 1, max: 20 });
    }
    if (req.body?.trackOrder !== undefined) {
      updateData.trackOrder = parseInteger(req.body.trackOrder, existing.trackOrder, { min: 0, max: 5000 });
    }
    if (req.body?.isDisplay !== undefined) {
      updateData.isDisplay = parseBoolean(req.body.isDisplay, existing.isDisplay);
    }

    const updated = await prismaAny.songAlbumRelation.update({
      where: { id: existing.id },
      data: updateData,
    });

    if (updated.isDisplay) {
      await prismaAny.songAlbumRelation.updateMany({
        where: {
          songDocId,
          id: { not: updated.id },
        },
        data: { isDisplay: false },
      });
    }

    const tracksFromAlbum = await prismaAny.songAlbumRelation.findMany({
      where: { albumDocId },
      include: {
        song: {
          select: {
            docId: true,
            id: true,
            title: true,
            artist: true,
            cover: true,
          },
        },
      },
      orderBy: [{ discNumber: 'asc' }, { trackOrder: 'asc' }],
    });
    await prismaAny.album.update({
      where: { docId: albumDocId },
      data: {
        tracks: buildAlbumTracksPayload(tracksFromAlbum),
      },
    });

    const song = await fetchSongWithRelationsByDocId(songDocId);
    res.json({ song: song ? toSongResponse(song) : null });
  } catch (error) {
    console.error('Update song album relation error:', error);
    res.status(500).json({ error: '更新歌曲专辑关联失败' });
  }
});

app.delete('/api/music/:docId/albums/:albumDocId', requireAdmin, async (req, res) => {
  try {
    const { docId: songDocId, albumDocId } = req.params;
    const existing = await prismaAny.songAlbumRelation.findUnique({
      where: {
        songDocId_albumDocId: {
          songDocId,
          albumDocId,
        },
      },
    });

    if (!existing) {
      res.status(404).json({ error: '关联不存在' });
      return;
    }

    await prismaAny.songAlbumRelation.delete({ where: { id: existing.id } });

    const remaining = await prismaAny.songAlbumRelation.findMany({
      where: { songDocId },
      orderBy: [{ discNumber: 'asc' }, { trackOrder: 'asc' }],
    });
    if (remaining.length && !remaining.some((item: any) => item.isDisplay)) {
      await prismaAny.songAlbumRelation.update({
        where: { id: remaining[0].id },
        data: { isDisplay: true },
      });
    }

    const tracksFromAlbum = await prismaAny.songAlbumRelation.findMany({
      where: { albumDocId },
      include: {
        song: {
          select: {
            docId: true,
            id: true,
            title: true,
            artist: true,
            cover: true,
          },
        },
      },
      orderBy: [{ discNumber: 'asc' }, { trackOrder: 'asc' }],
    });
    await prismaAny.album.update({
      where: { docId: albumDocId },
      data: {
        tracks: buildAlbumTracksPayload(tracksFromAlbum),
      },
    });

    const song = await fetchSongWithRelationsByDocId(songDocId);
    res.json({ song: song ? toSongResponse(song) : null });
  } catch (error) {
    console.error('Delete song album relation error:', error);
    res.status(500).json({ error: '删除歌曲专辑关联失败' });
  }
});

app.get('/api/music/:docId/instrumentals', async (req, res) => {
  try {
    const docId = req.params.docId;
    const relations = await prismaAny.songInstrumentalRelation.findMany({
      where: {
        targetSongDocId: docId,
      },
      include: {
        song: {
          include: {
            covers: {
              orderBy: { sortOrder: 'asc' },
            },
            albumRelations: {
              include: {
                album: {
                  include: {
                    covers: {
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
              },
              orderBy: [{ discNumber: 'asc' }, { trackOrder: 'asc' }],
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      songs: relations.map((relation: any) => toSongResponse(relation.song)),
    });
  } catch (error) {
    console.error('Fetch song instrumentals error:', error);
    res.status(500).json({ error: '获取伴奏列表失败' });
  }
});

app.get('/api/music/:docId/instrumental-for', async (req, res) => {
  try {
    const docId = req.params.docId;
    const relations = await prismaAny.songInstrumentalRelation.findMany({
      where: {
        songDocId: docId,
      },
      include: {
        targetSong: {
          include: {
            covers: {
              orderBy: { sortOrder: 'asc' },
            },
            albumRelations: {
              include: {
                album: {
                  include: {
                    covers: {
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
              },
              orderBy: [{ discNumber: 'asc' }, { trackOrder: 'asc' }],
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      songs: relations.map((relation: any) => toSongResponse(relation.targetSong)),
    });
  } catch (error) {
    console.error('Fetch instrumental for error:', error);
    res.status(500).json({ error: '获取伴奏关联失败' });
  }
});

app.post('/api/music/:docId/instrumentals', requireAdmin, async (req, res) => {
  try {
    const targetSongDocId = req.params.docId;
    const instrumentalSongDocId =
      typeof req.body?.instrumentalSongDocId === 'string'
        ? req.body.instrumentalSongDocId.trim()
        : typeof req.body?.songDocId === 'string'
          ? req.body.songDocId.trim()
          : '';

    if (!instrumentalSongDocId) {
      res.status(400).json({ error: '缺少伴奏歌曲 ID' });
      return;
    }
    if (instrumentalSongDocId === targetSongDocId) {
      res.status(400).json({ error: '不能将歌曲自身设为伴奏' });
      return;
    }

    const [targetSong, instrumentalSong] = await Promise.all([
      prismaAny.musicTrack.findUnique({ where: { docId: targetSongDocId } }),
      prismaAny.musicTrack.findUnique({ where: { docId: instrumentalSongDocId } }),
    ]);
    if (!targetSong || !instrumentalSong) {
      res.status(404).json({ error: '歌曲不存在' });
      return;
    }

    await prismaAny.songInstrumentalRelation.upsert({
      where: {
        songDocId_targetSongDocId: {
          songDocId: instrumentalSongDocId,
          targetSongDocId,
        },
      },
      update: {},
      create: {
        songDocId: instrumentalSongDocId,
        targetSongDocId,
      },
    });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Create instrumental relation error:', error);
    res.status(500).json({ error: '创建伴奏关联失败' });
  }
});

app.delete('/api/music/:docId/instrumentals/:instrumentalSongDocId', requireAdmin, async (req, res) => {
  try {
    const targetSongDocId = req.params.docId;
    const instrumentalSongDocId = req.params.instrumentalSongDocId;

    await prismaAny.songInstrumentalRelation.deleteMany({
      where: {
        songDocId: instrumentalSongDocId,
        targetSongDocId,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete instrumental relation error:', error);
    res.status(500).json({ error: '删除伴奏关联失败' });
  }
});

app.get('/api/music/:docId/posts', async (req: AuthenticatedRequest, res) => {
  try {
    const docId = req.params.docId;
    const limit = parseInteger(req.query.limit, 20, { min: 1, max: 100 });
    const sort = parsePostSort(req.query.sort);
    const visibilityWhere = buildPostVisibilityWhere(req.authUser);

    const where = {
      musicDocId: docId,
      ...visibilityWhere,
    };

    let orderBy: Array<Record<string, 'asc' | 'desc'>>;
    if (sort === 'hot') {
      orderBy = [{ hotScore: 'desc' }, { updatedAt: 'desc' }];
    } else if (sort === 'recommended') {
      orderBy = [{ commentsCount: 'desc' }, { likesCount: 'desc' }, { updatedAt: 'desc' }];
    } else {
      orderBy = [{ updatedAt: 'desc' }];
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy,
      take: limit,
    });

    const likedPostSet = new Set<string>();
    const favoritedPostSet = new Set<string>();
    if (req.authUser && posts.length) {
      const [likedPosts, favoritedPosts] = await Promise.all([
        prisma.postLike.findMany({
          where: {
            userUid: req.authUser.uid,
            postId: { in: posts.map((item) => item.id) },
          },
          select: { postId: true },
        }),
        prisma.favorite.findMany({
          where: {
            userUid: req.authUser.uid,
            targetType: 'post',
            targetId: { in: posts.map((item) => item.id) },
          },
          select: { targetId: true },
        }),
      ]);
      likedPosts.forEach((item) => likedPostSet.add(item.postId));
      favoritedPosts.forEach((item) => favoritedPostSet.add(item.targetId));
    }

    res.json({
      posts: posts.map((post) => ({
        ...toPostResponse(post),
        likedByMe: likedPostSet.has(post.id),
        favoritedByMe: favoritedPostSet.has(post.id),
      })),
    });
  } catch (error) {
    console.error('Fetch music posts error:', error);
    res.status(500).json({ error: '获取音乐关联帖子失败' });
  }
});

app.get('/api/albums', async (req: AuthenticatedRequest, res) => {
  try {
    const platform = parseMusicPlatform(req.query.platform);
    const resourceType = parseMusicCollectionType(req.query.resourceType);

    const albums = await prismaAny.album.findMany({
      where: {
        ...(platform ? { platform } : {}),
        ...(resourceType ? { resourceType } : {}),
      },
      include: {
        covers: {
          orderBy: { sortOrder: 'asc' },
        },
        songRelations: {
          include: {
            song: {
              select: {
                docId: true,
                id: true,
                title: true,
                artist: true,
                cover: true,
              },
            },
          },
          orderBy: [{ discNumber: 'asc' }, { trackOrder: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      albums: albums.map((album: any) => {
        const response = toAlbumResponse(album);
        return {
          ...response,
          tracks: response.tracks,
          trackCount: response.songs.length,
        };
      }),
    });
  } catch (error) {
    console.error('Fetch albums error:', error);
    res.status(500).json({ error: '获取专辑失败' });
  }
});

app.get('/api/albums/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const identifier = req.params.id;
    let album = await prismaAny.album.findUnique({
      where: { docId: identifier },
      include: {
        covers: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!album) {
      album = await prismaAny.album.findUnique({
        where: { id: identifier },
        include: {
          covers: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
    }

    if (!album) {
      res.status(404).json({ error: '专辑不存在' });
      return;
    }

    const relations = await prismaAny.songAlbumRelation.findMany({
      where: { albumDocId: album.docId },
      include: {
        song: {
          include: {
            covers: {
              orderBy: { sortOrder: 'asc' },
            },
            albumRelations: {
              include: {
                album: {
                  include: {
                    covers: {
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
              },
              orderBy: [{ discNumber: 'asc' }, { trackOrder: 'asc' }],
            },
          },
        },
      },
      orderBy: [{ discNumber: 'asc' }, { trackOrder: 'asc' }],
    });

    const favoritedMusicSet = new Set<string>();
    if (req.authUser && relations.length) {
      const favorites = await prisma.favorite.findMany({
        where: {
          userUid: req.authUser.uid,
          targetType: 'music',
          targetId: { in: relations.map((item: any) => item.songDocId) },
        },
        select: { targetId: true },
      });
      favorites.forEach((item) => favoritedMusicSet.add(item.targetId));
    }

    const tracks = relations.map((relation: any) => ({
      ...toSongResponse(relation.song, { favoritedByMe: favoritedMusicSet.has(relation.songDocId) }),
      trackOrder: relation.trackOrder,
      discNumber: relation.discNumber,
    }));

    const albumResponse = toAlbumResponse({
      ...album,
      songRelations: relations,
    });

    const coverFromDefault = (() => {
      const source = typeof album.defaultCoverSource === 'string' ? album.defaultCoverSource.trim() : '';
      if (!source) return '';
      if (source === 'old_cover') return album.cover || '';
      if (source.startsWith('album_cover:')) {
        const id = source.slice('album_cover:'.length);
        const matched = (album.covers || []).find((cover: any) => cover.id === id);
        return matched?.publicUrl || '';
      }
      return '';
    })();

    res.json({
      album: {
        ...albumResponse,
        id: album.docId,
        cover: coverFromDefault || album.cover,
        tracks,
        discs: normalizeTrackDiscPayload(album.tracks),
      },
    });
  } catch (error) {
    console.error('Fetch album detail error:', error);
    res.status(500).json({ error: '获取专辑详情失败' });
  }
});

app.get('/api/albums/:id/posts', async (req: AuthenticatedRequest, res) => {
  try {
    const docId = req.params.id;
    const limit = parseInteger(req.query.limit, 20, { min: 1, max: 100 });
    const sort = parsePostSort(req.query.sort);
    const visibilityWhere = buildPostVisibilityWhere(req.authUser);

    const where = {
      albumDocId: docId,
      ...visibilityWhere,
    };

    let orderBy: Array<Record<string, 'asc' | 'desc'>>;
    if (sort === 'hot') {
      orderBy = [{ hotScore: 'desc' }, { updatedAt: 'desc' }];
    } else if (sort === 'recommended') {
      orderBy = [{ commentsCount: 'desc' }, { likesCount: 'desc' }, { updatedAt: 'desc' }];
    } else {
      orderBy = [{ updatedAt: 'desc' }];
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy,
      take: limit,
    });

    const likedPostSet = new Set<string>();
    const favoritedPostSet = new Set<string>();
    if (req.authUser && posts.length) {
      const [likedPosts, favoritedPosts] = await Promise.all([
        prisma.postLike.findMany({
          where: {
            userUid: req.authUser.uid,
            postId: { in: posts.map((item) => item.id) },
          },
          select: { postId: true },
        }),
        prisma.favorite.findMany({
          where: {
            userUid: req.authUser.uid,
            targetType: 'post',
            targetId: { in: posts.map((item) => item.id) },
          },
          select: { targetId: true },
        }),
      ]);
      likedPosts.forEach((item) => likedPostSet.add(item.postId));
      favoritedPosts.forEach((item) => favoritedPostSet.add(item.targetId));
    }

    res.json({
      posts: posts.map((post) => ({
        ...toPostResponse(post),
        likedByMe: likedPostSet.has(post.id),
        favoritedByMe: favoritedPostSet.has(post.id),
      })),
    });
  } catch (error) {
    console.error('Fetch album posts error:', error);
    res.status(500).json({ error: '获取专辑关联帖子失败' });
  }
});

app.post('/api/albums', requireAdmin, async (req, res) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const artist = typeof body.artist === 'string' ? body.artist.trim() : '';
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const sourceId = typeof body.sourceId === 'string' ? body.sourceId.trim() : id;
    const platform = parseMusicPlatform(body.platform) || 'netease';
    const resourceType = parseMusicCollectionType(body.resourceType) || 'album';
    const description = typeof body.description === 'string' ? body.description.trim() : null;
    const platformUrl = typeof body.platformUrl === 'string' ? body.platformUrl.trim() : null;
    const cover = typeof body.cover === 'string' ? body.cover.trim() : '';
    const tracks = normalizeTrackDiscPayload(body.tracks);

    if (!title || !artist) {
      res.status(400).json({ error: '缺少专辑信息' });
      return;
    }

    const finalSourceId = sourceId || id || `${Date.now()}`;
    const finalId = id || `${platform}_${resourceType}_${finalSourceId}`;

    const existing = await prismaAny.album.findUnique({ where: { id: finalId } });
    if (existing) {
      res.status(409).json({ error: '专辑已存在' });
      return;
    }

    const created = await prismaAny.album.create({
      data: {
        id: finalId,
        resourceType,
        platform,
        sourceId: finalSourceId,
        title,
        artist,
        description,
        platformUrl,
        cover,
        tracks,
      },
      include: {
        covers: {
          orderBy: { sortOrder: 'asc' },
        },
        songRelations: {
          include: {
            song: {
              select: {
                docId: true,
                id: true,
                title: true,
                artist: true,
                cover: true,
              },
            },
          },
        },
      },
    });

    if (tracks.length) {
      await applyAlbumTracksToRelations(created.docId, tracks);
    }

    res.status(201).json({
      album: toAlbumResponse(created),
    });
  } catch (error) {
    console.error('Create album error:', error);
    res.status(500).json({ error: '创建专辑失败' });
  }
});

app.patch('/api/albums/:docId', requireAdmin, async (req, res) => {
  try {
    const docId = req.params.docId;
    const existing = await prismaAny.album.findUnique({ where: { docId } });
    if (!existing) {
      res.status(404).json({ error: '专辑不存在' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const updateData: Record<string, unknown> = {};

    if (typeof body.title === 'string') updateData.title = body.title.trim();
    if (typeof body.artist === 'string') updateData.artist = body.artist.trim();
    if (typeof body.description === 'string' || body.description === null) updateData.description = body.description;
    if (typeof body.platformUrl === 'string' || body.platformUrl === null) updateData.platformUrl = body.platformUrl;
    if (typeof body.cover === 'string') updateData.cover = body.cover.trim();

    const platform = parseMusicPlatform(body.platform);
    if (platform) updateData.platform = platform;
    const resourceType = parseMusicCollectionType(body.resourceType);
    if (resourceType) updateData.resourceType = resourceType;
    if (typeof body.sourceId === 'string') updateData.sourceId = body.sourceId.trim();
    if (typeof body.defaultCoverSource === 'string' || body.defaultCoverSource === null) {
      updateData.defaultCoverSource = body.defaultCoverSource;
    }

    if (body.tracks !== undefined) {
      const normalizedTracks = normalizeTrackDiscPayload(body.tracks);
      updateData.tracks = normalizedTracks;
      await applyAlbumTracksToRelations(docId, normalizedTracks);
    }

    const updated = await prismaAny.album.update({
      where: { docId },
      data: updateData,
      include: {
        covers: {
          orderBy: { sortOrder: 'asc' },
        },
        songRelations: {
          include: {
            song: {
              select: {
                docId: true,
                id: true,
                title: true,
                artist: true,
                cover: true,
              },
            },
          },
          orderBy: [{ discNumber: 'asc' }, { trackOrder: 'asc' }],
        },
      },
    });

    res.json({ album: toAlbumResponse(updated) });
  } catch (error) {
    console.error('Update album error:', error);
    res.status(500).json({ error: '更新专辑失败' });
  }
});

app.delete('/api/albums/:docId', requireAdmin, async (req, res) => {
  try {
    const docId = req.params.docId;
    const album = await prismaAny.album.findUnique({
      where: { docId },
      include: {
        covers: true,
      },
    });
    if (!album) {
      res.status(404).json({ error: '专辑不存在' });
      return;
    }

    const relations = await prismaAny.songAlbumRelation.findMany({ where: { albumDocId: docId } });
    const songDocIds = relations.map((item: any) => item.songDocId);

    await prismaAny.songAlbumRelation.deleteMany({ where: { albumDocId: docId } });

    const coverSources = (album.covers || []).map((cover: any) => `album_cover:${cover.id}`);
    if (coverSources.length) {
      await prismaAny.musicTrack.updateMany({
        where: {
          docId: { in: songDocIds },
          defaultCoverSource: { in: coverSources },
        },
        data: {
          defaultCoverSource: null,
        },
      });
    }

    for (const cover of album.covers || []) {
      if (cover.assetId) {
        const [songLinked, albumLinked, galleryLinked] = await Promise.all([
          prismaAny.songCover.count({ where: { assetId: cover.assetId } }),
          prismaAny.albumCover.count({ where: { assetId: cover.assetId, id: { not: cover.id } } }),
          prisma.galleryImage.count({ where: { assetId: cover.assetId } }),
        ]);
        if (songLinked + albumLinked + galleryLinked === 0) {
          const asset = await prisma.mediaAsset.findUnique({ where: { id: cover.assetId } });
          if (asset) {
            await safeDeleteUploadFileByStorageKey(asset.storageKey);
            await prisma.mediaAsset.update({
              where: { id: asset.id },
              data: { status: 'deleted' },
            });
          }
        }
      } else {
        await safeDeleteUploadFileByStorageKey(cover.storageKey);
      }
    }

    await prismaAny.albumCover.deleteMany({ where: { albumDocId: docId } });
    await prismaAny.album.delete({ where: { docId } });

    if (songDocIds.length) {
      const songs = await prismaAny.songAlbumRelation.findMany({
        where: { songDocId: { in: songDocIds } },
      });
      const groupedBySong = new Map<string, Array<{ id: string; isDisplay: boolean }>>();
      for (const relation of songs) {
        if (!groupedBySong.has(relation.songDocId)) {
          groupedBySong.set(relation.songDocId, []);
        }
        groupedBySong.get(relation.songDocId)!.push({ id: relation.id, isDisplay: relation.isDisplay });
      }
      for (const [, relationList] of groupedBySong.entries()) {
        if (!relationList.some((relation) => relation.isDisplay) && relationList[0]) {
          await prismaAny.songAlbumRelation.update({
            where: { id: relationList[0].id },
            data: { isDisplay: true },
          });
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete album error:', error);
    res.status(500).json({ error: '删除专辑失败' });
  }
});

app.get('/api/albums/:docId/covers', async (req, res) => {
  try {
    const album = await prismaAny.album.findUnique({
      where: { docId: req.params.docId },
      include: {
        covers: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!album) {
      res.status(404).json({ error: '专辑不存在' });
      return;
    }

    res.json({
      covers: (album.covers || []).map((cover: any) => ({
        id: cover.id,
        assetId: cover.assetId,
        storageKey: cover.storageKey,
        url: cover.publicUrl,
        isDefault: cover.isDefault,
        sortOrder: cover.sortOrder,
      })),
    });
  } catch (error) {
    console.error('Fetch album covers error:', error);
    res.status(500).json({ error: '获取专辑封面失败' });
  }
});

app.post('/api/albums/:docId/covers', requireAdmin, async (req, res) => {
  try {
    const albumDocId = req.params.docId;
    const assetId = typeof req.body?.assetId === 'string' ? req.body.assetId.trim() : '';
    const isDefault = parseBoolean(req.body?.isDefault, false);

    if (!assetId) {
      res.status(400).json({ error: '缺少 assetId' });
      return;
    }

    const album = await prismaAny.album.findUnique({ where: { docId: albumDocId } });
    if (!album) {
      res.status(404).json({ error: '专辑不存在' });
      return;
    }

    const cover = await addAlbumCoverFromAsset(albumDocId, assetId, isDefault);
    if (isDefault) {
      await prismaAny.album.update({
        where: { docId: albumDocId },
        data: {
          cover: cover.publicUrl,
        },
      });
    }

    res.status(201).json({
      cover: {
        id: cover.id,
        assetId: cover.assetId,
        storageKey: cover.storageKey,
        url: cover.publicUrl,
        isDefault: cover.isDefault,
        sortOrder: cover.sortOrder,
      },
    });
  } catch (error) {
    console.error('Create album cover error:', error);
    res.status(500).json({ error: '添加专辑封面失败' });
  }
});

app.delete('/api/albums/:docId/covers/:coverId', requireAdmin, async (req, res) => {
  try {
    const { docId: albumDocId, coverId } = req.params;
    const cover = await prismaAny.albumCover.findFirst({
      where: {
        id: coverId,
        albumDocId,
      },
    });

    if (!cover) {
      res.status(404).json({ error: '封面不存在' });
      return;
    }

    await prismaAny.albumCover.delete({ where: { id: cover.id } });

    if (cover.assetId) {
      const [songLinked, albumLinked, galleryLinked] = await Promise.all([
        prismaAny.songCover.count({ where: { assetId: cover.assetId } }),
        prismaAny.albumCover.count({ where: { assetId: cover.assetId } }),
        prisma.galleryImage.count({ where: { assetId: cover.assetId } }),
      ]);
      if (songLinked + albumLinked + galleryLinked === 0) {
        const asset = await prisma.mediaAsset.findUnique({ where: { id: cover.assetId } });
        if (asset) {
          await safeDeleteUploadFileByStorageKey(asset.storageKey);
          await prisma.mediaAsset.update({
            where: { id: asset.id },
            data: { status: 'deleted' },
          });
        }
      }
    }

    const remaining = await prismaAny.albumCover.findMany({
      where: { albumDocId },
      orderBy: { sortOrder: 'asc' },
    });

    if (!remaining.length) {
      await prismaAny.album.update({
        where: { docId: albumDocId },
        data: {
          defaultCoverSource: 'old_cover',
        },
      });
    } else {
      const hasDefault = remaining.some((item: any) => item.isDefault);
      const first = remaining[0];
      if (!hasDefault) {
        await prismaAny.albumCover.update({
          where: { id: first.id },
          data: { isDefault: true },
        });
        await prismaAny.album.update({
          where: { docId: albumDocId },
          data: {
            defaultCoverSource: `album_cover:${first.id}`,
            cover: first.publicUrl,
          },
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete album cover error:', error);
    res.status(500).json({ error: '删除专辑封面失败' });
  }
});

app.patch('/api/albums/:docId/covers/:coverId/default', requireAdmin, async (req, res) => {
  try {
    const { docId: albumDocId, coverId } = req.params;
    const cover = await prismaAny.albumCover.findFirst({
      where: {
        id: coverId,
        albumDocId,
      },
    });
    if (!cover) {
      res.status(404).json({ error: '封面不存在' });
      return;
    }

    await prismaAny.albumCover.updateMany({
      where: { albumDocId },
      data: { isDefault: false },
    });
    await prismaAny.albumCover.update({
      where: { id: coverId },
      data: { isDefault: true },
    });
    await prismaAny.album.update({
      where: { docId: albumDocId },
      data: {
        defaultCoverSource: `album_cover:${coverId}`,
        cover: cover.publicUrl,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Set album default cover error:', error);
    res.status(500).json({ error: '设置默认封面失败' });
  }
});

app.post('/api/albums/:docId/sync-covers-to-songs', requireAdmin, async (req, res) => {
  try {
    const albumDocId = req.params.docId;
    const coverId = typeof req.body?.coverId === 'string' ? req.body.coverId.trim() : '';
    const songDocIdsRaw = Array.isArray(req.body?.songDocIds) ? req.body.songDocIds : [];
    const songDocIds = songDocIdsRaw
      .filter((item: unknown): item is string => typeof item === 'string')
      .map((item: string) => item.trim())
      .filter(Boolean);

    const album = await prismaAny.album.findUnique({
      where: { docId: albumDocId },
      include: {
        covers: true,
      },
    });
    if (!album) {
      res.status(404).json({ error: '专辑不存在' });
      return;
    }

    let selectedCover: any = null;
    if (coverId) {
      selectedCover = album.covers.find((item: any) => item.id === coverId) || null;
    }
    if (!selectedCover) {
      selectedCover = album.covers.find((item: any) => item.isDefault) || album.covers[0] || null;
    }
    if (!selectedCover) {
      res.status(400).json({ error: '专辑没有可同步的封面' });
      return;
    }

    const relations = await prismaAny.songAlbumRelation.findMany({
      where: {
        albumDocId,
        ...(songDocIds.length ? { songDocId: { in: songDocIds } } : {}),
      },
      select: {
        songDocId: true,
      },
    });

    const targetSongDocIds = relations.map((item: any) => item.songDocId);
    if (!targetSongDocIds.length) {
      res.status(400).json({ error: '没有可同步的歌曲' });
      return;
    }

    await prismaAny.musicTrack.updateMany({
      where: {
        docId: { in: targetSongDocIds },
      },
      data: {
        cover: selectedCover.publicUrl,
        defaultCoverSource: `album_cover:${selectedCover.id}`,
      },
    });

    res.json({
      success: true,
      syncedCount: targetSongDocIds.length,
      cover: {
        id: selectedCover.id,
        url: selectedCover.publicUrl,
      },
    });
  } catch (error) {
    console.error('Sync album covers to songs error:', error);
    res.status(500).json({ error: '同步专辑封面失败' });
  }
});

app.post('/api/albums/:docId/discs', requireAdmin, async (req, res) => {
  try {
    const docId = req.params.docId;
    const album = await prismaAny.album.findUnique({ where: { docId } });
    if (!album) {
      res.status(404).json({ error: '专辑不存在' });
      return;
    }

    const tracks = normalizeTrackDiscPayload(album.tracks);
    const requestedDisc = parseInteger(req.body?.discNumber, 0, { min: 1, max: 20 });
    const nextDisc = requestedDisc || (tracks.length ? tracks[tracks.length - 1].disc + 1 : 1);
    if (tracks.some((item) => item.disc === nextDisc)) {
      res.status(400).json({ error: 'Disc 已存在' });
      return;
    }

    const discName = typeof req.body?.name === 'string' && req.body.name.trim()
      ? req.body.name.trim()
      : `Disc ${nextDisc}`;
    tracks.push({
      disc: nextDisc,
      name: discName,
      songs: [],
    });
    tracks.sort((a, b) => a.disc - b.disc);

    await prismaAny.album.update({
      where: { docId },
      data: {
        tracks,
      },
    });

    res.status(201).json({
      disc: {
        disc: nextDisc,
        name: discName,
      },
    });
  } catch (error) {
    console.error('Create album disc error:', error);
    res.status(500).json({ error: '新增 Disc 失败' });
  }
});

app.delete('/api/albums/:docId/discs/:discNumber', requireAdmin, async (req, res) => {
  try {
    const docId = req.params.docId;
    const discNumber = parseInteger(req.params.discNumber, 0, { min: 1, max: 20 });
    if (!discNumber) {
      res.status(400).json({ error: 'Disc 参数无效' });
      return;
    }

    const album = await prismaAny.album.findUnique({ where: { docId } });
    if (!album) {
      res.status(404).json({ error: '专辑不存在' });
      return;
    }

    const tracks = normalizeTrackDiscPayload(album.tracks);
    const target = tracks.find((item) => item.disc === discNumber);
    if (!target) {
      res.status(404).json({ error: 'Disc 不存在' });
      return;
    }
    if (target.songs.length) {
      res.status(400).json({ error: 'Disc 下仍有歌曲，无法删除' });
      return;
    }

    const nextTracks = tracks.filter((item) => item.disc !== discNumber);
    await prismaAny.album.update({
      where: { docId },
      data: {
        tracks: nextTracks,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete album disc error:', error);
    res.status(500).json({ error: '删除 Disc 失败' });
  }
});

app.patch('/api/albums/:docId/tracks/reorder', requireAdmin, async (req, res) => {
  try {
    const docId = req.params.docId;
    const album = await prismaAny.album.findUnique({ where: { docId } });
    if (!album) {
      res.status(404).json({ error: '专辑不存在' });
      return;
    }

    const tracks = normalizeTrackDiscPayload(req.body?.tracks);
    await prismaAny.album.update({
      where: { docId },
      data: {
        tracks,
      },
    });
    await applyAlbumTracksToRelations(docId, tracks);

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder album tracks error:', error);
    res.status(500).json({ error: '重排专辑曲目失败' });
  }
});

app.post('/api/albums/:docId/sync-display-to-songs', requireAdmin, async (req, res) => {
  try {
    const albumDocId = req.params.docId;
    const relationRows = await prismaAny.songAlbumRelation.findMany({
      where: { albumDocId },
      orderBy: [{ discNumber: 'asc' }, { trackOrder: 'asc' }],
    });

    if (!relationRows.length) {
      res.json({ success: true, updated: 0 });
      return;
    }

    const songDocIdsRaw = Array.isArray(req.body?.songDocIds) ? req.body.songDocIds : [];
    const selectedSongDocIds = songDocIdsRaw
      .filter((item: unknown): item is string => typeof item === 'string')
      .map((item: string) => item.trim())
      .filter(Boolean);

    const targetSongDocIds = selectedSongDocIds.length
      ? relationRows
        .map((item: any) => item.songDocId)
        .filter((id: string) => selectedSongDocIds.includes(id))
      : relationRows.map((item: any) => item.songDocId);

    if (!targetSongDocIds.length) {
      res.json({ success: true, updated: 0 });
      return;
    }

    await prismaAny.songAlbumRelation.updateMany({
      where: {
        songDocId: { in: targetSongDocIds },
      },
      data: {
        isDisplay: false,
      },
    });

    for (const songDocId of targetSongDocIds) {
      await prismaAny.songAlbumRelation.updateMany({
        where: {
          songDocId,
          albumDocId,
        },
        data: {
          isDisplay: true,
        },
      });
    }

    await prismaAny.musicTrack.updateMany({
      where: { docId: { in: targetSongDocIds } },
      data: {
        displayAlbumMode: 'linked',
      },
    });

    res.json({ success: true, updated: targetSongDocIds.length });
  } catch (error) {
    console.error('Sync display album info error:', error);
    res.status(500).json({ error: '同步展示专辑失败' });
  }
});

app.get('/api/image-maps', async (req, res) => {
  try {
    const md5 = typeof req.query.md5 === 'string' ? req.query.md5 : '';

    const items = await prisma.imageMap.findMany({
      where: md5 ? { md5 } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({
      items: items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Fetch image maps error:', error);
    res.status(500).json({ error: '获取图片映射失败' });
  }
});

app.get('/api/image-maps/:id', async (req, res) => {
  try {
    const item = await prisma.imageMap.findUnique({
      where: { id: req.params.id },
    });

    if (!item) {
      res.status(404).json({ error: '图片映射不存在' });
      return;
    }

    res.json({
      item: {
        ...item,
        createdAt: item.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Fetch image map detail error:', error);
    res.status(500).json({ error: '获取图片映射失败' });
  }
});

app.post('/api/image-maps', requireAuth, requireActiveUser, async (req, res) => {
  try {
    const { id, md5, localUrl, weiboUrl, smmsUrl, superbedUrl } = req.body as {
      id?: string;
      md5?: string;
      localUrl?: string;
      weiboUrl?: string;
      smmsUrl?: string;
      superbedUrl?: string;
    };

    if (!id || !md5 || !localUrl) {
      res.status(400).json({ error: '缺少必要字段' });
      return;
    }

    const item = await prisma.imageMap.upsert({
      where: { id },
      update: {
        md5,
        localUrl,
        weiboUrl: weiboUrl || null,
        smmsUrl: smmsUrl || null,
        superbedUrl: superbedUrl || null,
      },
      create: {
        id,
        md5,
        localUrl,
        weiboUrl: weiboUrl || null,
        smmsUrl: smmsUrl || null,
        superbedUrl: superbedUrl || null,
      },
    });

    res.status(201).json({
      item: {
        ...item,
        createdAt: item.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create image map error:', error);
    res.status(500).json({ error: '保存图片映射失败' });
  }
});

app.get('/api/music/song/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await prismaAny.musicTrack.findFirst({
      where: {
        OR: [
          { id },
          { neteaseId: id },
          { tencentId: id },
          { kugouId: id },
          { baiduId: id },
          { kuwoId: id },
        ],
      },
      include: {
        covers: {
          orderBy: { sortOrder: 'asc' },
        },
        albumRelations: {
          include: {
            album: {
              include: {
                covers: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
          orderBy: [{ discNumber: 'asc' }, { trackOrder: 'asc' }],
        },
      },
    });

    if (existing) {
      const resolved = await resolveMusicPlayUrl(existing);
      const song = toSongResponse(existing as MusicTrackWithRelations);
      res.json({
        ...song,
        playUrl: resolved.playUrl || song.audioUrl,
        playMeta: {
          platform: resolved.platform,
          sourceId: resolved.sourceId,
          cached: resolved.cached,
          cacheExpiresAt: resolved.cacheExpiresAt,
          fallback: Boolean((resolved as { fallback?: boolean }).fallback),
        },
      });
      return;
    }

    const preview = await getMusicResourcePreview('netease', 'song', id);
    const track = normalizeMusicImportTracks(preview.songs)[0];
    if (!track) {
      res.status(404).json({ error: '未找到歌曲信息' });
      return;
    }

    const audioUrl = await resolveMetingAudioUrl('netease', track.urlId);
    const lyric = await resolveMetingLyric('netease', track.lyricId);

    res.json({
      docId: null,
      id: track.sourceId,
      title: track.title || preview.title,
      artist: track.artist || preview.artist,
      album: track.album || preview.title,
      cover: track.cover || preview.cover,
      audioUrl: audioUrl || '',
      playUrl: audioUrl || '',
      lyric: lyric || null,
      primaryPlatform: 'netease',
      enabledPlatform: 'netease',
      platformIds: {
        neteaseId: track.sourceId,
        tencentId: null,
        kugouId: null,
        baiduId: null,
        kuwoId: null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching song metadata:', error);
    res.status(500).json({ error: 'Failed to fetch song metadata' });
  }
});

app.get('/api/search', async (req: AuthenticatedRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const type = typeof req.query.type === 'string' ? req.query.type : 'all';
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const startDate = typeof req.query.startDate === 'string' ? parseDate(req.query.startDate) : null;
    const endDate = typeof req.query.endDate === 'string' ? parseDate(req.query.endDate) : null;
    const tagsParam = typeof req.query.tags === 'string' ? req.query.tags : '';
    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()).filter(Boolean) : [];

    const wantsWiki = type === 'all' || type === 'wiki';
    const wantsPosts = type === 'all' || type === 'posts';
    const wantsGalleries = type === 'all' || type === 'galleries';
    const wantsMusic = type === 'all' || type === 'music';
    const wantsAlbums = type === 'all' || type === 'albums';

    if (q) {
      increaseSearchKeywordCount(q);
    }

    const wikiVisibilityWhere = buildWikiVisibilityWhere(req.authUser);
    const postVisibilityWhere = buildPostVisibilityWhere(req.authUser);

    const wikiPromise = wantsWiki
      ? prisma.wikiPage.findMany({
          where: {
            ...wikiVisibilityWhere,
            ...(category ? { category } : {}),
            ...(q
              ? {
                  OR: [
                    { title: { contains: q } },
                    { content: { contains: q } },
                    { slug: { contains: q } },
                  ],
                }
              : {}),
            ...(startDate || endDate
              ? {
                  updatedAt: {
                    ...(startDate ? { gte: startDate } : {}),
                    ...(endDate ? { lte: endDate } : {}),
                  },
                }
              : {}),
          },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]);

    const postsPromise = wantsPosts
      ? prisma.post.findMany({
          where: {
            ...postVisibilityWhere,
            ...(category ? { section: category } : {}),
            ...(q
              ? {
                  OR: [
                    { title: { contains: q } },
                    { content: { contains: q } },
                  ],
                }
              : {}),
            ...(startDate || endDate
              ? {
                  updatedAt: {
                    ...(startDate ? { gte: startDate } : {}),
                    ...(endDate ? { lte: endDate } : {}),
                  },
                }
              : {}),
          },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]);

    const galleriesPromise = wantsGalleries
      ? prisma.gallery.findMany({
          include: {
            images: {
              include: {
                asset: true,
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
          where: {
            ...(q
              ? {
                  OR: [
                    { title: { contains: q } },
                    { description: { contains: q } },
                  ],
                }
              : {}),
            ...(startDate || endDate
              ? {
                  updatedAt: {
                    ...(startDate ? { gte: startDate } : {}),
                    ...(endDate ? { lte: endDate } : {}),
                  },
                }
              : {}),
          },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]);

    const musicPromise = wantsMusic
      ? prisma.musicTrack.findMany({
          where: {
            ...(q
              ? {
                  OR: [
                    { title: { contains: q } },
                    { artist: { contains: q } },
                    { album: { contains: q } },
                    { lyric: { contains: q } },
                  ],
                }
              : {}),
          },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]);

    const albumsPromise = wantsAlbums
      ? prisma.album.findMany({
          where: {
            ...(q
              ? {
                  OR: [
                    { title: { contains: q } },
                    { artist: { contains: q } },
                    { description: { contains: q } },
                  ],
                }
              : {}),
          },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]);

    const [wiki, posts, galleries, music, albums] = await Promise.all([wikiPromise, postsPromise, galleriesPromise, musicPromise, albumsPromise]);

    res.json({
      wiki: wiki.map(toWikiResponse),
      posts: posts.map(toPostResponse),
      galleries: galleries.map(toGalleryResponse),
      music: music.map(toMusicResponse),
      albums: albums.map(toAlbumResponse),
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

app.get('/api/search/hot-keywords', async (_req, res) => {
  try {
    const keywords = await prisma.searchKeyword.findMany({
      orderBy: [{ count: 'desc' }, { updatedAt: 'desc' }],
      take: 20,
    });

    res.json({
      keywords: keywords.map((k) => ({
        keyword: k.keyword,
        count: k.count,
      })),
    });
  } catch (error) {
    console.error('Fetch hot keywords error:', error);
    res.status(500).json({ error: '获取热门关键词失败' });
  }
});

app.post('/api/search/by-image', searchImageUpload.single('image'), async (req: AuthenticatedRequest, res) => {
  const tempFile = req.file;
  try {
    const requestedLimit = parseInteger(req.body?.limit, IMAGE_SEARCH_RESULT_LIMIT, {
      min: 1,
      max: 60,
    });
    const minScore = parseMinSimilarityScore(req.body?.minScore);

    let imageBuffer: Buffer | null = null;

    if (tempFile?.path) {
      try {
        imageBuffer = await fs.promises.readFile(tempFile.path);
      } catch {
        imageBuffer = null;
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      const base64Payload = extractBase64Payload(req.body?.imageBase64);
      if (base64Payload) {
        try {
          imageBuffer = Buffer.from(base64Payload, 'base64');
        } catch {
          imageBuffer = null;
        }
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      res.status(400).json({ error: '请上传图片文件，或提供 imageBase64' });
      return;
    }

    const queryVector = await generateImageEmbedding(imageBuffer);
    const matches = await searchImageEmbeddingPoints({
      vector: queryVector,
      limit: requestedLimit,
      minScore,
    });

    const seenGalleryIds = new Set<string>();
    const seenImageIds = new Set<string>();
    const orderedGalleryIds: string[] = [];
    const scoreByGalleryId = new Map<string, number>();

    matches.forEach((match) => {
      const parsed = toEmbeddingPayload(match.payload);
      if (!parsed) {
        return;
      }

      if (!seenImageIds.has(parsed.galleryImageId)) {
        seenImageIds.add(parsed.galleryImageId);
      }

      const score = typeof match.score === 'number' ? match.score : 0;
      const previousBest = scoreByGalleryId.get(parsed.galleryId);
      if (previousBest === undefined || score > previousBest) {
        scoreByGalleryId.set(parsed.galleryId, score);
      }

      if (!seenGalleryIds.has(parsed.galleryId)) {
        seenGalleryIds.add(parsed.galleryId);
        orderedGalleryIds.push(parsed.galleryId);
      }
    });

    if (!orderedGalleryIds.length) {
      res.json({
        mode: 'semantic_image',
        totalMatches: 0,
        totalGalleries: 0,
        galleries: [],
      });
      return;
    }

    const galleryRows = await prisma.gallery.findMany({
      where: {
        id: { in: orderedGalleryIds },
      },
      include: {
        images: {
          include: {
            asset: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const galleryById = new Map(galleryRows.map((gallery) => [gallery.id, gallery]));
    const galleries = orderedGalleryIds
      .map((galleryId) => {
        const gallery = galleryById.get(galleryId);
        if (!gallery) {
          return null;
        }
        return {
          ...toGalleryResponse(gallery),
          similarity: Number((scoreByGalleryId.get(galleryId) ?? 0).toFixed(4)),
        };
      })
      .filter((item): item is ReturnType<typeof toGalleryResponse> & { similarity: number } => item !== null);

    res.json({
      mode: 'semantic_image',
      totalMatches: seenImageIds.size,
      totalGalleries: galleries.length,
      galleries,
    });
  } catch (error) {
    console.error('Image semantic search error:', error);
    res.status(500).json({ error: '图片语义搜索失败' });
  } finally {
    if (tempFile?.path) {
      await fs.promises.unlink(tempFile.path).catch(() => {});
    }
  }
});

app.get('/api/search/semantic-galleries', async (req: AuthenticatedRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const requestedLimit = parseInteger(req.query.limit as string, IMAGE_SEARCH_RESULT_LIMIT, {
      min: 1,
      max: 60,
    });
    const minScore = parseMinSimilarityScore(req.query.minScore);

    if (!q) {
      res.status(400).json({ error: '请提供搜索文字 (q 参数)' });
      return;
    }

    const queryVector = await generateTextEmbedding(q);
    const matches = await searchImageEmbeddingPoints({
      vector: queryVector,
      limit: requestedLimit,
      minScore,
    });

    const seenGalleryIds = new Set<string>();
    const seenImageIds = new Set<string>();
    const orderedGalleryIds: string[] = [];
    const scoreByGalleryId = new Map<string, number>();

    matches.forEach((match) => {
      const parsed = toEmbeddingPayload(match.payload);
      if (!parsed) {
        return;
      }

      if (!seenImageIds.has(parsed.galleryImageId)) {
        seenImageIds.add(parsed.galleryImageId);
      }

      const score = typeof match.score === 'number' ? match.score : 0;
      const previousBest = scoreByGalleryId.get(parsed.galleryId);
      if (previousBest === undefined || score > previousBest) {
        scoreByGalleryId.set(parsed.galleryId, score);
      }

      if (!seenGalleryIds.has(parsed.galleryId)) {
        seenGalleryIds.add(parsed.galleryId);
        orderedGalleryIds.push(parsed.galleryId);
      }
    });

    if (!orderedGalleryIds.length) {
      res.json({
        mode: 'semantic_text',
        query: q,
        totalMatches: 0,
        totalGalleries: 0,
        galleries: [],
      });
      return;
    }

    const galleryRows = await prisma.gallery.findMany({
      where: {
        id: { in: orderedGalleryIds },
      },
      include: {
        images: {
          include: {
            asset: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const galleryById = new Map(galleryRows.map((gallery) => [gallery.id, gallery]));
    const galleries = orderedGalleryIds
      .map((galleryId) => {
        const gallery = galleryById.get(galleryId);
        if (!gallery) {
          return null;
        }
        return {
          ...toGalleryResponse(gallery),
          similarity: Number((scoreByGalleryId.get(galleryId) ?? 0).toFixed(4)),
        };
      })
      .filter((item): item is ReturnType<typeof toGalleryResponse> & { similarity: number } => item !== null);

    res.json({
      mode: 'semantic_text',
      query: q,
      totalMatches: seenImageIds.size,
      totalGalleries: galleries.length,
      galleries,
    });
  } catch (error) {
    console.error('Text semantic search error:', error);
    res.status(500).json({ error: '文字语义搜索失败' });
  }
});

app.get('/api/embeddings/status', requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const [pending, processing, ready, failed] = await Promise.all([
      prisma.imageEmbedding.count({ where: { status: 'pending' } }),
      prisma.imageEmbedding.count({ where: { status: 'processing' } }),
      prisma.imageEmbedding.count({ where: { status: 'ready' } }),
      prisma.imageEmbedding.count({ where: { status: 'failed' } }),
    ]);

    const summary = {
      pending,
      processing,
      ready,
      failed,
      total: pending + processing + ready + failed,
    };

    res.json({
      modelName: getEmbeddingModelName(),
      vectorSize: getEmbeddingVectorSize(),
      qdrantCollection: getQdrantCollectionName(),
      summary,
    });
  } catch (error) {
    console.error('Fetch embeddings status error:', error);
    res.status(500).json({ error: '获取向量状态失败' });
  }
});

app.post('/api/embeddings/enqueue-missing', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInteger(req.body?.limit, IMAGE_EMBEDDING_BATCH_SIZE, {
      min: 1,
      max: 2000,
    });
    const result = await enqueueMissingImageEmbeddings(prisma, limit);
    res.json({
      ...result,
      limit,
    });
  } catch (error) {
    console.error('Enqueue missing embeddings error:', error);
    res.status(500).json({ error: '补齐向量队列失败' });
  }
});

app.post('/api/embeddings/sync-batch', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const galleryImageIdsRaw = Array.isArray(req.body?.galleryImageIds)
      ? req.body.galleryImageIds
      : [];
    const galleryImageIds = galleryImageIdsRaw
      .filter((item: unknown): item is string => typeof item === 'string')
      .map((item: string) => item.trim())
      .filter(Boolean);

    const limit = parseInteger(req.body?.limit, IMAGE_EMBEDDING_BATCH_SIZE, {
      min: 1,
      max: 500,
    });
    const includeFailed = parseBoolean(req.body?.includeFailed, false);
    const forceRebuild = parseBoolean(req.body?.forceRebuild, false);

    const result = await syncImageEmbeddingBatch(prisma, uploadsDir, {
      limit,
      includeFailed,
      forceRebuild,
      galleryImageIds,
    });

    res.json({
      ...result,
      limit,
      includeFailed,
      forceRebuild,
      modelName: getEmbeddingModelName(),
      vectorSize: getEmbeddingVectorSize(),
      qdrantCollection: getQdrantCollectionName(),
    });
  } catch (error) {
    console.error('Sync embeddings batch error:', error);
    res.status(500).json({ error: '批量生成向量失败' });
  }
});

app.get('/api/embeddings/errors', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInteger(req.query.limit, 20, {
      min: 1,
      max: 200,
    });

    const failed = await prisma.imageEmbedding.findMany({
      where: {
        status: 'failed',
      },
      include: {
        galleryImage: {
          include: {
            gallery: {
              select: {
                id: true,
                title: true,
              },
            },
            asset: {
              select: {
                id: true,
                publicUrl: true,
                storageKey: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
    });

    res.json({
      items: failed.map((item) => ({
        id: item.id,
        galleryImageId: item.galleryImageId,
        galleryId: item.galleryImage.galleryId,
        galleryTitle: item.galleryImage.gallery.title,
        imageUrl: item.galleryImage.asset?.publicUrl || item.galleryImage.url,
        modelName: item.modelName,
        vectorSize: item.vectorSize,
        status: item.status,
        lastError: item.lastError,
        embeddedAt: item.embeddedAt ? item.embeddedAt.toISOString() : null,
        updatedAt: item.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Fetch embedding errors error:', error);
    res.status(500).json({ error: '获取向量失败记录失败' });
  }
});

app.post('/api/embeddings/retry-failed', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInteger(req.body?.limit, IMAGE_EMBEDDING_BATCH_SIZE, {
      min: 1,
      max: 500,
    });

    const updated = await prisma.imageEmbedding.updateMany({
      where: {
        status: 'failed',
      },
      data: {
        status: 'pending',
        lastError: null,
      },
    });

    const result = await syncImageEmbeddingBatch(prisma, uploadsDir, {
      limit,
      includeFailed: true,
      forceRebuild: false,
    });

    res.json({
      resetCount: updated.count,
      ...result,
      limit,
    });
  } catch (error) {
    console.error('Retry failed embeddings error:', error);
    res.status(500).json({ error: '重试失败向量任务失败' });
  }
});

app.post('/api/embeddings/rebuild-all', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInteger(req.body?.limit, IMAGE_EMBEDDING_BATCH_SIZE, {
      min: 1,
      max: 500,
    });

    const updated = await prisma.imageEmbedding.updateMany({
      data: {
        status: 'pending',
        lastError: null,
      },
    });

    const result = await syncImageEmbeddingBatch(prisma, uploadsDir, {
      limit,
      includeFailed: true,
      forceRebuild: true,
    });

    res.json({
      resetCount: updated.count,
      ...result,
      limit,
    });
  } catch (error) {
    console.error('Rebuild all embeddings error:', error);
    res.status(500).json({ error: '重建全部向量失败' });
  }
});

app.get('/api/search/suggest', async (req: AuthenticatedRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q || q.length < 2) {
      res.json({ suggestions: [] });
      return;
    }

    const normalized = normalizeKeyword(q);

    const [keywordMatches, wikiMatches, postMatches, musicMatches, albumMatches] = await Promise.all([
      prisma.searchKeyword.findMany({
        where: { keyword: { contains: normalized } },
        orderBy: { count: 'desc' },
        take: 5,
        select: { keyword: true, count: true },
      }),
      prisma.wikiPage.findMany({
        where: {
          status: 'published',
          OR: [
            { title: { contains: q } },
            { slug: { contains: q } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { slug: true, title: true, category: true, content: true },
      }),
      prisma.post.findMany({
        where: {
          status: 'published',
          OR: [
            { title: { contains: q } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { id: true, title: true, section: true },
      }),
      prisma.musicTrack.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { artist: { contains: q } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { docId: true, title: true, artist: true },
      }),
      prisma.album.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { artist: { contains: q } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { docId: true, title: true, artist: true },
      }),
    ]);

    const suggestions: Array<{ type: 'keyword' | 'wiki' | 'post' | 'music' | 'album'; text: string; subtext?: string; id?: string }> = [];

    keywordMatches.forEach((k) => {
      suggestions.push({ type: 'keyword', text: k.keyword, subtext: `${k.count} 次搜索` });
    });

    wikiMatches.forEach((w) => {
      const contentSnippet = w.content ? w.content.slice(0, 80).replace(/<[^>]+>/g, '') + '...' : '';
      suggestions.push({ type: 'wiki', text: w.title, subtext: contentSnippet || w.category, id: w.slug });
    });

    postMatches.forEach((p) => {
      suggestions.push({ type: 'post', text: p.title, subtext: p.section, id: p.id });
    });

    musicMatches.forEach((m) => {
      suggestions.push({ type: 'music', text: m.title, subtext: m.artist, id: m.docId });
    });

    albumMatches.forEach((a) => {
      suggestions.push({ type: 'album', text: a.title, subtext: a.artist, id: a.docId });
    });

    res.json({ suggestions });
  } catch (error) {
    console.error('Search suggest error:', error);
    res.status(500).json({ error: '搜索建议失败' });
  }
});

app.post('/api/admin/batch/song-covers/delete', requireAdmin, async (req, res) => {
  try {
    const coverIdsRaw = Array.isArray(req.body?.coverIds) ? req.body.coverIds : [];
    const coverIds = coverIdsRaw
      .filter((item: unknown): item is string => typeof item === 'string')
      .map((item: string) => item.trim())
      .filter(Boolean);

    if (!coverIds.length) {
      res.status(400).json({ error: '请选择要删除的封面' });
      return;
    }

    const covers = await prismaAny.songCover.findMany({
      where: { id: { in: coverIds } },
      select: {
        id: true,
        songDocId: true,
        assetId: true,
        storageKey: true,
        publicUrl: true,
      },
    });

    if (!covers.length) {
      res.json({ deleted: 0 });
      return;
    }

    await prismaAny.songCover.deleteMany({
      where: { id: { in: covers.map((cover: any) => cover.id) } },
    });

    const touchedSongIds = new Set<string>();
    for (const cover of covers) {
      touchedSongIds.add(cover.songDocId);
      if (cover.assetId) {
        const [songLinked, albumLinked, galleryLinked] = await Promise.all([
          prismaAny.songCover.count({ where: { assetId: cover.assetId } }),
          prismaAny.albumCover.count({ where: { assetId: cover.assetId } }),
          prisma.galleryImage.count({ where: { assetId: cover.assetId } }),
        ]);
        if (songLinked + albumLinked + galleryLinked === 0) {
          const asset = await prisma.mediaAsset.findUnique({ where: { id: cover.assetId } });
          if (asset) {
            await safeDeleteUploadFileByStorageKey(asset.storageKey);
            await prisma.mediaAsset.update({
              where: { id: asset.id },
              data: { status: 'deleted' },
            });
          }
        }
      } else {
        await safeDeleteUploadFileByStorageKey(cover.storageKey);
      }
    }

    for (const songDocId of touchedSongIds) {
      const remaining = await prismaAny.songCover.findMany({
        where: { songDocId },
        orderBy: { sortOrder: 'asc' },
      });
      if (!remaining.length) {
        await prismaAny.musicTrack.update({
          where: { docId: songDocId },
          data: {
            defaultCoverSource: null,
            cover: '',
          },
        });
        continue;
      }
      if (!remaining.some((item: any) => item.isDefault)) {
        await prismaAny.songCover.update({
          where: { id: remaining[0].id },
          data: { isDefault: true },
        });
        await prismaAny.musicTrack.update({
          where: { docId: songDocId },
          data: {
            defaultCoverSource: `song_cover:${remaining[0].id}`,
            cover: remaining[0].publicUrl,
          },
        });
      }
    }

    res.json({ deleted: covers.length });
  } catch (error) {
    console.error('Batch delete song covers error:', error);
    res.status(500).json({ error: '批量删除歌曲封面失败' });
  }
});

app.post('/api/admin/batch/album-covers/delete', requireAdmin, async (req, res) => {
  try {
    const coverIdsRaw = Array.isArray(req.body?.coverIds) ? req.body.coverIds : [];
    const coverIds = coverIdsRaw
      .filter((item: unknown): item is string => typeof item === 'string')
      .map((item: string) => item.trim())
      .filter(Boolean);

    if (!coverIds.length) {
      res.status(400).json({ error: '请选择要删除的封面' });
      return;
    }

    const covers = await prismaAny.albumCover.findMany({
      where: { id: { in: coverIds } },
      select: {
        id: true,
        albumDocId: true,
        assetId: true,
        storageKey: true,
        publicUrl: true,
      },
    });

    if (!covers.length) {
      res.json({ deleted: 0 });
      return;
    }

    await prismaAny.albumCover.deleteMany({
      where: { id: { in: covers.map((cover: any) => cover.id) } },
    });

    const touchedAlbumIds = new Set<string>();
    for (const cover of covers) {
      touchedAlbumIds.add(cover.albumDocId);
      if (cover.assetId) {
        const [songLinked, albumLinked, galleryLinked] = await Promise.all([
          prismaAny.songCover.count({ where: { assetId: cover.assetId } }),
          prismaAny.albumCover.count({ where: { assetId: cover.assetId } }),
          prisma.galleryImage.count({ where: { assetId: cover.assetId } }),
        ]);
        if (songLinked + albumLinked + galleryLinked === 0) {
          const asset = await prisma.mediaAsset.findUnique({ where: { id: cover.assetId } });
          if (asset) {
            await safeDeleteUploadFileByStorageKey(asset.storageKey);
            await prisma.mediaAsset.update({
              where: { id: asset.id },
              data: { status: 'deleted' },
            });
          }
        }
      } else {
        await safeDeleteUploadFileByStorageKey(cover.storageKey);
      }
    }

    for (const albumDocId of touchedAlbumIds) {
      const remaining = await prismaAny.albumCover.findMany({
        where: { albumDocId },
        orderBy: { sortOrder: 'asc' },
      });
      if (!remaining.length) {
        await prismaAny.album.update({
          where: { docId: albumDocId },
          data: {
            defaultCoverSource: 'old_cover',
          },
        });
        continue;
      }
      if (!remaining.some((item: any) => item.isDefault)) {
        await prismaAny.albumCover.update({
          where: { id: remaining[0].id },
          data: { isDefault: true },
        });
        await prismaAny.album.update({
          where: { docId: albumDocId },
          data: {
            defaultCoverSource: `album_cover:${remaining[0].id}`,
            cover: remaining[0].publicUrl,
          },
        });
      }
    }

    res.json({ deleted: covers.length });
  } catch (error) {
    console.error('Batch delete album covers error:', error);
    res.status(500).json({ error: '批量删除专辑封面失败' });
  }
});

app.post('/api/admin/batch/album-covers/sync-to-songs', requireAdmin, async (req, res) => {
  try {
    const albumDocId = typeof req.body?.albumDocId === 'string' ? req.body.albumDocId.trim() : '';
    const coverId = typeof req.body?.coverId === 'string' ? req.body.coverId.trim() : '';
    const songDocIdsRaw = Array.isArray(req.body?.songDocIds) ? req.body.songDocIds : [];
    const songDocIds = songDocIdsRaw
      .filter((item: unknown): item is string => typeof item === 'string')
      .map((item: string) => item.trim())
      .filter(Boolean);

    if (!albumDocId) {
      res.status(400).json({ error: '缺少 albumDocId' });
      return;
    }

    const album = await prismaAny.album.findUnique({
      where: { docId: albumDocId },
      include: { covers: true },
    });
    if (!album) {
      res.status(404).json({ error: '专辑不存在' });
      return;
    }

    const selectedCover = coverId
      ? album.covers.find((item: any) => item.id === coverId)
      : album.covers.find((item: any) => item.isDefault) || album.covers[0];

    if (!selectedCover) {
      res.status(400).json({ error: '专辑没有可同步的封面' });
      return;
    }

    const relationRows = await prismaAny.songAlbumRelation.findMany({
      where: {
        albumDocId,
        ...(songDocIds.length ? { songDocId: { in: songDocIds } } : {}),
      },
      select: { songDocId: true },
    });
    const targetSongIds = relationRows.map((item: any) => item.songDocId);

    if (!targetSongIds.length) {
      res.status(400).json({ error: '没有可同步的歌曲' });
      return;
    }

    await prismaAny.musicTrack.updateMany({
      where: { docId: { in: targetSongIds } },
      data: {
        cover: selectedCover.publicUrl,
        defaultCoverSource: `album_cover:${selectedCover.id}`,
      },
    });

    res.json({
      synced: targetSongIds.length,
      cover: {
        id: selectedCover.id,
        url: selectedCover.publicUrl,
      },
    });
  } catch (error) {
    console.error('Batch sync album covers error:', error);
    res.status(500).json({ error: '批量同步专辑封面失败' });
  }
});

app.patch('/api/admin/batch/songs/display-info', requireAdmin, async (req, res) => {
  try {
    const songDocIdsRaw = Array.isArray(req.body?.songDocIds) ? req.body.songDocIds : [];
    const songDocIds = songDocIdsRaw
      .filter((item: unknown): item is string => typeof item === 'string')
      .map((item: string) => item.trim())
      .filter(Boolean);

    if (!songDocIds.length) {
      res.status(400).json({ error: '缺少 songDocIds' });
      return;
    }

    const displayAlbumMode = parseDisplayAlbumMode(req.body?.displayAlbumMode);
    const manualAlbumName = typeof req.body?.manualAlbumName === 'string' ? req.body.manualAlbumName.trim() : undefined;
    const defaultCoverSource =
      typeof req.body?.defaultCoverSource === 'string' || req.body?.defaultCoverSource === null
        ? req.body.defaultCoverSource
        : undefined;

    const updateData: Record<string, unknown> = {};
    if (displayAlbumMode) {
      updateData.displayAlbumMode = displayAlbumMode;
      if (displayAlbumMode !== 'manual') {
        updateData.manualAlbumName = null;
      }
    }
    if (manualAlbumName !== undefined) {
      updateData.manualAlbumName = manualAlbumName;
    }
    if (defaultCoverSource !== undefined) {
      updateData.defaultCoverSource = defaultCoverSource;
    }

    if (!Object.keys(updateData).length) {
      res.status(400).json({ error: '没有可更新的字段' });
      return;
    }

    const result = await prismaAny.musicTrack.updateMany({
      where: {
        docId: { in: songDocIds },
      },
      data: updateData,
    });

    res.json({ updated: result.count });
  } catch (error) {
    console.error('Batch update songs display info error:', error);
    res.status(500).json({ error: '批量更新歌曲展示信息失败' });
  }
});

function parseDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || '5432',
      user: parsed.username,
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.slice(1),
    };
  } catch {
    return null;
  }
}

function verifyBackupPassword(password: string): boolean {
  if (!BACKUP_PASSWORD) return false;
  return password === BACKUP_PASSWORD;
}

function sanitizeFilename(name: string): boolean {
  return /^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.zip$/.test(name);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter((f) => f.startsWith('backup_') && f.endsWith('.zip'))
      .map((f) => {
        const filePath = path.join(backupsDir, f);
        const stat = fs.statSync(filePath);
        return { name: f, mtime: stat.mtime.getTime() };
      })
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > BACKUP_RETAIN_COUNT) {
      const toDelete = files.slice(BACKUP_RETAIN_COUNT);
      for (const file of toDelete) {
        fs.unlinkSync(path.join(backupsDir, file.name));
        console.log(`Cleaned up old backup: ${file.name}`);
      }
    }
  } catch (error) {
    console.error('Cleanup old backups error:', error);
  }
}

function encryptBuffer(buffer: Buffer, password: string): Buffer {
  const key = crypto.scryptSync(password, 'huangshifu-backup-salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([iv, cipher.update(buffer), cipher.final()]);
  return encrypted;
}

function decryptBuffer(buffer: Buffer, password: string): Buffer {
  const key = crypto.scryptSync(password, 'huangshifu-backup-salt', 32);
  const iv = buffer.subarray(0, 16);
  const encrypted = buffer.subarray(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

app.post('/api/admin/backup/create', requireSuperAdmin, async (req, res) => {
  try {
    const { password } = req.body as { password?: string };

    if (!BACKUP_PASSWORD) {
      res.status(500).json({ error: '未配置 BACKUP_PASSWORD 环境变量' });
      return;
    }

    if (!password || !verifyBackupPassword(password)) {
      res.status(401).json({ error: '备份密码错误' });
      return;
    }

    const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL || '');
    if (!dbConfig) {
      res.status(500).json({ error: 'DATABASE_URL 格式无效' });
      return;
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-').replace('T', '_').slice(0, 19);
    const sqlFilename = `backup_${timestamp}.sql`;
    const sqlFilePath = path.join(backupsDir, sqlFilename);
    const zipFilename = `backup_${timestamp}.zip`;
    const zipFilePath = path.join(backupsDir, zipFilename);

    const pgDumpArgs = [
      '-h', dbConfig.host,
      '-p', dbConfig.port,
      '-U', dbConfig.user,
      '-d', dbConfig.database,
      '--no-owner',
      '--no-privileges',
      '--exclude-table-data=ImageEmbedding',
      '--exclude-table-data=_prisma_migrations',
      '-f', sqlFilePath,
    ];

    const pgDumpEnv = { ...process.env, PGPASSWORD: dbConfig.password };

    await execFileAsync('pg_dump', pgDumpArgs, { env: pgDumpEnv, timeout: 300000 });

    const sqlContent = fs.readFileSync(sqlFilePath);
    fs.unlinkSync(sqlFilePath);

    const encryptedContent = encryptBuffer(sqlContent, password);

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipFilePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.append(encryptedContent, { name: sqlFilename });
      archive.finalize();
    });

    const stat = fs.statSync(zipFilePath);

    await cleanupOldBackups();

    res.json({
      backup: {
        filename: zipFilename,
        size: stat.size,
        sizeFormatted: formatFileSize(stat.size),
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Create backup error:', error);
    res.status(500).json({ error: '创建备份失败: ' + (error instanceof Error ? error.message : String(error)) });
  }
});

app.get('/api/admin/backup/list', requireSuperAdmin, async (_req, res) => {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter((f) => f.startsWith('backup_') && f.endsWith('.zip'))
      .map((f) => {
        const filePath = path.join(backupsDir, f);
        const stat = fs.statSync(filePath);
        return {
          filename: f,
          size: stat.size,
          sizeFormatted: formatFileSize(stat.size),
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ backups: files });
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({ error: '获取备份列表失败' });
  }
});

app.get('/api/admin/backup/:filename/download', requireSuperAdmin, async (req, res) => {
  try {
    const filename = req.params.filename;

    if (!sanitizeFilename(filename)) {
      res.status(400).json({ error: '无效的文件名' });
      return;
    }

    const filePath = path.join(backupsDir, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: '备份文件不存在' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download backup error:', error);
    res.status(500).json({ error: '下载备份失败' });
  }
});

app.post('/api/admin/backup/restore', requireSuperAdmin, uploadBackup.single('file'), async (req, res) => {
  try {
    const { password } = req.body as { password?: string };
    const file = req.file;

    if (!BACKUP_PASSWORD) {
      res.status(500).json({ error: '未配置 BACKUP_PASSWORD 环境变量' });
      return;
    }

    if (!password || !verifyBackupPassword(password)) {
      res.status(401).json({ error: '备份密码错误' });
      return;
    }

    if (!file) {
      res.status(400).json({ error: '请上传备份文件' });
      return;
    }

    const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL || '');
    if (!dbConfig) {
      res.status(500).json({ error: 'DATABASE_URL 格式无效' });
      return;
    }

    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(file.path);
    const zipEntries = zip.getEntries();

    const sqlEntry = zipEntries.find((e) => e.entryName.endsWith('.sql'));
    if (!sqlEntry) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: '备份文件中未找到 SQL 数据' });
      return;
    }

    const encryptedContent = sqlEntry.getData();

    let sqlContent: Buffer;
    try {
      sqlContent = decryptBuffer(encryptedContent, password);
    } catch {
      fs.unlinkSync(file.path);
      res.status(401).json({ error: '备份密码错误或文件已损坏' });
      return;
    }

    const sqlContentStr = sqlContent.toString('utf-8');
    if (!sqlContentStr.includes('PostgreSQL database dump') && !sqlContentStr.includes('pg_dump')) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: '备份文件格式无效' });
      return;
    }

    const tempSqlPath = path.join(backupsDir, `restore_${Date.now()}.sql`);
    fs.writeFileSync(tempSqlPath, sqlContent);

    try {
      const psqlArgs = [
        '-h', dbConfig.host,
        '-p', dbConfig.port,
        '-U', dbConfig.user,
        '-d', dbConfig.database,
        '-f', tempSqlPath,
      ];
      const psqlEnv = { ...process.env, PGPASSWORD: dbConfig.password };

      await execFileAsync('psql', psqlArgs, { env: psqlEnv, timeout: 600000 });
    } finally {
      fs.unlinkSync(tempSqlPath);
      fs.unlinkSync(file.path);
    }

    res.json({ success: true, message: '数据库恢复成功' });
  } catch (error) {
    console.error('Restore backup error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: '恢复数据库失败: ' + (error instanceof Error ? error.message : String(error)) });
  }
});

app.delete('/api/admin/backup/:filename', requireSuperAdmin, async (req, res) => {
  try {
    const { password } = req.query as { password?: string };
    const filename = req.params.filename;

    if (!BACKUP_PASSWORD) {
      res.status(500).json({ error: '未配置 BACKUP_PASSWORD 环境变量' });
      return;
    }

    if (!password || !verifyBackupPassword(password)) {
      res.status(401).json({ error: '备份密码错误' });
      return;
    }

    if (!sanitizeFilename(filename)) {
      res.status(400).json({ error: '无效的文件名' });
      return;
    }

    const filePath = path.join(backupsDir, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: '备份文件不存在' });
      return;
    }

    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete backup error:', error);
    res.status(500).json({ error: '删除备份失败' });
  }
});

app.get('/api/admin/:tab', requireAdmin, async (req, res) => {
  try {
    const tab = req.params.tab;

    if (tab === 'wiki') {
      const data = await prisma.wikiPage.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });
      res.json({ data: data.map(toWikiResponse) });
      return;
    }

    if (tab === 'posts') {
      const data = await prisma.post.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });
      res.json({ data: data.map(toPostResponse) });
      return;
    }

    if (tab === 'galleries') {
      const data = await prisma.gallery.findMany({
        include: {
          images: {
            include: {
              asset: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });
      res.json({ data: data.map(toGalleryResponse) });
      return;
    }

    if (tab === 'users') {
      const data = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      select: {
        uid: true,
        email: true,
        displayName: true,
        photoURL: true,
        role: true,
        status: true,
        banReason: true,
        bannedAt: true,
        level: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });
      res.json({ data: data.map(toUserResponse) });
      return;
    }

    if (tab === 'sections') {
      const data = await prisma.section.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        take: 100,
      });
      res.json({ data });
      return;
    }

    if (tab === 'announcements') {
      const data = await prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      res.json({ data });
      return;
    }

    if (tab === 'music') {
      const data = await prisma.musicTrack.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      res.json({
        data: data.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
      });
      return;
    }

    if (tab === 'locks') {
      await prisma.editLock.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      const data = await prisma.editLock.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      res.json({ data: data.map(toEditLockResponse) });
      return;
    }

    res.status(400).json({ error: '未知数据类型' });
  } catch (error) {
    console.error('Fetch admin data error:', error);
    res.status(500).json({ error: '获取管理数据失败' });
  }
});

app.get('/api/admin/:tab/:id', requireAdmin, async (req, res) => {
  try {
    const tab = req.params.tab;
    const id = req.params.id;

    if (tab === 'wiki') {
      const item = await prisma.wikiPage.findUnique({ where: { slug: id } });
      if (!item) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }
      res.json({ item: toWikiResponse(item) });
      return;
    }

    if (tab === 'posts') {
      const item = await prisma.post.findUnique({ where: { id } });
      if (!item) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }
      res.json({ item: toPostResponse(item) });
      return;
    }

    if (tab === 'galleries') {
      const item = await prisma.gallery.findUnique({
        where: { id },
        include: {
          images: {
            include: {
              asset: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
      if (!item) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }
      res.json({ item: toGalleryResponse(item) });
      return;
    }

    if (tab === 'users') {
      const item = await prisma.user.findUnique({
        where: { uid: id },
        select: {
          uid: true,
          email: true,
          displayName: true,
          photoURL: true,
          role: true,
          status: true,
          banReason: true,
          bannedAt: true,
          level: true,
          bio: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!item) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }
      res.json({ item: toUserResponse(item) });
      return;
    }

    if (tab === 'sections') {
      const item = await prisma.section.findUnique({ where: { id } });
      if (!item) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }
      res.json({ item });
      return;
    }

    if (tab === 'announcements') {
      const item = await prisma.announcement.findUnique({ where: { id } });
      if (!item) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }
      res.json({ item });
      return;
    }

    if (tab === 'music') {
      const item = await prisma.musicTrack.findUnique({ where: { docId: id } });
      if (!item) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }
      res.json({
        item: {
          ...item,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        },
      });
      return;
    }

    if (tab === 'locks') {
      const item = await prisma.editLock.findUnique({ where: { id } });
      if (!item) {
        res.status(404).json({ error: '记录不存在' });
        return;
      }
      res.json({ item: toEditLockResponse(item) });
      return;
    }

    res.status(400).json({ error: '未知数据类型' });
  } catch (error) {
    console.error('Fetch admin item error:', error);
    res.status(500).json({ error: '获取详情失败' });
  }
});

app.delete('/api/admin/:tab/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tab = req.params.tab;
    const id = req.params.id;

    if (tab === 'wiki') {
      await prisma.wikiPage.delete({ where: { slug: id } });
      res.json({ success: true });
      return;
    }
    if (tab === 'posts') {
      await prisma.post.delete({ where: { id } });
      res.json({ success: true });
      return;
    }
    if (tab === 'galleries') {
      const gallery = await prisma.gallery.findUnique({
        where: { id },
        include: { images: true },
      });
      if (!gallery) {
        res.status(404).json({ error: '图集不存在' });
        return;
      }
      await prisma.gallery.delete({ where: { id } });

      await Promise.all(
        gallery.images.map(async (image) => {
          if (image.assetId) {
            const linked = await prisma.galleryImage.count({ where: { assetId: image.assetId } });
            if (linked === 0) {
              const asset = await prisma.mediaAsset.findUnique({ where: { id: image.assetId } });
              if (asset) {
                await safeDeleteUploadFileByStorageKey(asset.storageKey);
                await prisma.mediaAsset.update({
                  where: { id: asset.id },
                  data: { status: 'deleted' },
                });
              }
            }
          } else {
            await safeDeleteUploadFileByUrl(image.url);
          }
        }),
      );
      res.json({ success: true });
      return;
    }
    if (tab === 'users') {
      const currentUser = req.authUser;
      if (currentUser?.uid === id) {
        res.status(400).json({ error: '不能删除自己' });
        return;
      }
      await prisma.user.delete({ where: { uid: id } });
      res.json({ success: true });
      return;
    }
    if (tab === 'sections') {
      await prisma.section.delete({ where: { id } });
      res.json({ success: true });
      return;
    }
    if (tab === 'announcements') {
      await prisma.announcement.delete({ where: { id } });
      res.json({ success: true });
      return;
    }
    if (tab === 'music') {
      await prisma.musicTrack.delete({ where: { docId: id } });
      res.json({ success: true });
      return;
    }

    if (tab === 'locks') {
      await prisma.editLock.delete({ where: { id } });
      res.json({ success: true });
      return;
    }

    res.status(400).json({ error: '未知删除类型' });
  } catch (error) {
    console.error('Delete admin data error:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: '单张图片不能超过 20MB' });
      return;
    }
    res.status(400).json({ error: err.message || '上传参数不合法' });
    return;
  }

  if (err.message?.includes('仅支持')) {
    res.status(400).json({ error: err.message });
    return;
  }

  console.error('Unhandled server error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
