import { describe, expect, it } from 'vitest';

import { formatTime } from '../../src/lib/formatUtils';

describe('formatUtils', () => {
  describe('formatTime', () => {
    it('formats seconds to mm:ss format', () => {
      expect(formatTime(65)).toBe('1:05');
    });

    it('formats zero seconds', () => {
      expect(formatTime(0)).toBe('0:00');
    });

    it('formats seconds less than 10', () => {
      expect(formatTime(5)).toBe('0:05');
    });

    it('formats minutes with single digit', () => {
      expect(formatTime(90)).toBe('1:30');
    });

    it('formats minutes with multiple digits', () => {
      expect(formatTime(600)).toBe('10:00');
    });

    it('formats large values', () => {
      expect(formatTime(3661)).toBe('61:01');
    });

    it('pads seconds with leading zero', () => {
      expect(formatTime(61)).toBe('1:01');
    });
  });
});