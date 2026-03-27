import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../apiClient';
import { randomId } from '../randomId';

type PathNode = string;

export const db = {
  kind: 'local-db',
};

type CollectionReference = {
  kind: 'collection';
  path: PathNode[];
};

type DocumentReference = {
  kind: 'doc';
  path: PathNode[];
  id: string;
};

type WhereConstraint = {
  kind: 'where';
  fieldPath: string;
  opStr: string;
  value: unknown;
};

type OrderByConstraint = {
  kind: 'orderBy';
  fieldPath: string;
  direction: 'asc' | 'desc';
};

type LimitConstraint = {
  kind: 'limit';
  count: number;
};

type QueryConstraint = WhereConstraint | OrderByConstraint | LimitConstraint;

type QueryReference = {
  kind: 'query';
  collection: CollectionReference;
  constraints: QueryConstraint[];
};

type FavoriteTargetType = 'wiki' | 'post' | 'music';

type FavoriteItem = {
  id: string;
  targetType: FavoriteTargetType;
  targetId: string;
  createdAt: string;
  target: any;
};

type SnapshotDocument<T = any> = {
  id: string;
  data: () => T;
};

type QuerySnapshot<T = any> = {
  docs: SnapshotDocument<T>[];
  empty: boolean;
};

type DocumentSnapshot<T = any> = {
  id: string;
  exists: () => boolean;
  data: () => T | undefined;
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isIsoDateLike = (value: string) => {
  if (!value.includes('-') || !value.includes('T')) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const makeTimestamp = (raw: string) => {
  const date = new Date(raw);
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
  };
};

const hydrateResponseDates = (value: unknown, key = ''): any => {
  if (Array.isArray(value)) {
    return value.map((item) => hydrateResponseDates(item));
  }

  if (isObject(value)) {
    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      output[childKey] = hydrateResponseDates(childValue, childKey);
    }
    return output;
  }

  if (typeof value === 'string' && (key.endsWith('At') || key === 'createdAt' || key === 'updatedAt') && isIsoDateLike(value)) {
    return makeTimestamp(value);
  }

  return value;
};

const normalizePayload = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizePayload(item));
  }

  if (isObject(value)) {
    if ('__serverTimestamp' in value) {
      return undefined;
    }

    const output: Record<string, unknown> = {};
    for (const [key, childValue] of Object.entries(value)) {
      const normalized = normalizePayload(childValue);
      if (normalized !== undefined) {
        output[key] = normalized;
      }
    }
    return output;
  }

  return value;
};

const createCollectionRef = (path: PathNode[]): CollectionReference => ({
  kind: 'collection',
  path,
});

const createDocumentRef = (path: PathNode[]): DocumentReference => ({
  kind: 'doc',
  path,
  id: path[path.length - 1],
});

const toDocId = (item: any, root?: string) => {
  if (root === 'wiki' && item?.slug) return String(item.slug);
  if (root === 'users' && item?.uid) return String(item.uid);
  if (root === 'music' && item?.docId) return String(item.docId);
  return String(item?.id ?? item?.docId ?? item?.uid ?? item?.slug ?? randomId());
};

const toSnapshotDoc = (item: any, root?: string): SnapshotDocument => {
  const id = toDocId(item, root);
  const hydrated = hydrateResponseDates(item);
  return {
    id,
    data: () => hydrated,
  };
};

const findWhereEq = (constraints: QueryConstraint[], fieldPath: string) => {
  const found = constraints.find(
    (constraint) => constraint.kind === 'where' && constraint.fieldPath === fieldPath && constraint.opStr === '==',
  ) as WhereConstraint | undefined;
  return found?.value;
};

const findOrderBy = (constraints: QueryConstraint[]) => {
  return constraints.find((constraint) => constraint.kind === 'orderBy') as OrderByConstraint | undefined;
};

const findLimit = (constraints: QueryConstraint[]) => {
  return constraints.find((constraint) => constraint.kind === 'limit') as LimitConstraint | undefined;
};

const comparableValue = (value: unknown) => {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().getTime();
  }
  if (typeof value === 'string' && isIsoDateLike(value)) {
    return new Date(value).getTime();
  }
  return value;
};

const applyConstraints = (items: any[], constraints: QueryConstraint[]) => {
  let output = [...items];

  for (const constraint of constraints) {
    if (constraint.kind === 'where' && constraint.opStr === '==') {
      output = output.filter((item) => {
        const value = (item as Record<string, unknown>)[constraint.fieldPath];
        if (typeof value === 'string' || typeof constraint.value === 'string') {
          return String(value) === String(constraint.value);
        }
        return value === constraint.value;
      });
    }
  }

  const orderConstraint = findOrderBy(constraints);
  if (orderConstraint) {
    const direction = orderConstraint.direction === 'desc' ? -1 : 1;
    output.sort((a, b) => {
      const left = comparableValue((a as Record<string, unknown>)[orderConstraint.fieldPath]);
      const right = comparableValue((b as Record<string, unknown>)[orderConstraint.fieldPath]);
      if (left === right) return 0;
      return left > right ? direction : -direction;
    });
  }

  const limitConstraint = findLimit(constraints);
  if (limitConstraint) {
    output = output.slice(0, Math.max(0, limitConstraint.count));
  }

  return output;
};

const fetchCollectionItems = async (collectionRef: CollectionReference, constraints: QueryConstraint[]) => {
  const [root, id, sub] = collectionRef.path;

  if (root === 'sections') {
    const data = await apiGet<{ sections: any[] }>('/api/sections');
    return data.sections || [];
  }

  if (root === 'posts' && !id) {
    const section = findWhereEq(constraints, 'section');
    const limitConstraint = findLimit(constraints);
    const data = await apiGet<{ posts: any[] }>('/api/posts', {
      section: typeof section === 'string' ? section : 'all',
      limit: limitConstraint?.count ?? 200,
    });
    return data.posts || [];
  }

  if (root === 'posts' && id && sub === 'comments') {
    const data = await apiGet<{ comments: any[] }>(`/api/posts/${id}`);
    return data.comments || [];
  }

  if (root === 'wiki' && !id) {
    const orderConstraint = findOrderBy(constraints);
    if (orderConstraint?.fieldPath === 'eventDate') {
      const timeline = await apiGet<{ events: any[] }>('/api/wiki/timeline');
      return timeline.events || [];
    }

    const category = findWhereEq(constraints, 'category');
    const data = await apiGet<{ pages: any[] }>('/api/wiki', {
      category: typeof category === 'string' ? category : 'all',
    });
    return data.pages || [];
  }

  if (root === 'wiki' && id && sub === 'revisions') {
    const data = await apiGet<{ revisions: any[] }>(`/api/wiki/${id}/history`);
    return data.revisions || [];
  }

  if (root === 'galleries') {
    const data = await apiGet<{ galleries: any[] }>('/api/galleries');
    return data.galleries || [];
  }

  if (root === 'music') {
    const data = await apiGet<{ songs: any[] }>('/api/music');
    return data.songs || [];
  }

  if (root === 'announcements') {
    const activeEq = findWhereEq(constraints, 'active');
    const limitConstraint = findLimit(constraints);
    if (activeEq === true && limitConstraint?.count === 1) {
      const data = await apiGet<{ announcement: any | null }>('/api/announcements/latest');
      return data.announcement ? [data.announcement] : [];
    }

    const data = await apiGet<{ announcements: any[] }>('/api/announcements');
    return data.announcements || [];
  }

  if (root === 'users') {
    if (id === 'me' && sub === 'favorites') {
      const type = findWhereEq(constraints, 'targetType');
      const data = await apiGet<{ favorites: FavoriteItem[] }>('/api/users/me/favorites', {
        type: typeof type === 'string' ? type : undefined,
      });
      return data.favorites || [];
    }

    const data = await apiGet<{ users: any[] }>('/api/users');
    return data.users || [];
  }

  if (root === 'imageMaps') {
    const md5 = findWhereEq(constraints, 'md5');
    const data = await apiGet<{ items: any[] }>('/api/image-maps', {
      md5: typeof md5 === 'string' ? md5 : undefined,
    });
    return data.items || [];
  }

  return [];
};

export function collection(
  ref: { path?: PathNode[] } | unknown,
  ...segments: string[]
): CollectionReference {
  const basePath = (ref as { path?: PathNode[] })?.path ?? [];
  return createCollectionRef([...basePath, ...segments]);
}

export function doc(
  ref: { path?: PathNode[] } | unknown,
  ...segments: string[]
): DocumentReference {
  const basePath = (ref as { path?: PathNode[] })?.path ?? [];
  return createDocumentRef([...basePath, ...segments]);
}

export function where(fieldPath: string, opStr: string, value: unknown): WhereConstraint {
  return {
    kind: 'where',
    fieldPath,
    opStr,
    value,
  };
}

export function orderBy(fieldPath: string, direction: 'asc' | 'desc' = 'asc'): OrderByConstraint {
  return {
    kind: 'orderBy',
    fieldPath,
    direction,
  };
}

export function limit(count: number): LimitConstraint {
  return {
    kind: 'limit',
    count,
  };
}

export function query(collectionRef: CollectionReference, ...constraints: QueryConstraint[]): QueryReference {
  return {
    kind: 'query',
    collection: collectionRef,
    constraints,
  };
}

export function serverTimestamp() {
  return {
    __serverTimestamp: true,
  };
}

export class Timestamp {
  private readonly date: Date;

  constructor(date: Date) {
    this.date = date;
  }

  toDate() {
    return this.date;
  }

  static now() {
    return new Timestamp(new Date());
  }

  static fromDate(date: Date) {
    return new Timestamp(date);
  }
}

export async function getDocs(target: CollectionReference | QueryReference): Promise<QuerySnapshot> {
  const collectionRef = target.kind === 'query' ? target.collection : target;
  const constraints = target.kind === 'query' ? target.constraints : [];

  const items = await fetchCollectionItems(collectionRef, constraints);
  const filtered = applyConstraints(items, constraints);
  const root = collectionRef.path[0];
  const docs = filtered.map((item) => toSnapshotDoc(item, root));

  return {
    docs,
    empty: docs.length === 0,
  };
}

export async function getDoc(documentRef: DocumentReference): Promise<DocumentSnapshot> {
  const [root, id] = documentRef.path;

  try {
    if (root === 'wiki' && id) {
      const data = await apiGet<{ page: any }>(`/api/wiki/${id}`);
      if (!data.page) {
        return {
          id,
          exists: () => false,
          data: () => undefined,
        };
      }

      const hydrated = hydrateResponseDates(data.page);
      return {
        id,
        exists: () => true,
        data: () => hydrated,
      };
    }

    if (root === 'posts' && id) {
      const data = await apiGet<{ post: any }>(`/api/posts/${id}`);
      if (!data.post) {
        return {
          id,
          exists: () => false,
          data: () => undefined,
        };
      }

      const hydrated = hydrateResponseDates(data.post);
      return {
        id,
        exists: () => true,
        data: () => hydrated,
      };
    }

    if (root === 'users' && id) {
      const data = await apiGet<{ user: any }>(`/api/users/${id}`);
      if (!data.user) {
        return {
          id,
          exists: () => false,
          data: () => undefined,
        };
      }

      const hydrated = hydrateResponseDates(data.user);
      return {
        id,
        exists: () => true,
        data: () => hydrated,
      };
    }

    if (root === 'imageMaps' && id) {
      const data = await apiGet<{ item: any }>(`/api/image-maps/${id}`);
      if (!data.item) {
        return {
          id,
          exists: () => false,
          data: () => undefined,
        };
      }

      const hydrated = hydrateResponseDates(data.item);
      return {
        id,
        exists: () => true,
        data: () => hydrated,
      };
    }

    if (root === 'sections' && id) {
      const data = await apiGet<{ item: any }>(`/api/admin/sections/${id}`);
      if (!data.item) {
        return {
          id,
          exists: () => false,
          data: () => undefined,
        };
      }

      const hydrated = hydrateResponseDates(data.item);
      return {
        id,
        exists: () => true,
        data: () => hydrated,
      };
    }

    if (root === 'announcements' && id) {
      const data = await apiGet<{ item: any }>(`/api/admin/announcements/${id}`);
      if (!data.item) {
        return {
          id,
          exists: () => false,
          data: () => undefined,
        };
      }

      const hydrated = hydrateResponseDates(data.item);
      return {
        id,
        exists: () => true,
        data: () => hydrated,
      };
    }

    if (root === 'music' && id) {
      const data = await apiGet<{ item: any }>(`/api/admin/music/${id}`);
      if (!data.item) {
        return {
          id,
          exists: () => false,
          data: () => undefined,
        };
      }

      const hydrated = hydrateResponseDates(data.item);
      return {
        id,
        exists: () => true,
        data: () => hydrated,
      };
    }

    if (root === 'galleries' && id) {
      const data = await apiGet<{ item: any }>(`/api/admin/galleries/${id}`);
      if (!data.item) {
        return {
          id,
          exists: () => false,
          data: () => undefined,
        };
      }

      const hydrated = hydrateResponseDates(data.item);
      return {
        id,
        exists: () => true,
        data: () => hydrated,
      };
    }

    if (root === 'wiki' && id && documentRef.path.length === 2) {
      const data = await apiGet<{ item: any }>(`/api/admin/wiki/${id}`);
      if (!data.item) {
        return {
          id,
          exists: () => false,
          data: () => undefined,
        };
      }

      const hydrated = hydrateResponseDates(data.item);
      return {
        id,
        exists: () => true,
        data: () => hydrated,
      };
    }

    if (root === 'posts' && id && documentRef.path.length === 2) {
      const data = await apiGet<{ item: any }>(`/api/admin/posts/${id}`);
      if (!data.item) {
        return {
          id,
          exists: () => false,
          data: () => undefined,
        };
      }

      const hydrated = hydrateResponseDates(data.item);
      return {
        id,
        exists: () => true,
        data: () => hydrated,
      };
    }
  } catch {
    return {
      id,
      exists: () => false,
      data: () => undefined,
    };
  }

  return {
    id,
    exists: () => false,
    data: () => undefined,
  };
}

export async function setDoc(documentRef: DocumentReference, payload: Record<string, unknown>) {
  const [root, id] = documentRef.path;
  const data = normalizePayload(payload) as Record<string, unknown>;

  if (root === 'wiki' && id) {
    await apiPost('/api/wiki', {
      ...data,
      slug: id,
      tags: Array.isArray(data.tags) ? data.tags : [],
    });
    return;
  }

  if (root === 'sections' && id) {
    await apiPost('/api/sections', {
      name: data.name || id,
      description: data.description || '',
      order: data.order || 0,
    });
    return;
  }

  if (root === 'imageMaps' && id) {
    await apiPost('/api/image-maps', {
      id,
      ...data,
    });
    return;
  }

  throw new Error(`setDoc is not implemented for path: ${documentRef.path.join('/')}`);
}

export async function updateDoc(documentRef: DocumentReference, payload: Record<string, unknown>) {
  const [root, id] = documentRef.path;
  const data = normalizePayload(payload) as Record<string, unknown>;

  if (root === 'wiki' && id) {
    await apiPut(`/api/wiki/${id}`, {
      ...data,
      tags: Array.isArray(data.tags) ? data.tags : undefined,
    });
    return;
  }

  if (root === 'users' && id) {
    if (Object.keys(data).length === 1 && 'role' in data) {
      await apiPatch(`/api/users/${id}/role`, {
        role: data.role,
      });
    } else {
      await apiPatch('/api/users/me', data);
    }
    return;
  }

  if (root === 'posts' && id) {
    await apiPatch(`/api/posts/${id}`, data);
    return;
  }

  if (root === 'users' && id === 'me' && documentRef.path[2] === 'favorites') {
    const targetType = data.targetType;
    const targetId = data.targetId;
    if (typeof targetType !== 'string' || typeof targetId !== 'string') {
      throw new Error('favorite requires targetType and targetId');
    }
    await apiPost('/api/favorites', {
      targetType,
      targetId,
    });
    return;
  }

  if (root === 'announcements' && id) {
    await apiPatch(`/api/announcements/${id}`, data);
    return;
  }

  throw new Error(`updateDoc is not implemented for path: ${documentRef.path.join('/')}`);
}

export async function addDoc(collectionRef: CollectionReference, payload: Record<string, unknown>) {
  const [root, id, sub] = collectionRef.path;
  const data = normalizePayload(payload) as Record<string, unknown>;

  if (root === 'posts' && !id) {
    const response = await apiPost<{ post: any }>('/api/posts', {
      ...data,
      tags: Array.isArray(data.tags) ? data.tags : [],
    });
    return createDocumentRef(['posts', response.post.id]);
  }

  if (root === 'posts' && id && sub === 'comments') {
    const response = await apiPost<{ comment: any }>(`/api/posts/${id}/comments`, {
      content: data.content,
      parentId: data.parentId || null,
    });
    return createDocumentRef(['posts', id, 'comments', response.comment.id]);
  }

  if (root === 'posts' && id && sub === 'likes') {
    const response = await apiPost<{ liked: boolean; likesCount: number }>(`/api/posts/${id}/like`);
    return createDocumentRef(['posts', id, 'likes', response.liked ? `${id}-${Date.now()}` : randomId()]);
  }

  if (root === 'users' && id === 'me' && sub === 'favorites') {
    const targetType = data.targetType;
    const targetId = data.targetId;
    if (typeof targetType !== 'string' || typeof targetId !== 'string') {
      throw new Error('favorite requires targetType and targetId');
    }
    await apiPost('/api/favorites', {
      targetType,
      targetId,
    });
    return createDocumentRef(['users', 'me', 'favorites', `${targetType}-${targetId}`]);
  }

  if (root === 'wiki' && id && sub === 'revisions') {
    const response = await apiPost<{ revision: any }>(`/api/wiki/${id}/revisions`, data);
    return createDocumentRef(['wiki', id, 'revisions', response.revision.id]);
  }

  if (root === 'galleries') {
    const response = await apiPost<{ gallery: any }>('/api/galleries', {
      ...data,
      tags: Array.isArray(data.tags) ? data.tags : [],
      images: Array.isArray(data.images) ? data.images : [],
    });
    return createDocumentRef(['galleries', response.gallery.id]);
  }

  if (root === 'announcements') {
    const response = await apiPost<{ announcement: any }>('/api/announcements', data);
    return createDocumentRef(['announcements', response.announcement.id]);
  }

  if (root === 'music') {
    const response = await apiPost<{ song: any }>('/api/music', data);
    return createDocumentRef(['music', response.song.docId]);
  }

  if (root === 'imageMaps') {
    const response = await apiPost<{ item: any }>('/api/image-maps', data);
    return createDocumentRef(['imageMaps', response.item.id]);
  }

  throw new Error(`addDoc is not implemented for path: ${collectionRef.path.join('/')}`);
}

export async function deleteDoc(documentRef: DocumentReference) {
  const [root, id] = documentRef.path;

  if (root === 'posts' && id && documentRef.path[2] === 'likes') {
    await apiDelete(`/api/posts/${id}/like`);
    return;
  }

  if (root === 'users' && id === 'me' && documentRef.path[2] === 'favorites') {
    const targetType = documentRef.path[3] as FavoriteTargetType | undefined;
    const targetId = documentRef.path[4];
    if (!targetType || !targetId) {
      throw new Error(`favorite delete path invalid: ${documentRef.path.join('/')}`);
    }
    await apiDelete(`/api/favorites/${targetType}/${targetId}`);
    return;
  }

  if (root === 'music' && id) {
    await apiDelete(`/api/music/${id}`);
    return;
  }

  if (root === 'sections' && id) {
    await apiDelete(`/api/sections/${id}`);
    return;
  }

  if (root === 'announcements' && id) {
    await apiDelete(`/api/announcements/${id}`);
    return;
  }

  if (root && id) {
    await apiDelete(`/api/admin/${root}/${id}`);
    return;
  }

  throw new Error(`deleteDoc is not implemented for path: ${documentRef.path.join('/')}`);
}

export function onSnapshot(
  target: CollectionReference | QueryReference,
  onNext: (snapshot: QuerySnapshot) => void,
  onError?: (error: Error) => void,
) {
  let active = true;

  const run = async () => {
    try {
      const snapshot = await getDocs(target);
      if (active) {
        onNext(snapshot);
      }
    } catch (error) {
      if (onError) {
        onError(error as Error);
      } else {
        console.error('onSnapshot polling error:', error);
      }
    }
  };

  run();
  const timerId = window.setInterval(run, 5000);

  return () => {
    active = false;
    window.clearInterval(timerId);
  };
}
