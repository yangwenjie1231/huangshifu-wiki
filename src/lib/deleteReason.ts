export function promptRequiredDeleteReason(message = '请输入删除理由（必填）') {
  const reason = window.prompt(message, '')?.trim() || ''
  return reason || null
}
