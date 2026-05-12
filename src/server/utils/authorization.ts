// 权限校验 & 可见性查询条件构建

import type { ContentStatus, ApiUser } from '../types';
import { isAdminRole } from '../middleware/auth';

export function canViewWikiPage(page: { status: ContentStatus; lastEditorUid: string }, authUser?: ApiUser) {
  if (page.status === 'published') return true;
  if (!authUser) return false;
  if (isAdminRole(authUser.role)) return true;
  return page.lastEditorUid === authUser.uid;
}

export function canViewPost(post: { status: ContentStatus; authorUid: string }, authUser?: ApiUser) {
  if (post.status === 'published') return true;
  if (!authUser) return false;
  if (isAdminRole(authUser.role)) return true;
  return post.authorUid === authUser.uid;
}

export function canViewGallery(gallery: { published: boolean; authorUid: string }, authUser?: ApiUser) {
  if (gallery.published) return true;
  if (!authUser) return false;
  if (isAdminRole(authUser.role)) return true;
  return gallery.authorUid === authUser.uid;
}

export function canManageGallery(gallery: { authorUid: string }, authUser?: ApiUser) {
  if (!authUser) return false;
  if (isAdminRole(authUser.role)) return true;
  return gallery.authorUid === authUser.uid;
}

export function buildWikiVisibilityWhere(authUser?: ApiUser) {
  if (!authUser) {
    return { status: 'published' as ContentStatus };
  }
  if (isAdminRole(authUser.role)) {
    return {};
  }
  return {
    OR: [
      { status: 'published' as ContentStatus },
      { lastEditorUid: authUser.uid },
    ],
  };
}

export function buildPostVisibilityWhere(authUser?: ApiUser) {
  if (!authUser) {
    return { status: 'published' as ContentStatus };
  }
  if (isAdminRole(authUser.role)) {
    return {};
  }
  return {
    OR: [
      { status: 'published' as ContentStatus },
      { authorUid: authUser.uid },
    ],
  };
}

export function canManageWikiPullRequest(pr: { createdByUid: string }, authUser: ApiUser) {
  if (isAdminRole(authUser.role)) return true;
  return pr.createdByUid === authUser.uid;
}
