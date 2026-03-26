import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiUpload } from '../../src/lib/apiClient';

describe('apiClient', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('builds query string and uses default request options', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const data = await apiGet<{ ok: boolean }>('/api/posts', {
      section: 'music',
      page: 2,
      includeDraft: false,
      ignoredEmpty: '',
      ignoredNull: null,
      ignoredUndefined: undefined,
    });

    expect(data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/posts?section=music&page=2&includeDraft=false');
    expect(options).toMatchObject({
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  it('sends JSON body for write requests', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ saved: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ saved: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ saved: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ removed: true }), { status: 200 }));

    await apiPost('/api/posts', { title: 'post' });
    await apiPut('/api/posts/1', { title: 'updated' });
    await apiPatch('/api/posts/1', { title: 'patched' });
    await apiDelete('/api/posts/1');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/posts',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ title: 'post' }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/posts/1',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ title: 'updated' }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/posts/1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ title: 'patched' }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/posts/1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws backend error message when request fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
      }),
    );

    await expect(apiGet('/api/secret')).rejects.toThrow('forbidden');
  });

  it('uploads multipart form data without JSON headers', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ file: { url: '/uploads/demo.png' } }), { status: 200 }),
    );

    const formData = new FormData();
    formData.append('file', new Blob(['hello'], { type: 'text/plain' }), 'demo.txt');

    const data = await apiUpload<{ file: { url: string } }>('/api/uploads', formData);
    expect(data.file.url).toBe('/uploads/demo.png');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/uploads',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: formData,
      }),
    );
  });
});
