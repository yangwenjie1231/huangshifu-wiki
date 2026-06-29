import React from 'react'
import { useI18n } from '../../lib/i18n'

interface BatchActionsProps {
  selectedCount: number
  onCancelSelect: () => void
  onBatchDelete: () => void
}

const BatchActions: React.FC<BatchActionsProps> = ({
  selectedCount,
  onCancelSelect,
  onBatchDelete,
}) => {
  const { t } = useI18n()

  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-surface text-text-primary border border-border px-6 py-3 rounded flex items-center gap-6 shadow-lg">
      <span className="text-sm font-semibold tracking-wide">
        {t('music.selectedCount', { count: selectedCount })}
      </span>
      <div className="flex gap-3">
        <button
          onClick={onCancelSelect}
          className="text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          {t('music.cancelSelect')}
        </button>
        <button
          onClick={onBatchDelete}
          className="px-5 py-1.5 theme-button-primary rounded text-sm font-semibold transition-all"
        >
          {t('music.batchDelete')}
        </button>
      </div>
    </div>
  )
}

export { BatchActions }
export type { BatchActionsProps }
