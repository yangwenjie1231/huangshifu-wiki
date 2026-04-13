import { describe, expect, it } from 'vitest';

import { formatTime, isLRCFormat, parseLRC } from '../../src/lib/lrcParser';

describe('lrcParser', () => {
  describe('parseLRC', () => {
    it('parses basic LRC format with timestamps', () => {
      const lrc = `[00:12.00]Hello World
[00:17.50]This is a test`;

      const result = parseLRC(lrc);

      expect(result.lines).toHaveLength(2);
      expect(result.lines[0]).toEqual({ time: 12, text: 'Hello World' });
      expect(result.lines[1]).toEqual({ time: 17.5, text: 'This is a test' });
    });

    it('parses metadata tags', () => {
      const lrc = `[ti:My Song]
[ar:Artist Name]
[al:Album Name]
[00:00.00]First line`;

      const result = parseLRC(lrc);

      expect(result.metadata.title).toBe('My Song');
      expect(result.metadata.artist).toBe('Artist Name');
      expect(result.metadata.album).toBe('Album Name');
    });

    it('handles millisecond precision', () => {
      const lrc = `[00:01:123]Line 1
[00:01:500]Line 2`;

      const result = parseLRC(lrc);

      expect(result.lines[0].time).toBe(1.123);
      expect(result.lines[1].time).toBe(1.5);
    });

    it('parses simple timestamp format [mm:ss]', () => {
      const lrc = `[03:30.00]Simple format`;

      const result = parseLRC(lrc);

      expect(result.lines[0].time).toBe(210);
    });

    it('sorts lines by time', () => {
      const lrc = `[00:30.00]Second
[00:00.00]First
[00:15.00]Middle`;

      const result = parseLRC(lrc);

      expect(result.lines[0].time).toBe(0);
      expect(result.lines[1].time).toBe(15);
      expect(result.lines[2].time).toBe(30);
    });

    it('handles empty LRC string', () => {
      const result = parseLRC('');

      expect(result.lines).toHaveLength(0);
    });

    it('ignores empty lines', () => {
      const lrc = `[00:00.00]Line 1

[00:05.00]Line 2`;

      const result = parseLRC(lrc);

      expect(result.lines).toHaveLength(2);
    });

    it('parses arranger from re tag', () => {
      const lrc = `[re:Arranger Name]
[00:00.00]Test`;

      const result = parseLRC(lrc);

      expect(result.metadata.arranger).toBe('Arranger Name');
    });
  });

  describe('formatTime', () => {
    it('formats time with leading zeros', () => {
      expect(formatTime(65)).toBe('01:05');
    });

    it('formats zero', () => {
      expect(formatTime(0)).toBe('00:00');
    });

    it('formats seconds only', () => {
      expect(formatTime(30)).toBe('00:30');
    });

    it('formats large values', () => {
      expect(formatTime(3661)).toBe('61:01');
    });
  });

  describe('isLRCFormat', () => {
    it('returns true for valid LRC format', () => {
      expect(isLRCFormat('[00:12.00]Some text')).toBe(true);
    });

    it('returns true for millisecond format', () => {
      expect(isLRCFormat('[01:30:500]Text')).toBe(true);
    });

    it('returns false for plain text', () => {
      expect(isLRCFormat('Just plain text')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isLRCFormat('')).toBe(false);
    });
  });
});