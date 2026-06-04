import type { AuthenticatedRequest } from '../types'

export const SOFT_DELETE_TABS = [
  'wiki',
  'posts',
  'galleries',
  'users',
  'music',
  'albums',
  'sections',
  'announcements',
  'image-maps',
] as const

export type SoftDeleteTab = (typeof SOFT_DELETE_TABS)[number]

export function isSoftDeleteTab(value: string): value is SoftDeleteTab {
  return SOFT_DELETE_TABS.includes(value as SoftDeleteTab)
}

export function includeDeletedFromQuery(query: AuthenticatedRequest['query']) {
  return query.includeDeleted === 'true'
}

export function deletedAtFilter(includeDeleted: boolean): { deletedAt?: null } {
  return includeDeleted ? {} : { deletedAt: null }
}

export function softDeleteData(deletedBy: string) {
  return {
    deletedAt: new Date(),
    deletedBy,
  }
}

export const restoreDeleteData = {
  deletedAt: null,
  deletedBy: null,
} as const
