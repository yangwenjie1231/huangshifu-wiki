import { describe, expect, it } from 'vitest';

import { formatDate, formatDateTime, toDateValue } from '../../src/lib/dateUtils';

describe('dateUtils', () => {
  describe('toDateValue', () => {
    it('parses valid ISO date string', () => {
      const result = toDateValue('2024-01-15T10:30:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
    });

    it('parses valid date string with time', () => {
      const result = toDateValue('2024-06-20 15:45:30');
      expect(result).toBeInstanceOf(Date);
    });

    it('returns null for null input', () => {
      expect(toDateValue(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(toDateValue(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(toDateValue('')).toBeNull();
    });

    it('returns null for invalid date string', () => {
      expect(toDateValue('invalid-date')).toBeNull();
    });

    it('returns null for random string', () => {
      expect(toDateValue('not a date')).toBeNull();
    });
  });

  describe('formatDate', () => {
    it('formats valid date with pattern', () => {
      const result = formatDate('2024-01-15T10:30:00Z', 'yyyy-MM-dd');
      expect(result).toBe('2024-01-15');
    });

    it('returns "刚刚" for null input', () => {
      expect(formatDate(null, 'yyyy-MM-dd')).toBe('刚刚');
    });

    it('returns "刚刚" for undefined input', () => {
      expect(formatDate(undefined, 'yyyy-MM-dd')).toBe('刚刚');
    });

    it('returns "刚刚" for empty string', () => {
      expect(formatDate('', 'yyyy-MM-dd')).toBe('刚刚');
    });

    it('formats with different patterns', () => {
      const result = formatDate('2024-01-15T10:30:00Z', 'MM/dd/yyyy');
      expect(result).toBe('01/15/2024');
    });
  });

  describe('formatDateTime', () => {
    it('formats valid datetime with default pattern', () => {
      const result = formatDateTime('2024-01-15T10:30:00Z');
      expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    });

    it('uses custom fallback when date is invalid', () => {
      expect(formatDateTime('invalid', '自定义')).toBe('自定义');
    });

    it('returns fallback for null input', () => {
      expect(formatDateTime(null, 'fallback')).toBe('fallback');
    });

    it('returns fallback for undefined input', () => {
      expect(formatDateTime(undefined, 'fallback')).toBe('fallback');
    });
  });
});