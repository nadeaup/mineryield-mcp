export const DEFAULT_API_BASE_URL = 'https://mineryield.com';
export const SERVER_NAME = 'mineryield';
export const SERVER_VERSION = '1.0.1';
export const SERVER_DESCRIPTION =
  'MinerYield tools for home miners and small businesses: ASIC profitability with solar, battery, and grid leftover-watt accounting. Estimates only; not investment, financial, or tax advice. Results vary with network difficulty, coin price, power cost, and hardware performance. Do your own research.';

export interface MinerYieldConfig {
  baseUrl: string;
  apiKey?: string;
  fetchImpl: typeof fetch;
}

const originFrom = (raw: string): string => {
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return DEFAULT_API_BASE_URL;
  }
};

export const loadConfig = (
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
): MinerYieldConfig => ({
  baseUrl: originFrom(env.MINERYIELD_API_BASE_URL || DEFAULT_API_BASE_URL),
  apiKey: env.MINERYIELD_API_KEY?.trim() || undefined,
  fetchImpl,
});
