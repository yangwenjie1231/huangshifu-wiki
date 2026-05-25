export function isTestRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    process.env.VITEST_WORKER_ID !== undefined
  )
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production'
}
