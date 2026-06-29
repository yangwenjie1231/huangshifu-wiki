import { describe, expect, it } from 'vitest'

import { normalizeWikiPageSlug } from '../../src/lib/wikiSlug'

describe('normalizeWikiPageSlug', () => {
  it('matches the wiki editor slug semantics', () => {
    expect(normalizeWikiPageSlug(' Test/Page\\Name ')).toBe('test-page-name')
    expect(normalizeWikiPageSlug('黄 诗扶/作品')).toBe('黄-诗扶-作品')
  })

  it('returns an empty slug for non-string input', () => {
    expect(normalizeWikiPageSlug(undefined)).toBe('')
    expect(normalizeWikiPageSlug(null)).toBe('')
  })
})
