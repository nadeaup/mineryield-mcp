import type { MinerYieldConfig } from './config.js';

export type HttpMethod = 'GET' | 'POST';

export interface ApiRequest {
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  requireApiKey: boolean;
}

export interface ApiSuccess {
  ok: true;
  status: number;
  data: unknown;
}

export interface ApiFailure {
  ok: false;
  status: number;
  error: string;
}

export type ApiResult = ApiSuccess | ApiFailure;

export interface MinerYieldClient {
  request(req: ApiRequest): Promise<ApiResult>;
}

const MISSING_KEY_ERROR =
  'MINERYIELD_API_KEY is required for this MinerYield tool. Create a Bearer API key at https://mineryield.com/api while signed in, then set the env var. Do not commit the key.';

const appendQuery = (
  url: URL,
  query: ApiRequest['query']
): void => {
  if (!query) return;
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }
};

const readBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const errorFrom = (status: number, data: unknown): string => {
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    return data.error;
  }
  if (typeof data === 'string' && data.trim()) return data;
  return `MinerYield API request failed with HTTP ${status}`;
};

export const createHttpClient = (config: MinerYieldConfig): MinerYieldClient => ({
  async request(req: ApiRequest): Promise<ApiResult> {
    if (req.requireApiKey && !config.apiKey) {
      return { ok: false, status: 401, error: MISSING_KEY_ERROR };
    }

    const url = new URL(req.path, `${config.baseUrl}/`);
    appendQuery(url, req.query);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'MinerYield-MCP/1.0',
    };
    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    const init: RequestInit = { method: req.method, headers };
    if (req.method === 'POST') {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(req.body ?? {});
    }

    try {
      const response = await config.fetchImpl(url, init);
      const data = await readBody(response);
      if (!response.ok) {
        return { ok: false, status: response.status, error: errorFrom(response.status, data) };
      }
      return { ok: true, status: response.status, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network request failed';
      return { ok: false, status: 503, error: message };
    }
  },
});
