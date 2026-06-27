import { useCallback, useState } from 'react'

const STORAGE_KEY = 'huangshifu_search_history'
const MAX_HISTORY = 10

export interface SearchHistoryItem {
  query: string
  timestamp: number
}

function normalizeHistory(value: unknown): SearchHistoryItem[] {
  if (!Array.isArray(value)) return []

  return value
    .filter(
      (item): item is SearchHistoryItem =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as SearchHistoryItem).query === 'string' &&
        typeof (item as SearchHistoryItem).timestamp === 'number'
    )
    .map((item) => ({ query: item.query.trim(), timestamp: item.timestamp }))
    .filter((item) => item.query.length > 0)
    .slice(0, MAX_HISTORY)
}

function readHistory(): SearchHistoryItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    return normalizeHistory(JSON.parse(stored))
  } catch {
    return []
  }
}

function persistHistory(history: SearchHistoryItem[]) {
  try {
    if (history.length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    }
  } catch {
    // localStorage may be unavailable or full.
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>(readHistory)

  const addToHistory = useCallback((query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return

    setHistory((prev) => {
      const nextHistory = [
        { query: trimmed, timestamp: Date.now() },
        ...prev.filter((item) => item.query !== trimmed),
      ].slice(0, MAX_HISTORY)
      persistHistory(nextHistory)
      return nextHistory
    })
  }, [])

  const removeFromHistory = useCallback((query: string) => {
    setHistory((prev) => {
      const nextHistory = prev.filter((item) => item.query !== query)
      persistHistory(nextHistory)
      return nextHistory
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    persistHistory([])
  }, [])

  return { history, addToHistory, removeFromHistory, clearHistory }
}
