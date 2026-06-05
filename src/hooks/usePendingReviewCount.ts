import { useEffect, useState } from 'react'
import { apiGet } from '../lib/apiClient'
import type { AdminReviewQueueCountResponse } from '../types/api'

export const PENDING_REVIEW_COUNT_PATH = '/api/admin/review-queue/count'

const pendingReviewCountListeners = new Set<() => void>()

export function notifyPendingReviewCountChanged() {
  pendingReviewCountListeners.forEach((listener) => listener())
}

export function usePendingReviewCount(enabled: boolean) {
  const [count, setCount] = useState(0)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    if (!enabled) return

    const listener = () => setRefreshTick((tick) => tick + 1)
    pendingReviewCountListeners.add(listener)

    return () => {
      pendingReviewCountListeners.delete(listener)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }

    let cancelled = false

    const fetchCount = async () => {
      try {
        const data = await apiGet<AdminReviewQueueCountResponse>(
          PENDING_REVIEW_COUNT_PATH,
          { status: 'pending' },
          { staleTime: 15000, swr: true }
        )

        if (!cancelled) {
          setCount(data.total)
        }
      } catch (error) {
        console.error('Fetch pending review count failed:', error)
        if (!cancelled) {
          setCount(0)
        }
      }
    }

    void fetchCount()

    return () => {
      cancelled = true
    }
  }, [enabled, refreshTick])

  return count
}
