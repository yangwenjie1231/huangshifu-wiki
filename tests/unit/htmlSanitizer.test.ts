import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { isTrustedIframeDomain } from '../../src/lib/htmlSanitizer';
import WikiMarkdown from '../../src/pages/wiki/WikiMarkdown';

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

  describe('WikiMarkdown', () => {
    const renderWikiMarkdown = (content: string) =>
      renderToStaticMarkup(createElement(WikiMarkdown, { content }));

    it('sanitizes dangerous raw html while keeping trusted embeds', () => {
      const output = renderWikiMarkdown(`
# Safe rendering

<script>alert(1)</script>
<img src="x" onerror="alert(1)">
<a href="javascript:alert(1)" target="_self" rel="opener">bad</a>
<iframe src="https://player.bilibili.com/video/BV1" width="640" height="360" style="border-radius: 12px;" allowfullscreen></iframe>
<iframe src="https://evil.com/embed"></iframe>
`);

      expect(output).not.toContain('<script');
      expect(output).not.toContain('onerror=');
      expect(output).not.toContain('javascript:');
      expect(output).toContain('https://player.bilibili.com/video/BV1');
      expect(output).toContain('border-radius');
      expect(output).not.toContain('https://evil.com/embed');
    });

    it('forces safe attributes on external links', () => {
      const output = renderWikiMarkdown(
        '<a href="https://example.com" target="_self" rel="opener">example</a>',
      );

      expect(output).toContain('href="https://example.com"');
      expect(output).toContain('target="_blank"');
      expect(output).toContain('rel="noopener noreferrer"');
      expect(output).not.toContain('target="_self"');
      expect(output).not.toContain('rel="opener"');
    });
  });
});
