import type { NotificationItem } from '../types/entities'

interface ReviewNotificationPayload {
  approved?: boolean
  targetType?: 'wiki' | 'post'
  targetId?: string
  title?: string
  note?: string | null
}

export function getNotificationText(notif: NotificationItem) {
  switch (notif.type) {
    case 'reply':
      return '回复了你的' + (notif.payload.parentId ? '评论' : '帖子')
    case 'like':
      return '赞了你的帖子'
    case 'review_result': {
      const payload = notif.payload as ReviewNotificationPayload
      const target =
        payload.targetType === 'wiki'
          ? '百科'
          : payload.targetType === 'post'
            ? '帖子'
            : '内容'
      const title =
        typeof payload.title === 'string' && payload.title.trim()
          ? `《${payload.title}》`
          : ''
      const base =
        payload.approved === true
          ? `已通过你的${target}编辑审核`
          : `已驳回你的${target}编辑审核`

      if (payload.approved === true) {
        return `${base}${title ? `：${title}` : ''}`
      }

      const note = typeof payload.note === 'string' ? payload.note.trim() : ''
      return `${base}${title ? `：${title}` : ''}${note ? `（原因：${note}）` : ''}`
    }
    default:
      return '有新通知'
  }
}

export function getNotificationLink(notif: NotificationItem) {
  if (notif.type === 'reply' || notif.type === 'like') {
    const postId = typeof notif.payload.postId === 'string' ? notif.payload.postId : null
    return postId ? `/forum/${postId}` : null
  }

  if (notif.type === 'review_result') {
    const payload = notif.payload as ReviewNotificationPayload

    if (payload.targetType === 'wiki' && typeof payload.targetId === 'string') {
      if (payload.approved !== true) {
        return null
      }

      return `/wiki/${payload.targetId}`
    }

    if (payload.targetType === 'post' && typeof payload.targetId === 'string') {
      return `/forum/${payload.targetId}`
    }
  }

  return null
}
