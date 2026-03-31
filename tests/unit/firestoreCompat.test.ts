import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { collection, db, getDocs, orderBy, query, where } from '../../src/lib/firebaseCompat/firestore';

describe('firebase compat firestore', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('forwards wiki tag filters to the api and applies array-contains locally', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        pages: [
          {
            slug: 'tag-match',
            title: 'Tag Match',
            category: 'music',
            tags: ['主题曲', '现场'],
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
          {
            slug: 'category-only',
            title: 'Category Only',
            category: 'music',
            tags: ['花絮'],
            updatedAt: '2026-03-02T00:00:00.000Z',
          },
        ],
      }), { status: 200 }),
    );

    const snapshot = await getDocs(query(
      collection(db, 'wiki'),
      where('category', '==', 'music'),
      where('tags', 'array-contains', '主题曲'),
      orderBy('updatedAt', 'desc'),
    ));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/wiki?category=music&tag=%E4%B8%BB%E9%A2%98%E6%9B%B2');
    expect(snapshot.docs.map((doc) => doc.id)).toEqual(['tag-match']);
  });
});
