import { useState, useEffect, useCallback } from 'react';
import { LskyProAPI, LskyProAPIError, type Album, type PaginatedResponse } from '../lib/lskyClient';

interface UseLskyAlbumsOptions {
  baseUrl?: string;
  token?: string;
  autoFetch?: boolean;
  initialPage?: number;
  initialPerPage?: number;
}

interface AlbumsState {
  loading: boolean;
  error: string | null;
  albums: Album[];
  pagination: PaginatedResponse<Album>['meta']['pagination'] | null;
  currentAlbum: Album | null;
}

export function useLskyAlbums(options: UseLskyAlbumsOptions = {}) {
  const [state, setState] = useState<AlbumsState>({
    loading: false,
    error: null,
    albums: [],
    pagination: null,
    currentAlbum: null,
  });

  const baseUrl = options.baseUrl || import.meta.env.VITE_LSKY_BASE_URL || '';
  const api = new LskyProAPI({ baseUrl, token: options.token });

  const fetchAlbums = useCallback(async (params?: {
    page?: number;
    per_page?: number;
  }) => {
    if (!baseUrl) {
      setState(prev => ({ ...prev, error: 'LSKY_BASE_URL 未配置' }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await api.albums.list({
        page: params?.page ?? options.initialPage ?? 1,
        per_page: params?.per_page ?? options.initialPerPage ?? 20,
      });

      setState({
        loading: false,
        error: null,
        albums: result.data.data,
        pagination: result.data.meta.pagination,
        currentAlbum: null,
      });
    } catch (err) {
      const errorMessage = err instanceof LskyProAPIError 
        ? err.message 
        : err instanceof Error 
          ? err.message 
          : '获取相册列表失败';

      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
    }
  }, [baseUrl, options.initialPage, options.initialPerPage, api]);

  const fetchAlbum = useCallback(async (id: number) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await api.albums.get(id);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        currentAlbum: result.data 
      }));
      return result.data;
    } catch (err) {
      const errorMessage = err instanceof LskyProAPIError 
        ? err.message 
        : '获取相册详情失败';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      return null;
    }
  }, [api]);

  const createAlbum = useCallback(async (data: {
    name: string;
    description?: string;
    status?: number;
  }) => {
    try {
      const result = await api.albums.create(data);
      setState(prev => ({
        ...prev,
        albums: [...prev.albums, result.data],
      }));
      return result.data;
    } catch (err) {
      const errorMessage = err instanceof LskyProAPIError 
        ? err.message 
        : '创建相册失败';
      setState(prev => ({ ...prev, error: errorMessage }));
      return null;
    }
  }, [api]);

  const updateAlbum = useCallback(async (id: number, data: Partial<{
    name: string;
    description: string;
    status: number;
  }>) => {
    try {
      const result = await api.albums.update(id, data);
      setState(prev => ({
        ...prev,
        albums: prev.albums.map(a => a.id === id ? result.data : a),
        currentAlbum: prev.currentAlbum?.id === id ? result.data : prev.currentAlbum,
      }));
      return result.data;
    } catch (err) {
      const errorMessage = err instanceof LskyProAPIError 
        ? err.message 
        : '更新相册失败';
      setState(prev => ({ ...prev, error: errorMessage }));
      return null;
    }
  }, [api]);

  const deleteAlbum = useCallback(async (id: number) => {
    try {
      await api.albums.delete(id);
      setState(prev => ({
        ...prev,
        albums: prev.albums.filter(a => a.id !== id),
        currentAlbum: prev.currentAlbum?.id === id ? null : prev.currentAlbum,
      }));
      return true;
    } catch (err) {
      const errorMessage = err instanceof LskyProAPIError 
        ? err.message 
        : '删除相册失败';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [api]);

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchAlbums();
    }
  }, [options.autoFetch, fetchAlbums]);

  return {
    ...state,
    fetchAlbums,
    fetchAlbum,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    api,
  };
}
