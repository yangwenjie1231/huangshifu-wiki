import { useState, useCallback, useRef } from 'react'
import type { AppError } from '../lib/errorHandler'
import { getUserFriendlyMessage } from '../lib/errorHandler'
import { useToast } from '../components/Toast'

interface UseApiState<T> {
  data: T | null
  error: AppError | null
  loading: boolean
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (fn: () => Promise<T>) => Promise<T | void>
  reset: () => void
}

export function useApi<T>(): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    loading: false,
  })

  const requestIdRef = useRef(0)

  const execute = useCallback(async (fn: () => Promise<T>) => {
    const currentRequestId = ++requestIdRef.current
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const data = await fn()

      if (currentRequestId !== requestIdRef.current) return

      setState({ data, error: null, loading: false })
      return data
    } catch (error) {
      if (currentRequestId !== requestIdRef.current) return

      setState((prev) => ({
        ...prev,
        loading: false,
        error: error as AppError,
      }))
    }
  }, [])

  const reset = useCallback(() => {
    setState({ data: null, error: null, loading: false })
  }, [])

  return {
    ...state,
    execute,
    reset,
  }
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
  })

  const requestIdRef = useRef(0)
  const { show: showToastFn } = useToast()

  const execute = useCallback(
    async (fn: () => Promise<T>) => {
      const currentRequestId = ++requestIdRef.current
      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const data = await fn()

        if (currentRequestId !== requestIdRef.current) return

        setState({ data, error: null, loading: false })
        return data
      } catch (error) {
        if (currentRequestId !== requestIdRef.current) return

        const appError = error as AppError
        setState((prev) => ({
          ...prev,
          loading: false,
          error: appError,
        }))

        if (showToast) {
          try {
            showToastFn(getUserFriendlyMessage(appError), { variant: 'error' })
          } catch {
            console.warn('[useApiWithToast] Error:', getUserFriendlyMessage(appError))
          }
        }

        throw appError
      }
    },
    [showToast, showToastFn]
  )

  const reset = useCallback(() => {
    setState({ data: null, error: null, loading: false })
  }, [])

  return {
    ...state,
    execute,
    reset,
  }
}

export default useApi
