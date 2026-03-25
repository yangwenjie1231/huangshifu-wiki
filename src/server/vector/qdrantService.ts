import { QdrantClient } from '@qdrant/js-client-rest';

const DEFAULT_COLLECTION = 'hsf_image_embeddings';
const DEFAULT_DISTANCE: 'Cosine' | 'Dot' | 'Euclid' | 'Manhattan' = 'Cosine';

let qdrantClient: QdrantClient | null = null;
let ensureCollectionPromise: Promise<void> | null = null;

function parseInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function getQdrantCollectionName() {
  return process.env.QDRANT_COLLECTION || DEFAULT_COLLECTION;
}

function getQdrantUrl() {
  return process.env.QDRANT_URL || 'http://127.0.0.1:6333';
}

function getQdrantApiKey() {
  return process.env.QDRANT_API_KEY || undefined;
}

function getVectorSize() {
  return parseInteger(process.env.IMAGE_EMBEDDING_VECTOR_SIZE, 512);
}

export function getQdrantClient() {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({
      url: getQdrantUrl(),
      apiKey: getQdrantApiKey(),
    });
  }
  return qdrantClient;
}

export async function ensureQdrantCollection() {
  if (!ensureCollectionPromise) {
    ensureCollectionPromise = (async () => {
      const client = getQdrantClient();
      const collectionName = getQdrantCollectionName();

      const collections = await client.getCollections();
      const exists = collections.collections.some((collection) => collection.name === collectionName);
      if (exists) {
        return;
      }

      await client.createCollection(collectionName, {
        vectors: {
          size: getVectorSize(),
          distance: DEFAULT_DISTANCE,
        },
        hnsw_config: {
          m: 16,
          ef_construct: 128,
        },
      });
    })().catch((error) => {
      ensureCollectionPromise = null;
      throw error;
    });
  }

  return ensureCollectionPromise;
}

export async function upsertImageEmbeddingPoint(params: {
  pointId: number;
  vector: number[];
  payload: {
    galleryImageId: string;
    galleryId: string;
    imageUrl: string;
    imageName: string;
    updatedAt: string;
  };
}) {
  await ensureQdrantCollection();
  const client = getQdrantClient();
  const collectionName = getQdrantCollectionName();

  await client.upsert(collectionName, {
    wait: true,
    points: [
      {
        id: params.pointId,
        vector: params.vector,
        payload: params.payload,
      },
    ],
  });
}

export async function searchImageEmbeddingPoints(params: {
  vector: number[];
  limit: number;
  minScore?: number;
}) {
  await ensureQdrantCollection();
  const client = getQdrantClient();
  const collectionName = getQdrantCollectionName();

  return client.search(collectionName, {
    vector: params.vector,
    limit: params.limit,
    score_threshold: params.minScore,
    with_payload: true,
    with_vector: false,
  });
}
