// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSearchHistory } from '../../src/hooks/useSearchHistory'

const STORAGE_KEY = 'huangshifu_search_history'

describe('useSearchHistory', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('loads valid history from localStorage', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ query: '黄诗扶', timestamp: 123 }]))

    const { result } = renderHook(() => useSearchHistory())

    expect(result.current.history).toEqual([{ query: '黄诗扶', timestamp: 123 }])
  })

  it('ignores corrupted localStorage data', () => {
    window.localStorage.setItem(STORAGE_KEY, '{bad json')

    const { result } = renderHook(() => useSearchHistory())

    expect(result.current.history).toEqual([])
  })

  it('adds trimmed queries, dedupes them, and keeps the latest 10 entries', () => {
    const nowSpy = vi.spyOn(Date, 'now')
    let now = 1000
    nowSpy.mockImplementation(() => now++)

    const { result } = renderHook(() => useSearchHistory())

    act(() => {
      for (let i = 1; i <= 11; i += 1) {
        result.current.addToHistory(`  关键词${i}  `)
      }
      result.current.addToHistory('关键词3')
    })

    expect(result.current.history).toHaveLength(10)
    expect(result.current.history[0].query).toBe('关键词3')
    expect(result.current.history.filter((item) => item.query === '关键词3')).toHaveLength(1)
    expect(result.current.history.some((item) => item.query === '关键词1')).toBe(false)
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')).toEqual(
      result.current.history
    )
  })

  it('removes a single item and clears all history', () => {
    const { result } = renderHook(() => useSearchHistory())

    act(() => {
      result.current.addToHistory('词条一')
      result.current.addToHistory('词条二')
    })

    act(() => {
      result.current.removeFromHistory('词条一')
    })

    expect(result.current.history.map((item) => item.query)).toEqual(['词条二'])
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')).toHaveLength(1)

    act(() => {
      result.current.clearHistory()
    })

    expect(result.current.history).toEqual([])
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
