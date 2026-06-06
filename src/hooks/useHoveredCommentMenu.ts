import { useRef, useState } from 'react'

export const useHoveredCommentMenu = () => {
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null)
  const hoveredCommentIdRef = useRef<string | null>(null)

  const showCommentMenu = (commentId: string) => {
    if (hoveredCommentIdRef.current === commentId) return
    hoveredCommentIdRef.current = commentId
    setHoveredCommentId(commentId)
  }

  const hideCommentMenu = (commentId: string) => {
    if (hoveredCommentIdRef.current !== commentId) return
    hoveredCommentIdRef.current = null
    setHoveredCommentId(null)
  }

  return {
    hoveredCommentId,
    showCommentMenu,
    hideCommentMenu,
  }
}
