import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const qdrantClientInstanceMock = {
  getCollections: vi.fn(),
  createCollection: vi.fn(),
  upsert: vi.fn(),
  search: vi.fn(),
  delete: vi.fn(),
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
    qdrantClientInstanceMock.delete.mockResolvedValue({ result: true });
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

  describe('upsertImageEmbeddingPoint', () => {
    it('upserts gallery type embedding point', async () => {
      const { upsertImageEmbeddingPoint } = await import('../../src/server/vector/qdrantService');

      await upsertImageEmbeddingPoint({
        pointId: 1,
        vector: [0.1, 0.2],
        sourceType: 'gallery',
        sourceId: 'img_1',
        imageUrl: 'https://example.com/1.jpg',
        galleryId: 'gal_1',
        galleryImageId: 'img_1',
        imageName: 'test.jpg',
        updatedAt: '2025-01-01T00:00:00Z',
      });

      expect(qdrantClientInstanceMock.getCollections).toHaveBeenCalled();
      expect(qdrantClientInstanceMock.upsert).toHaveBeenCalledWith(
        'hsf_image_embeddings',
        expect.objectContaining({
          wait: true,
          points: expect.arrayContaining([
            expect.objectContaining({
              id: 1,
              vector: [0.1, 0.2],
              payload: expect.objectContaining({
                sourceType: 'gallery',
                sourceId: 'img_1',
                imageUrl: 'https://example.com/1.jpg',
                galleryId: 'gal_1',
                galleryImageId: 'img_1',
                imageName: 'test.jpg',
              }),
            }),
          ]),
        }),
      );
    });

    it('upserts wiki type embedding point', async () => {
      const { upsertImageEmbeddingPoint } = await import('../../src/server/vector/qdrantService');

      await upsertImageEmbeddingPoint({
        pointId: 2,
        vector: [0.3, 0.4],
        sourceType: 'wiki',
        sourceId: 'page-slug',
        imageUrl: 'https://example.com/wiki.jpg',
        wikiPageSlug: 'page-slug',
        updatedAt: '2025-01-01T00:00:00Z',
      });

      expect(qdrantClientInstanceMock.upsert).toHaveBeenCalledWith(
        'hsf_image_embeddings',
        expect.objectContaining({
          wait: true,
          points: expect.arrayContaining([
            expect.objectContaining({
              id: 2,
              payload: expect.objectContaining({
                sourceType: 'wiki',
                sourceId: 'page-slug',
                wikiPageSlug: 'page-slug',
              }),
            }),
          ]),
        }),
      );
    });

    it('upserts post type embedding point', async () => {
      const { upsertImageEmbeddingPoint } = await import('../../src/server/vector/qdrantService');

      await upsertImageEmbeddingPoint({
        pointId: 3,
        vector: [0.5, 0.6],
        sourceType: 'post',
        sourceId: 'post_123',
        imageUrl: 'https://example.com/post.jpg',
        postId: 'post_123',
        updatedAt: '2025-01-01T00:00:00Z',
      });

      expect(qdrantClientInstanceMock.upsert).toHaveBeenCalledWith(
        'hsf_image_embeddings',
        expect.objectContaining({
          wait: true,
          points: expect.arrayContaining([
            expect.objectContaining({
              id: 3,
              payload: expect.objectContaining({
                sourceType: 'post',
                sourceId: 'post_123',
                postId: 'post_123',
              }),
            }),
          ]),
        }),
      );
    });
  });

  describe('searchImageEmbeddingPoints', () => {
    it('searches embedding points with score threshold', async () => {
      qdrantClientInstanceMock.search.mockResolvedValueOnce([
        {
          id: 1,
          score: 0.95,
          payload: {
            sourceType: 'gallery',
            sourceId: 'img_1',
            imageUrl: 'https://example.com/1.jpg',
            galleryId: 'gal_1',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        },
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
      expect(results[0].payload?.sourceType).toBe('gallery');
      expect(results[0].payload?.sourceId).toBe('img_1');
    });

    it('handles backward compatibility for old payload format', async () => {
      qdrantClientInstanceMock.search.mockResolvedValueOnce([
        {
          id: 1,
          score: 0.9,
          payload: {
            galleryImageId: 'old_img_1',
            galleryId: 'old_gal_1',
            imageUrl: 'https://example.com/old.jpg',
            imageName: 'old.jpg',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        },
      ]);

      const { searchImageEmbeddingPoints } = await import('../../src/server/vector/qdrantService');
      const results = await searchImageEmbeddingPoints({ vector: [0.1, 0.2], limit: 5 });

      expect(results).toHaveLength(1);
      expect(results[0].payload?.sourceType).toBe('gallery');
      expect(results[0].payload?.sourceId).toBe('old_img_1');
      expect(results[0].payload?.galleryImageId).toBe('old_img_1');
    });
  });

  describe('toEmbeddingPayload', () => {
    it('correctly parses new format payload', async () => {
      const { toEmbeddingPayload } = await import('../../src/server/vector/qdrantService');

      const payload = toEmbeddingPayload({
        sourceType: 'wiki',
        sourceId: 'wiki-page',
        imageUrl: 'https://example.com/wiki.png',
        wikiPageSlug: 'wiki-page',
        updatedAt: '2025-01-01T00:00:00Z',
      });

      expect(payload).toEqual({
        sourceType: 'wiki',
        sourceId: 'wiki-page',
        imageUrl: 'https://example.com/wiki.png',
        wikiPageSlug: 'wiki-page',
        updatedAt: '2025-01-01T00:00:00Z',
      });
    });

    it('returns null for null or undefined payload', async () => {
      const { toEmbeddingPayload } = await import('../../src/server/vector/qdrantService');

      expect(toEmbeddingPayload(null)).toBeNull();
      expect(toEmbeddingPayload(undefined)).toBeNull();
    });

    it('returns null for unrecognized payload format', async () => {
      const { toEmbeddingPayload } = await import('../../src/server/vector/qdrantService');

      expect(toEmbeddingPayload({ unknownField: 'value' })).toBeNull();
    });
  });

  describe('deleteImageEmbeddingPoint', () => {
    it('deletes embedding point by id', async () => {
      const { deleteImageEmbeddingPoint } = await import('../../src/server/vector/qdrantService');

      await deleteImageEmbeddingPoint(123);

      expect(qdrantClientInstanceMock.delete).toHaveBeenCalledWith(
        'hsf_image_embeddings',
        expect.objectContaining({
          wait: true,
          points: [123],
        }),
      );
    });
  });

  it('ensures collection only once across multiple calls', async () => {
    const { ensureQdrantCollection } = await import('../../src/server/vector/qdrantService');

    await Promise.all([ensureQdrantCollection(), ensureQdrantCollection(), ensureQdrantCollection()]);

    expect(qdrantClientInstanceMock.getCollections).toHaveBeenCalledTimes(1);
  });
});
