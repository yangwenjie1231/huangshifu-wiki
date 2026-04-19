/**
 * 图片同步 Hook
 * 用于管理图片存储策略切换后的自动同步任务
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiGet, apiPost, apiDelete } from '../lib/apiClient';

export interface SyncTask {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  strategy: 's3' | 'external';
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
  startedAt: string;
  completedAt?: string;
  progress: number;
}

export interface UseImageSyncReturn {
  /** 当前同步任务 */
  task: SyncTask | null;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 获取同步任务状态 */
  fetchTask: (taskId?: string) => Promise<void>;
  /** 手动启动同步任务 */
  startSync: (strategy: 's3' | 'external') => Promise<SyncTask | null>;
  /** 取消同步任务 */
  cancelSync: (taskId: string) => Promise<boolean>;
  /** 刷新任务状态（轮询） */
  startPolling: (interval?: number) => void;
  /** 停止轮询 */
  stopPolling: () => void;
}

/**
 * 图片同步管理 Hook
 */
export function useImageSync(): UseImageSyncReturn {
  const [task, setTask] = useState<SyncTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 获取同步任务状态
   */
  const fetchTask = useCallback(async (taskId?: string) => {
    try {
      const response = await apiGet<{ task: SyncTask | null }>(
        '/api/config/image-sync',
        taskId ? { taskId } : {}
      );
      setTask(response.task);
      setError(null);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : '获取同步状态失败';
      setError(errorMsg);
      console.error('Fetch sync task error:', e);
    }
  }, []);

  /**
   * 手动启动同步任务
   */
  const startSync = useCallback(async (strategy: 's3' | 'external'): Promise<SyncTask | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiPost<{
        success: boolean;
        task: SyncTask;
      }>('/api/config/image-sync', { strategy });

      setTask(response.task);
      return response.task;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : '启动同步任务失败';
      setError(errorMsg);
      console.error('Start sync task error:', e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 取消同步任务
   */
  const cancelSync = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      await apiDelete(`/api/config/image-sync/${taskId}`);
      await fetchTask(taskId);
      return true;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : '取消同步任务失败';
      setError(errorMsg);
      console.error('Cancel sync task error:', e);
      return false;
    }
  }, [fetchTask]);

  /**
   * 开始轮询任务状态
   */
  const startPolling = useCallback((interval: number = 3000) => {
    // 先停止现有轮询
    stopPolling();

    // 立即获取一次
    fetchTask();

    // 设置轮询
    pollingRef.current = setInterval(() => {
      fetchTask();
    }, interval);
  }, [fetchTask]);

  /**
   * 停止轮询
   */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // 组件卸载时停止轮询
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // 当任务完成或失败时自动停止轮询
  useEffect(() => {
    if (task && (task.status === 'completed' || task.status === 'failed')) {
      stopPolling();
    }
  }, [task, stopPolling]);

  return {
    task,
    loading,
    error,
    fetchTask,
    startSync,
    cancelSync,
    startPolling,
    stopPolling,
  };
}

export default useImageSync;
