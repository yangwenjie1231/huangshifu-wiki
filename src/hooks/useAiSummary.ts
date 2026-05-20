import { useState, useCallback } from 'react'

export interface UseAiSummaryOptions {
  content: string | null | undefined
  summarizeFn: (content: string) => Promise<string>
  toast?: { show: (msg: string, opts?: { variant?: string }) => void }
  errorMessage?: string
  emptyMessage?: string
}

export interface UseAiSummaryReturn {
  summary: string | null
  summarizing: boolean
  generateSummary: () => Promise<void>
  clearSummary: () => void
}

export function useAiSummary({
  content,
  summarizeFn,
  toast,
  errorMessage = 'AI摘要生成失败',
  emptyMessage = '页面内容为空，无法生成摘要',
}: UseAiSummaryOptions): UseAiSummaryReturn {
  const [summary, setSummary] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState(false)

  const generateSummary = useCallback(async () => {
    if (summarizing) return

    if (!content?.trim()) {
      toast?.show(emptyMessage, { variant: 'error' })
      return
    }

    setSummarizing(true)
    try {
      const result = await summarizeFn(content)
      setSummary(result)
    } catch {
      toast?.show(errorMessage, { variant: 'error' })
    } finally {
      setSummarizing(false)
    }
  }, [content, summarizeFn, toast, summarizing, errorMessage, emptyMessage])

  const clearSummary = useCallback(() => {
    setSummary(null)
  }, [])

  return { summary, summarizing, generateSummary, clearSummary }
}
