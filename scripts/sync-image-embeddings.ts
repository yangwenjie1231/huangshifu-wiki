import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

import { PrismaClient } from '@prisma/client';

import {
  enqueueGalleryImageEmbeddings,
  enqueueMissingImageEmbeddings,
  syncImageEmbeddingBatch,
} from '../src/server/vector/embeddingSync';
import { getEmbeddingModelName, getEmbeddingVectorSize } from '../src/server/vector/clipEmbedding';
import { getQdrantCollectionName } from '../src/server/vector/qdrantService';

dotenv.config({ path: '.env.local' });
dotenv.config();

const prisma = new PrismaClient();

function parseInteger(value: string | undefined, fallback: number, options?: { min?: number; max?: number }) {
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

function parseBooleanFlag(args: string[], flag: string) {
  return args.includes(flag);
}

function parseIds(args: string[]) {
  const idArg = args.find((arg) => arg.startsWith('--ids='));
  if (!idArg) {
    return [] as string[];
  }
  return idArg
    .slice('--ids='.length)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function run() {
  const args = process.argv.slice(2);
  const enqueueOnly = parseBooleanFlag(args, '--enqueue-only');
  const includeFailed = parseBooleanFlag(args, '--include-failed');
  const forceRebuild = parseBooleanFlag(args, '--force-rebuild');
  const skipEnqueue = parseBooleanFlag(args, '--skip-enqueue');
  const galleryImageIds = parseIds(args);

  const limit = parseInteger(
    args.find((arg) => arg.startsWith('--limit='))?.slice('--limit='.length),
    parseInteger(process.env.IMAGE_EMBEDDING_BATCH_SIZE, 100, { min: 1, max: 500 }),
    { min: 1, max: 500 },
  );

  const enqueueLimit = parseInteger(
    args.find((arg) => arg.startsWith('--enqueue-limit='))?.slice('--enqueue-limit='.length),
    1000,
    { min: 1, max: 10000 },
  );

  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  console.log('[embeddings] model=', getEmbeddingModelName());
  console.log('[embeddings] vectorSize=', getEmbeddingVectorSize());
  console.log('[embeddings] collection=', getQdrantCollectionName());
  console.log('[embeddings] uploadsDir=', uploadsDir);

  if (!skipEnqueue && galleryImageIds.length === 0) {
    const enqueueResult = await enqueueMissingImageEmbeddings(prisma, enqueueLimit);
    console.log('[embeddings] enqueue-missing', enqueueResult);
  }

  if (galleryImageIds.length > 0) {
    console.log('[embeddings] target galleryImageIds=', galleryImageIds.length);
  }

  if (enqueueOnly) {
    if (galleryImageIds.length > 0) {
      const queued = await enqueueGalleryImageEmbeddings(prisma, galleryImageIds);
      console.log('[embeddings] enqueue-only targeted result=', queued);
    }
    return;
  }

  const syncResult = await syncImageEmbeddingBatch(prisma, uploadsDir, {
    limit,
    includeFailed,
    forceRebuild,
    galleryImageIds,
  });

  console.log('[embeddings] sync result', {
    requested: syncResult.requested,
    picked: syncResult.picked,
    ready: syncResult.ready,
    failed: syncResult.failed,
    skipped: syncResult.skipped,
  });

  if (syncResult.details.length > 0) {
    const preview = syncResult.details.slice(0, 20);
    console.log('[embeddings] details preview', preview);
    if (syncResult.details.length > preview.length) {
      console.log(`[embeddings] details truncated: ${syncResult.details.length - preview.length} more`);
    }
  }
}

run()
  .catch((error) => {
    console.error('[embeddings] fatal', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
