interface RequestOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined | null>;
}

const API_JSON_HEADERS = {
  'Content-Type': 'application/json',
};

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
    body: formData,
  });
  return parseResponse<T>(response);
}

export function apiUploadWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(xhr.responseText as T);
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          reject(new Error(data.error || `Upload failed: ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    xhr.open('POST', path);
    xhr.withCredentials = true;
    xhr.send(formData);
  });
}

export async function apiUploadWithRetry<T>(
  path: string,
  formData: FormData,
  options: {
    retries?: number;
    delay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const { retries = 3, delay = 1000, onRetry } = options;
  let lastError: Error;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await apiUpload<T>(path, formData);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));

      if (attempt <= retries) {
        onRetry?.(attempt, lastError);
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }
  }

  throw lastError!;
}
