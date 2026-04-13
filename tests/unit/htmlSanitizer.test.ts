import { describe, expect, it } from 'vitest';

import { isTrustedIframeDomain } from '../../src/lib/htmlSanitizer';

describe('htmlSanitizer', () => {
  describe('isTrustedIframeDomain', () => {
    it('returns true for bilibili player', () => {
      expect(isTrustedIframeDomain('player.bilibili.com')).toBe(true);
    });

    it('returns true for music.163.com', () => {
      expect(isTrustedIframeDomain('music.163.com')).toBe(true);
    });

    it('returns true for qq music', () => {
      expect(isTrustedIframeDomain('y.qq.com')).toBe(true);
    });

    it('returns true for youtube', () => {
      expect(isTrustedIframeDomain('www.youtube.com')).toBe(true);
    });

    it('returns true for youtube without www', () => {
      expect(isTrustedIframeDomain('youtube.com')).toBe(true);
    });

    it('returns true for youku player', () => {
      expect(isTrustedIframeDomain('player.youku.com')).toBe(true);
    });

    it('returns true for iqiyi open platform', () => {
      expect(isTrustedIframeDomain('open.iqiyi.com')).toBe(true);
    });

    it('returns true for weibo', () => {
      expect(isTrustedIframeDomain('weibo.com')).toBe(true);
    });

    it('returns true for vimeo', () => {
      expect(isTrustedIframeDomain('vimeo.com')).toBe(true);
    });

    it('returns true for protocol-relative URLs', () => {
      expect(isTrustedIframeDomain('//player.bilibili.com')).toBe(true);
    });

    it('returns true for URLs with full protocol', () => {
      expect(isTrustedIframeDomain('https://player.bilibili.com')).toBe(true);
    });

    it('returns true for HTTP URLs', () => {
      expect(isTrustedIframeDomain('http://player.bilibili.com')).toBe(true);
    });

    it('returns false for untrusted domains', () => {
      expect(isTrustedIframeDomain('evil.com')).toBe(false);
    });

    it('returns false for random subdomains of untrusted domains', () => {
      expect(isTrustedIframeDomain('bilibili.evil.com')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isTrustedIframeDomain(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isTrustedIframeDomain('')).toBe(false);
    });

    it('returns true for subdomains of trusted domains', () => {
      expect(isTrustedIframeDomain('player.music.163.com')).toBe(true);
    });

    it('returns false for invalid URLs', () => {
      expect(isTrustedIframeDomain('not-a-valid-url')).toBe(false);
    });
  });
});