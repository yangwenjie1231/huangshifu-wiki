import { useState, useCallback } from 'react';
import type { AppError } from '../lib/errorHandler';

interface UseApiState<T> {
  data: T | null;
  error: AppError | null;
  loading: boolean;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (fn: () => Promise<T>) => Promise<T | void>;
  reset: () => void;
}

/**
 * 自定义 Hook 用于简化 API 调用的状态管理
 * @returns 状态和执行函数
 */
export function useApi<T>(): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    loading: false,
  });

  const execute = useCallback(async (fn: () => Promise<T>) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await fn();
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error as AppError,
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, error: null, loading: false });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

interface UseApiWithToastReturn<T> extends UseApiReturn<T> {
  // 同 useApi，但会自动显示错误提示
}

/**
 * 自定义 Hook 用于简化 API 调用并自动显示错误提示
 * 需要配合 Toast 系统使用
 * @param showToast - 是否显示 Toast 提示（默认 true）
 * @returns 状态和执行函数
 */
export function useApiWithToast<T>(showToast: boolean = true): UseApiWithToastReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    loading: false,
  });

  const execute = useCallback(async (fn: () => Promise<T>) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await fn();
      setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      const appError = error as AppError;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: appError,
      }));
      
      // 自动显示错误提示
      if (showToast) {
        // 这里可以集成 Toast 系统
        // 例如：toast.error(getUserFriendlyMessage(appError));
        console.warn('[useApiWithToast] Error:', appError.message);
      }
      
      throw appError;
    }
  }, [showToast]);

  const reset = useCallback(() => {
    setState({ data: null, error: null, loading: false });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

export default useApi;
