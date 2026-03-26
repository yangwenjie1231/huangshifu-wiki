import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const qdrantClientInstanceMock = {
  getCollections: vi.fn(),
  createCollection: vi.fn(),
  upsert: vi.fn(),
  search: vi.fn(),
};

vi.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: vi.fn(() => qdrantClientInstanceMock),
}));

describe('qdrantService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    qdrantClientInstanceMock.getCollections.mockResolvedValue({ collections: [] });
    qdrantClientInstanceMock.createCollection.mockResolvedValue({ result: true });
    qdrantClientInstanceMock.upsert.mockResolvedValue({ result: true });
    qdrantClientInstanceMock.search.mockResolvedValue([]);
    delete process.env.QDRANT_COLLECTION;
    delete process.env.QDRANT_URL;
    delete process.env.QDRANT_API_KEY;
    delete process.env.IMAGE_EMBEDDING_VECTOR_SIZE;
  });

  it('uses defaults when env vars are unset', async () => {
    const { getQdrantCollectionName, getQdrantClient } = await import('../../src/server/vector/qdrantService');
    expect(getQdrantCollectionName()).toBe('hsf_image_embeddings');
    expect(getQdrantClient()).toBeDefined();
  });

  it('reads collection name and vector size from env', async () => {
    process.env.QDRANT_COLLECTION = 'custom_collection';
    process.env.QDRANT_URL = 'http://custom:6333';
    process.env.QDRANT_API_KEY = 'secret_key';
    process.env.IMAGE_EMBEDDING_VECTOR_SIZE = '256';

    const { getQdrantCollectionName, getQdrantClient } = await import('../../src/server/vector/qdrantService');
    expect(getQdrantCollectionName()).toBe('custom_collection');

    const client = getQdrantClient();
    expect(client).toBeDefined();
  });

  it('creates collection when it does not exist', async () => {
    qdrantClientInstanceMock.getCollections.mockResolvedValueOnce({ collections: [] });

    const { ensureQdrantCollection } = await import('../../src/server/vector/qdrantService');
    await ensureQdrantCollection();

    expect(qdrantClientInstanceMock.createCollection).toHaveBeenCalledWith(
      'hsf_image_embeddings',
      expect.objectContaining({
        vectors: expect.objectContaining({ size: 512, distance: 'Cosine' }),
      }),
    );
  });

  it('skips creation when collection already exists', async () => {
    qdrantClientInstanceMock.getCollections.mockResolvedValueOnce({
      collections: [{ name: 'hsf_image_embeddings' }],
    });

    const { ensureQdrantCollection } = await import('../../src/server/vector/qdrantService');
    await ensureQdrantCollection();

    expect(qdrantClientInstanceMock.createCollection).not.toHaveBeenCalled();
  });

  it('upserts embedding point after ensuring collection', async () => {
    const { upsertImageEmbeddingPoint } = await import('../../src/server/vector/qdrantService');

    await upsertImageEmbeddingPoint({
      pointId: 1,
      vector: [0.1, 0.2],
      payload: {
        galleryImageId: 'img_1',
        galleryId: 'gal_1',
        imageUrl: 'https://example.com/1.jpg',
        imageName: 'test.jpg',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    });

    expect(qdrantClientInstanceMock.getCollections).toHaveBeenCalled();
    expect(qdrantClientInstanceMock.upsert).toHaveBeenCalledWith(
      'hsf_image_embeddings',
      expect.objectContaining({
        wait: true,
        points: expect.arrayContaining([
          expect.objectContaining({ id: 1, vector: [0.1, 0.2] }),
        ]),
      }),
    );
  });

  it('searches embedding points with score threshold', async () => {
    qdrantClientInstanceMock.search.mockResolvedValueOnce([
      { id: 1, score: 0.95, payload: { galleryImageId: 'img_1' } },
    ]);

    const { searchImageEmbeddingPoints } = await import('../../src/server/vector/qdrantService');
    const results = await searchImageEmbeddingPoints({ vector: [0.1, 0.2], limit: 5, minScore: 0.8 });

    expect(qdrantClientInstanceMock.search).toHaveBeenCalledWith(
      'hsf_image_embeddings',
      expect.objectContaining({
        vector: [0.1, 0.2],
        limit: 5,
        score_threshold: 0.8,
        with_payload: true,
        with_vector: false,
      }),
    );
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
  });

  it('ensures collection only once across multiple calls', async () => {
    const { ensureQdrantCollection } = await import('../../src/server/vector/qdrantService');

    await Promise.all([ensureQdrantCollection(), ensureQdrantCollection(), ensureQdrantCollection()]);

    expect(qdrantClientInstanceMock.getCollections).toHaveBeenCalledTimes(1);
  });
});