const BASE_URL = 'http://127.0.0.1:3002';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string): Promise<T> =>
    fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
    }).then((r) => handleResponse<T>(r)),

  post: <T>(path: string, body?: unknown): Promise<T> =>
    fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => handleResponse<T>(r)),

  patch: <T>(path: string, body?: unknown): Promise<T> =>
    fetch(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => handleResponse<T>(r)),

  put: <T>(path: string, body?: unknown): Promise<T> =>
    fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => handleResponse<T>(r)),

  delete: <T>(path: string): Promise<T> =>
    fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    }).then((r) => handleResponse<T>(r)),
};
