import { apiGet, apiPost, generateApiCacheKey, invalidateApiCache } from './apiClient'
import type { User } from './auth'

export interface SetupStatus {
  initialized: boolean
  requiresSetup: boolean
}

export interface InitializeSetupInput {
  email: string
  displayName: string
  password: string
}

export interface InitializeSetupResponse {
  success: boolean
  user: User
}

export function getSetupStatus() {
  return apiGet<SetupStatus>('/api/setup/status')
}

export function initializeSetup(input: InitializeSetupInput) {
  return apiPost<InitializeSetupResponse>('/api/setup/initialize', input)
}

export function clearSetupStatusCache() {
  invalidateApiCache(generateApiCacheKey('GET', '/api/setup/status'))
}
