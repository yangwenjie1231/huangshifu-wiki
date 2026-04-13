import { describe, expect, it } from 'vitest';

import { getStatusText, splitTagsInput } from '../../src/lib/contentUtils';

describe('contentUtils', () => {
  describe('splitTagsInput', () => {
    it('splits comma-separated values and trims whitespace', () => {
      expect(splitTagsInput('tag1, tag2, tag3')).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('filters out empty strings', () => {
      expect(splitTagsInput('tag1, , tag2, ')).toEqual(['tag1', 'tag2']);
    });

    it('returns empty array for empty input', () => {
      expect(splitTagsInput('')).toEqual([]);
    });

    it('handles single tag', () => {
      expect(splitTagsInput('single')).toEqual(['single']);
    });

    it('trims extra whitespace', () => {
      expect(splitTagsInput('  tag1  ,  tag2  ')).toEqual(['tag1', 'tag2']);
    });
  });

  describe('getStatusText', () => {
    it('returns "待审核" for pending status', () => {
      expect(getStatusText('pending')).toBe('待审核');
    });

    it('returns "已驳回" for rejected status', () => {
      expect(getStatusText('rejected')).toBe('已驳回');
    });

    it('returns "草稿" for draft status', () => {
      expect(getStatusText('draft')).toBe('草稿');
    });

    it('returns "已发布" for published status (default)', () => {
      expect(getStatusText('published')).toBe('已发布');
    });

    it('returns "已发布" for undefined status', () => {
      expect(getStatusText(undefined)).toBe('已发布');
    });
  });
});