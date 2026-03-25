interface RequestOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined | null>;
}

const API_JSON_HEADERS = {
  'Content-Type': 'application/json',
};

function getAuthToken() {
  if (typeof window === 'undefined') {
    return '';
  }
  return localStorage.getItem('mp_auth_token') || '';
}

function buildAuthHeaders() {
  const token = getAuthToken();
  if (!token) {
    return {};
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data === 'object' && data && 'error' in data
        ? String((data as Record<string, unknown>).error)
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const { query, headers, ...rest } = options;
  const response = await fetch(buildUrl(path, query), {
    credentials: 'include',
    headers: {
      ...API_JSON_HEADERS,
      ...buildAuthHeaders(),
      ...(headers || {}),
    },
    ...rest,
  });

  return parseResponse<T>(response);
}

export async function apiGet<T>(path: string, query?: RequestOptions['query']) {
  return apiRequest<T>(path, { method: 'GET', query });
}

export async function apiPost<T>(path: string, body?: unknown) {
  return apiRequest<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function apiPut<T>(path: string, body?: unknown) {
  return apiRequest<T>(path, {
    method: 'PUT',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function apiPatch<T>(path: string, body?: unknown) {
  return apiRequest<T>(path, {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function apiDelete<T>(path: string) {
  return apiRequest<T>(path, { method: 'DELETE' });
}

export async function apiUpload<T>(path: string, formData: FormData) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...buildAuthHeaders(),
    },
    body: formData,
  });
  return parseResponse<T>(response);
}
