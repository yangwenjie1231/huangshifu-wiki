export function normalizeWikiPageSlug(value: unknown) {
  if (typeof value !== 'string') return ''

  return value.trim().toLowerCase().replace(/[\\/]/g, '-').replace(/\s+/g, '-')
}
