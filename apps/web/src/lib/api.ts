import { getEnv } from './env';
import { getSupabase } from './supabase';

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;

  let res: Response;
  try {
    res = await fetch(`${getEnv().VITE_API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiClientError(0, 'NETWORK', 'The ReliefMesh API is unreachable. Check that it is running.');
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string; request_id?: string };
    } | null;
    throw new ApiClientError(
      res.status,
      payload?.error?.code ?? 'HTTP_ERROR',
      payload?.error?.message ?? `Request failed with status ${res.status}.`,
      payload?.error?.request_id,
    );
  }
  return (await res.json()) as T;
}
