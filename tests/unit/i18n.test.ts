import { describe, it, expect } from 'vitest'
import { getI18n } from '../../src/lib/i18n'

describe('getI18n', () => {
  describe('locale retrieval', () => {
    it('returns t function', () => {
      const { t } = getI18n()
      expect(typeof t).toBe('function')
    })

    it('always returns default locale', () => {
      const locale = getI18n()
      expect(locale.t('nav.home')).toBe('首页')
    })
  })

  describe('nested value retrieval', () => {
    it('retrieves top-level values', () => {
      const { t } = getI18n()
      expect(t('app.title')).toBe('黄诗扶wiki')
    })

    it('retrieves nested values using dot notation', () => {
      const { t } = getI18n()
      expect(t('nav.home')).toBe('首页')
    })

    it('retrieves deeply nested values', () => {
      const { t } = getI18n()
      expect(t('home.hero.title')).toBe('欢迎来到黄诗扶wiki')
    })

    it('returns the key itself if not found', () => {
      const { t } = getI18n()
      expect(t('non.existent.key')).toBe('non.existent.key')
    })
  })

  describe('parameter replacement', () => {
    it('replaces single parameter', () => {
      const { t } = getI18n()
      expect(t('music.selectedCount', { count: 5 })).toBe('已选择 5 首歌曲')
    })

    it('replaces parameter with zero', () => {
      const { t } = getI18n()
      expect(t('music.selectedCount', { count: 0 })).toBe('已选择 0 首歌曲')
    })

    it('replaces parameter with string value', () => {
      const { t } = getI18n()
      expect(t('music.selectedCount', { count: '10' })).toBe('已选择 10 首歌曲')
    })

    it('replaces multiple parameters in same string', () => {
      const { t } = getI18n()
      expect(t('music.confirmDeleteBatch', { count: 3 })).toBe(
        '您确定要删除选中的 3 首歌曲吗？此操作无法撤销。'
      )
    })

    it('keeps original placeholder for unknown parameter', () => {
      const { t } = getI18n()
      expect(t('music.selectedCount', { unknown: 5 })).toBe('已选择 {{count}} 首歌曲')
    })

    it('handles missing params object gracefully', () => {
      const { t } = getI18n()
      expect(t('music.selectedCount')).toBe('已选择 {{count}} 首歌曲')
    })
  })
})
