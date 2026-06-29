const CREDIT_SEPARATORS = /[,，、/／;；|｜]+/

export function normalizeStringListInput(input: unknown): string[] {
  const values = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(CREDIT_SEPARATORS)
      : []
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const value of values) {
    if (typeof value !== 'string') continue
    const item = value.trim()
    if (!item || seen.has(item)) continue
    seen.add(item)
    normalized.push(item)
  }

  return normalized
}

export function formatMusicCredits(input: unknown, fallback = ''): string {
  const credits = normalizeStringListInput(input)
  return credits.length ? credits.join(' / ') : fallback
}

export function firstMusicCredit(input: unknown, fallback = ''): string {
  return normalizeStringListInput(input)[0] || fallback
}
