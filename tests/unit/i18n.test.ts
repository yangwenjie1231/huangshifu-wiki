import { describe, it, expect } from 'vitest';
import { getI18n } from '../../src/lib/i18n';

describe('getI18n', () => {
  describe('theme selection', () => {
    it('returns t function for default theme', () => {
      const { t } = getI18n('default');
      expect(typeof t).toBe('function');
    });

    it('returns t function for academy theme', () => {
      const { t } = getI18n('academy');
      expect(typeof t).toBe('function');
    });

    it('falls back to defaultLocale for unknown theme', () => {
      const unknownTheme = getI18n('unknown_theme');
      const defaultTheme = getI18n('default');

      expect(unknownTheme.t('nav.home')).toBe(defaultTheme.t('nav.home'));
    });
  });

  describe('nested value retrieval', () => {
    it('retrieves top-level values', () => {
      const { t } = getI18n('default');
      expect(t('app.title')).toBe('黄诗扶wiki');
    });

    it('retrieves nested values using dot notation', () => {
      const { t } = getI18n('default');
      expect(t('nav.home')).toBe('首页');
    });

    it('retrieves deeply nested values', () => {
      const { t } = getI18n('default');
      expect(t('home.hero.title')).toBe('欢迎来到黄诗扶wiki');
    });

    it('retrieves deeply nested values with academy theme', () => {
      const { t } = getI18n('academy');
      expect(t('home.hero.title')).toBe('欢迎来到从前书院');
    });

    it('returns the key itself if not found', () => {
      const { t } = getI18n('default');
      expect(t('non.existent.key')).toBe('non.existent.key');
    });
  });

  describe('parameter replacement', () => {
    it('replaces single parameter', () => {
      const { t } = getI18n('default');
      expect(t('music.selectedCount', { count: 5 })).toBe('已选择 5 首歌曲');
    });

    it('replaces parameter with zero', () => {
      const { t } = getI18n('default');
      expect(t('music.selectedCount', { count: 0 })).toBe('已选择 0 首歌曲');
    });

    it('replaces parameter with string value', () => {
      const { t } = getI18n('default');
      expect(t('music.selectedCount', { count: '10' })).toBe('已选择 10 首歌曲');
    });

    it('replaces multiple parameters in same string', () => {
      const { t } = getI18n('default');
      expect(t('music.confirmDeleteBatch', { count: 3 })).toBe('您确定要删除选中的 3 首歌曲吗？此操作无法撤销。');
    });

    it('keeps original placeholder for unknown parameter', () => {
      const { t } = getI18n('default');
      expect(t('music.selectedCount', { unknown: 5 })).toBe('已选择 {{count}} 首歌曲');
    });

    it('handles missing params object gracefully', () => {
      const { t } = getI18n('default');
      expect(t('music.selectedCount')).toBe('已选择 {{count}} 首歌曲');
    });
  });

  describe('theme-specific translations', () => {
    it('returns academy-specific translation', () => {
      const { t } = getI18n('academy');
      expect(t('nav.home')).toBe('书院大堂');
    });

    it('returns default theme translation', () => {
      const { t } = getI18n('default');
      expect(t('nav.home')).toBe('首页');
    });

    it('returns different translations for same key between themes', () => {
      const defaultTheme = getI18n('default');
      const academyTheme = getI18n('academy');

      expect(defaultTheme.t('app.title')).toBe('黄诗扶wiki');
      expect(academyTheme.t('app.title')).toBe('从前书院 · 黄诗扶生日特别版');
    });
  });
});
