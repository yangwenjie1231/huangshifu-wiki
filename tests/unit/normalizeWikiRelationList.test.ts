import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  normalizeWikiRelationList,
  normalizeWikiRelationListForWrite,
} from '../../src/server/utils/wiki-relations';

const validRelation = {
  type: 'related_person',
  targetSlug: 'target-page',
  label: '同事',
  bidirectional: true,
};

const validRelation2 = {
  type: 'work_relation',
  targetSlug: 'another-page',
  label: '合作作品',
  bidirectional: false,
};

describe('normalizeWikiRelationList', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns empty array for null input', () => {
    expect(normalizeWikiRelationList(null)).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns empty array for undefined input', () => {
    expect(normalizeWikiRelationList(undefined)).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns empty array for empty array input', () => {
    expect(normalizeWikiRelationList([])).toEqual([]);
  });

  it('normalizes a valid relation array (happy path)', () => {
    const result = normalizeWikiRelationList([validRelation]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(validRelation);
  });

  it('normalizes multiple valid relations', () => {
    const result = normalizeWikiRelationList([validRelation, validRelation2]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(validRelation);
    expect(result[1]).toEqual(validRelation2);
  });

  it('rescues JSON string input and returns normalized relations', () => {
    const jsonString = JSON.stringify([validRelation, validRelation2]);
    const result = normalizeWikiRelationList(jsonString);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('related_person');
    expect(result[0].targetSlug).toBe('target-page');
    expect(result[1].type).toBe('work_relation');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns empty array for invalid JSON string', () => {
    const result = normalizeWikiRelationList('not-json-at-all');
    expect(result).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns empty array for JSON string that parses to non-array', () => {
    const result = normalizeWikiRelationList('{"type":"related_person"}');
    expect(result).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns empty array for empty JSON string', () => {
    const result = normalizeWikiRelationList('');
    expect(result).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns empty array for whitespace-only string', () => {
    const result = normalizeWikiRelationList('   ');
    expect(result).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns and returns empty for numeric input', () => {
    const result = normalizeWikiRelationList(42);
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[normalizeWikiRelationList] Unexpected non-array input, data dropped:',
      'number',
    );
  });

  it('warns and returns empty for boolean input', () => {
    const result = normalizeWikiRelationList(true);
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[normalizeWikiRelationList] Unexpected non-array input, data dropped:',
      'boolean',
    );
  });

  it('warns and returns empty for plain object input', () => {
    const result = normalizeWikiRelationList({ type: 'related_person' });
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[normalizeWikiRelationList] Unexpected non-array input, data dropped:',
      'object',
    );
  });

  it('filters self-referencing relations when sourceSlug is provided', () => {
    const selfRef = { ...validRelation, targetSlug: 'my-page' };
    const result = normalizeWikiRelationList([selfRef, validRelation2], 'my-page');
    expect(result).toHaveLength(1);
    expect(result[0].targetSlug).toBe('another-page');
  });

  it('deduplicates relations by type+targetSlug+label key', () => {
    const dup = { ...validRelation };
    const result = normalizeWikiRelationList([validRelation, dup]);
    expect(result).toHaveLength(1);
  });

  it('deduplicates case-insensitively on label', () => {
    const r1 = { ...validRelation, label: 'Colleague' };
    const r2 = { ...validRelation, label: 'colleague' };
    const result = normalizeWikiRelationList([r1, r2]);
    expect(result).toHaveLength(1);
  });

  it('truncates results at 80 items', () => {
    const manyRelations = Array.from({ length: 100 }, (_, i) => ({
      type: 'related_person' as const,
      targetSlug: `target-${i}`,
      label: `label-${i}`,
      bidirectional: true,
    }));
    const result = normalizeWikiRelationList(manyRelations);
    expect(result).toHaveLength(80);
  });

  it('filters out invalid type values', () => {
    const invalid = [{ ...validRelation, type: 'invalid_type' }];
    const result = normalizeWikiRelationList(invalid);
    expect(result).toHaveLength(0);
  });

  it('filters out missing targetSlug', () => {
    const noTarget = [{ ...validRelation, targetSlug: '' }];
    const result = normalizeWikiRelationList(noTarget);
    expect(result).toHaveLength(0);
  });

  it('filters out non-object items in array', () => {
    const result = normalizeWikiRelationList([null, 42, 'string', validRelation]);
    expect(result).toHaveLength(1);
  });

  it('defaults bidirectional to true when not specified', () => {
    const noBidirectional = { type: 'related_person', targetSlug: 'target' };
    const result = normalizeWikiRelationList([noBidirectional]);
    expect(result[0].bidirectional).toBe(true);
  });

  it('trims and limits label to 60 chars', () => {
    const longLabel = { ...validRelation, label: 'a'.repeat(100) };
    const result = normalizeWikiRelationList([longLabel]);
    expect(result[0].label).toHaveLength(60);
  });
});
