import { describe, expect, it } from 'vitest'
import { getWikiRelationDisplayTitle } from '../../src/lib/wikiRelationDisplay'

describe('getWikiRelationDisplayTitle', () => {
  it('uses explicit relation label first', () => {
    expect(
      getWikiRelationDisplayTitle({
        type: 'related_person',
        targetSlug: 'li-hua-luo',
        targetTitle: '梨花落',
        label: '合作人物',
        bidirectional: false,
      })
    ).toBe('合作人物')
  })

  it('falls back to resolved target title before slug', () => {
    expect(
      getWikiRelationDisplayTitle({
        type: 'related_person',
        targetSlug: 'li-hua-luo',
        targetTitle: '梨花落',
        bidirectional: false,
      })
    ).toBe('梨花落')
  })

  it('falls back to slug when label and target title are empty', () => {
    expect(
      getWikiRelationDisplayTitle({
        type: 'related_person',
        targetSlug: 'li-hua-luo',
        targetTitle: ' ',
        label: ' ',
        bidirectional: false,
      })
    ).toBe('li-hua-luo')
  })
})
