import { describe, expect, it } from 'vitest'

import { wikiCreateSchema, wikiUpdateSchema } from '../../src/server/schemas'

describe('wiki schemas', () => {
  const validWikiPayload = {
    title: '测试百科',
    content: '测试内容',
    slug: 'test-wiki',
    category: 'biography',
  }

  it('accepts pending status for review submissions', () => {
    expect(wikiCreateSchema.parse({ ...validWikiPayload, status: 'pending' }).status).toBe(
      'pending'
    )
    expect(wikiUpdateSchema.parse({ ...validWikiPayload, status: 'pending' }).status).toBe(
      'pending'
    )
  })

  it('rejects unknown status values', () => {
    expect(() => wikiCreateSchema.parse({ ...validWikiPayload, status: 'unknown' })).toThrow()
    expect(() => wikiUpdateSchema.parse({ ...validWikiPayload, status: 'unknown' })).toThrow()
  })
})
