import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './client.js';
import { DEFAULT_API_BASE_URL, loadConfig } from './config.js';
import { createMinerYieldServer, executeTool } from './server.js';
import {
  ALGORITHM_HINT,
  BATTERY_KWH_HINT,
  COIN_HINT,
  ELEC_COST_HINT,
  POWER_SOURCES_HINT,
  PREFERRED_COIN_HINT,
  SOLAR_W_HINT,
  ZIP_HINT,
  findTool,
  TOOL_NAMES,
} from './tools.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const EXPECTED_TOOLS = [
  'list_miners',
  'get_rigs',
  'calculate_profitability',
  'get_market',
  'get_solar_forecast',
  'get_difficulty_prediction',
  'list_catalog_miners',
  'list_mrr_rates',
  'list_nicehash_rates',
  'get_market_data',
] as const;

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('tool registration', () => {
  it('documents DataHub P0/P1 catalog algorithms and coins in MCP schemas', () => {
    expect(ALGORITHM_HINT).toContain('Kadena');
    expect(ALGORITHM_HINT).toContain('NexaPow');
    expect(ALGORITHM_HINT).toContain('XPHash');
    expect(ALGORITHM_HINT).toContain('Cuckatoo31');
    expect(ALGORITHM_HINT).toContain('Cuckatoo32');
    expect(ALGORITHM_HINT).toContain('Blake2B-SHA3');
    for (const coin of ['KDA', 'NEXA', 'XP', 'QUAI', 'ARRR', 'OCTA', 'ETHW', 'QKC', 'MWC', 'SCP'] as const) {
      expect(COIN_HINT).toContain(coin);
    }
    expect(findTool('get_market')?.description).toContain('KDA');
    expect(findTool('get_market')?.description).toContain('BCH');
    expect(findTool('get_market')?.description).toContain('ETC');
    expect(findTool('get_market_data')?.description).toContain('QUAI');
    expect(findTool('list_catalog_miners')?.description).toContain('Kadena/KDA');
    expect(findTool('list_catalog_miners')?.description).toContain('hs-lite');
    expect(PREFERRED_COIN_HINT).toContain('most profitable');
    expect(PREFERRED_COIN_HINT).toContain('Ethash4G');
    expect(PREFERRED_COIN_HINT).toContain('defaults to ETC');
    expect(PREFERRED_COIN_HINT).toContain('Scrypt reports LTC/DOGE (merged)');
    expect(findTool('list_mrr_rates')?.description).toContain('nexapow');
    expect(findTool('list_mrr_rates')?.description).toContain('SHA3X');
    expect(findTool('list_nicehash_rates')?.description).toContain('XPHash');
  });

  it('documents home/solar leftover-watt inputs so assistants can answer array+battery and solar-by-day questions', () => {
    expect(SOLAR_W_HINT).toContain('10000 = 10 kW');
    expect(BATTERY_KWH_HINT).toContain('20 = 20 kWh');
    expect(ZIP_HINT).toContain('Peak Sun Hours');
    expect(ELEC_COST_HINT).toContain('no separate day/night rate');
    expect(POWER_SOURCES_HINT).toContain('solar by day, grid at night');
    expect(findTool('list_miners')?.description).toContain('solarW=10000');
    expect(findTool('list_miners')?.description).toContain('batteryCapacity=20');
    expect(findTool('calculate_profitability')?.description).toContain('3 kW miner on solar by day');
    expect(findTool('calculate_profitability')?.description).toContain('elecCost=0.15');
    expect(findTool('get_solar_forecast')?.description).toContain('10000=10 kW');
  });

  it('exposes every non-admin API capability and no admin routes', () => {
    expect(TOOL_NAMES).toEqual([...EXPECTED_TOOLS]);
    for (const name of TOOL_NAMES) {
      const tool = findTool(name);
      expect(tool?.path.startsWith('/api/v1/')).toBe(true);
      expect(tool?.path.includes('/admin')).toBe(false);
    }
  });

  it('lists the same tools over the MCP protocol', async () => {
    const fetchImpl = vi.fn();
    const config = loadConfig({ MINERYIELD_API_KEY: 'test-key' }, fetchImpl);
    const server = createMinerYieldServer(config);
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const listed = await client.listTools();
      expect(listed.tools.map((tool) => tool.name)).toEqual([...EXPECTED_TOOLS]);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('ships Cursor stdio config that runs the published package via npx', () => {
    const mcp = JSON.parse(readFileSync(join(repoRoot, 'mcp.json'), 'utf8')) as {
      mcpServers: { mineryield: { command: string; args: string[]; env: { MINERYIELD_API_KEY: string } } };
    };
    const server = mcp.mcpServers.mineryield;
    expect(server.command).toBe('npx');
    expect(server.args).toEqual(['-y', 'mineryield-mcp']);
    expect(server.env.MINERYIELD_API_KEY).toBe('${MINERYIELD_API_KEY}');
  });
});

describe('HTTP proxy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls GET /api/v1/miners with the Bearer API key', async () => {
    const payload = [{ MODEL: 'Antminer S21', ALGO: 'SHA-256', 'PROFIT/DAY': 12.5 }];
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, payload));
    const config = loadConfig(
      { MINERYIELD_API_KEY: 'test-key', MINERYIELD_API_BASE_URL: DEFAULT_API_BASE_URL },
      fetchImpl
    );
    const miners = findTool('list_miners');
    expect(miners).toBeDefined();

    const result = await executeTool(miners!, {}, createHttpClient(config));

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Antminer S21');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe('https://mineryield.com/api/v1/miners');
    expect(init.method).toBe('GET');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-key');
  });

  it('forwards list_miners solar/battery/grid query overrides used by the 10 kW + 20 kWh prompt', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, []));
    const config = loadConfig({ MINERYIELD_API_KEY: 'test-key' }, fetchImpl);
    const miners = findTool('list_miners');
    expect(miners).toBeDefined();

    await executeTool(
      miners!,
      {
        solarW: 10000,
        batteryCapacity: 20,
        zipCode: '10001',
        elecCost: 0.15,
        powerSources: { solar: true, battery: true, grid: true },
      },
      createHttpClient(config)
    );

    const [url] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe('https://mineryield.com/api/v1/miners');
    expect(url.searchParams.get('solarW')).toBe('10000');
    expect(url.searchParams.get('batteryCapacity')).toBe('20');
    expect(url.searchParams.get('zipCode')).toBe('10001');
    expect(url.searchParams.get('elecCost')).toBe('0.15');
    expect(url.searchParams.get('solar')).toBe('true');
    expect(url.searchParams.get('battery')).toBe('true');
    expect(url.searchParams.get('grid')).toBe('true');
  });

  it('posts calculator solar-by-day / grid-at-night fields for a 3 kW miner', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { dailyProfit: 1.2, runtimeHours: 24 }));
    const config = loadConfig({ MINERYIELD_API_KEY: 'test-key' }, fetchImpl);
    const calculator = findTool('calculate_profitability');
    expect(calculator).toBeDefined();

    await executeTool(
      calculator!,
      {
        hashrate: 100,
        power: 3000,
        algorithm: 'SHA-256',
        elecCost: 0.15,
        solarW: 10000,
        powerSources: { solar: true, battery: false, grid: true },
      },
      createHttpClient(config)
    );

    expect(JSON.parse(String((fetchImpl.mock.calls[0] as [URL, RequestInit])[1].body))).toEqual({
      hashrate: 100,
      power: 3000,
      algorithm: 'SHA-256',
      elecCost: 0.15,
      solarW: 10000,
      powerSources: { solar: true, battery: false, grid: true },
    });
  });

  it('posts calculator fields that match the OpenAPI body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { dailyProfit: 4.2 }));
    const config = loadConfig({ MINERYIELD_API_KEY: 'test-key' }, fetchImpl);
    const calculator = findTool('calculate_profitability');
    expect(calculator).toBeDefined();

    const result = await executeTool(
      calculator!,
      {
        hashrate: 200,
        power: 3500,
        algorithm: 'SHA-256',
        elecCost: 0.12,
        solarW: 10000,
        zipCode: '10001',
        preferredCoin: 'BTC',
      },
      createHttpClient(config)
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('4.2');
    const [url, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe('https://mineryield.com/api/v1/calculator');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      hashrate: 200,
      power: 3500,
      algorithm: 'SHA-256',
      elecCost: 0.12,
      solarW: 10000,
      zipCode: '10001',
      preferredCoin: 'BTC',
    });
  });

  it('calls a public catalog route without requiring an API key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, [{ id: 'sha-s21', name: 'Antminer S21' }]));
    const config = loadConfig({}, fetchImpl);
    const catalog = findTool('list_catalog_miners');
    expect(catalog).toBeDefined();

    const result = await executeTool(catalog!, {}, createHttpClient(config));
    expect(result.isError).toBeUndefined();
    const [url, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe('https://mineryield.com/api/v1/catalog/miners');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('posts Kadena and SHA-256 QUAI calculator bodies that match the OpenAPI contract', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { dailyProfit: 1.1, coinSymbol: 'KDA' }));
    const config = loadConfig({ MINERYIELD_API_KEY: 'test-key' }, fetchImpl);
    const calculator = findTool('calculate_profitability');
    expect(calculator).toBeDefined();

    await executeTool(
      calculator!,
      {
        hashrate: 166,
        power: 3160,
        algorithm: 'Kadena',
        elecCost: 0.12,
      },
      createHttpClient(config)
    );
    expect(JSON.parse(String((fetchImpl.mock.calls[0] as [URL, RequestInit])[1].body))).toEqual({
      hashrate: 166,
      power: 3160,
      algorithm: 'Kadena',
      elecCost: 0.12,
    });

    fetchImpl.mockResolvedValueOnce(jsonResponse(200, { dailyProfit: 2.2, coinSymbol: 'QUAI' }));
    await executeTool(
      calculator!,
      {
        hashrate: 200,
        power: 3500,
        algorithm: 'SHA-256',
        elecCost: 0.12,
        preferredCoin: 'QUAI',
      },
      createHttpClient(config)
    );
    expect(JSON.parse(String((fetchImpl.mock.calls[1] as [URL, RequestInit])[1].body))).toMatchObject({
      algorithm: 'SHA-256',
      preferredCoin: 'QUAI',
    });
  });

  it('forwards difficulty-prediction coin query for DataHub symbols', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { coin: 'KDA', currentDifficulty: 1 }));
    const config = loadConfig({ MINERYIELD_API_KEY: 'test-key' }, fetchImpl);
    const difficulty = findTool('get_difficulty_prediction');
    expect(difficulty).toBeDefined();

    await executeTool(difficulty!, { coin: 'KDA' }, createHttpClient(config));
    const [url] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe('https://mineryield.com/api/v1/difficulty-prediction?coin=KDA');
  });

  it('rejects authenticated tools when MINERYIELD_API_KEY is missing', async () => {
    const fetchImpl = vi.fn();
    const config = loadConfig({}, fetchImpl);
    const miners = findTool('list_miners');
    expect(miners).toBeDefined();

    const result = await executeTool(miners!, {}, createHttpClient(config));
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('MINERYIELD_API_KEY');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
