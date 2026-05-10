import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as hashModule from '../../src/server/utils/hash';

describe('hash utils', () => {
  describe('calculateBufferMD5', () => {
    it('returns consistent hex hash for same buffer', () => {
      const buf = Buffer.from('hello world');
      const hash1 = hashModule.calculateBufferMD5(buf);
      const hash2 = hashModule.calculateBufferMD5(buf);
      expect(hash1).toBe(hash2);
    });

    it('returns 32-character hex string', () => {
      const hash = hashModule.calculateBufferMD5(Buffer.from('test'));
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });

    it('returns different hashes for different buffers', () => {
      const h1 = hashModule.calculateBufferMD5(Buffer.from('aaa'));
      const h2 = hashModule.calculateBufferMD5(Buffer.from('bbb'));
      expect(h1).not.toBe(h2);
    });

    it('handles empty buffer', () => {
      const hash = hashModule.calculateBufferMD5(Buffer.alloc(0));
      expect(hash).toBe('d41d8cd98f00b204e9800998ecf8427e');
    });
  });

  describe('calculateFileMD5', () => {
    let tmpFile: string;

    beforeEach(() => {
      tmpFile = path.join(os.tmpdir(), `hash-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    });

    afterEach(() => {
      try { fs.unlinkSync(tmpFile); } catch { /* noop */ }
    });

    it('calculates MD5 of an existing file', async () => {
      fs.writeFileSync(tmpFile, 'file content for hashing');
      const result = await hashModule.calculateFileMD5(tmpFile);
      expect(result).toBe(hashModule.calculateBufferMD5(Buffer.from('file content for hashing')));
    });

    it('rejects with error for non-existent file', async () => {
      await expect(hashModule.calculateFileMD5('/nonexistent/path/file.txt'))
        .rejects.toThrow();
    });
  });
});
