import { z } from 'zod';
import type { ApiRequest, HttpMethod } from './client.js';

export const ALGORITHM_HINT =
  'Catalog algorithm name as stored on MinerYield (SHA-256, Scrypt, KHeavyHash, Eaglesong, SHA512256d, Blake2B, Blake2B-Sia, Blake2B-SHA3, Blake256R14, X11, Cuckatoo31, Cuckatoo32, Equihash, RandomX, SHA3X, Ethash4G, Blake3, zkSNARK, Kadena, NexaPow, XPHash).';

export const COIN_HINT =
  'Cryptocurrency ticker. Allowed values match GET /api/v1/difficulty-prediction: BTC, BCH, LTC, DOGE, ZEC, KAS, CKB, RXD, SC, DCR, DASH, GRIN, ALPH, XTM, ETC, XMR, ALEO, HNS, BTCB2, KDA, NEXA, XP, QUAI, ARRR, OCTA, ETHW, QKC, MWC, SCP.';

export const PREFERRED_COIN_HINT =
  'Target coin when an algorithm supports more than one (BTC/BCH/QUAI, SC/BTCB2, BTCB2/SC, ZEC/ARRR, ETC/OCTA/ETHW/QKC, DCR/SCP). Blake2B-SHA3 is HNS only; Cuckatoo31 is MWC only; Cuckatoo32 is GRIN only. Scrypt reports LTC/DOGE (merged). When omitted, the most profitable supported coin is used except Ethash4G, which defaults to ETC.';

export const MARKET_SPOT_TICKERS =
  'BTC, BCH, LTC, DOGE, ZEC, KAS, CKB, RXD, SC, DCR, DASH, GRIN, ALPH, XTM, ETC, XMR, ALEO, HNS, BTCB2, KDA, NEXA, XP, QUAI, ARRR, OCTA, ETHW, QKC, MWC, SCP';

export const MRR_MISSING_BOOKS =
  'SHA3X, zkSNARK, Blake256R14, Kadena, and XPHash have no primary MRR book (null). NexaPow maps to the MRR nexapow book.';

export const NICEHASH_MISSING_BOOKS =
  'SHA3X, zkSNARK, Blake256R14, Kadena, and XPHash have no NiceHash paying book (null).';

export const SOLAR_W_HINT =
  'Home/small-business solar array capacity in Watts (10000 = 10 kW). Used with Peak Sun Hours from zipCode. Solar generation is treated as free during the sun window; leftover watts can charge the battery.';

export const BATTERY_KWH_HINT =
  'Battery storage in kWh (20 = 20 kWh). Only used when powerSources.battery is true (passing batteryCapacity without powerSources turns battery on). Excess daytime solar charges the battery; the battery covers night hours before grid.';

export const ZIP_HINT =
  '5-digit US ZIP for Peak Sun Hours. Defaults to the API-key owner profile, then a server default. Needed for a realistic solar-by-day estimate.';

export const ELEC_COST_HINT =
  'Grid electricity price in USD per kWh (0.15 = 15 cents). Applied only to leftover watts after solar and battery. There is no separate day/night rate: solar covers the sun window, grid covers the rest at this price.';

export const POWER_SOURCES_HINT =
  'Which legs of the site calculator to use. solar=true uses solarW during Peak Sun Hours; battery=true uses leftover solar stored in batteryCapacity at night; grid=true keeps the miner running 24h on leftover grid kWh. solar=true + grid=true + battery=false is "solar by day, grid at night". If grid=false the miner only runs while solar or battery energy lasts (runtimeHours < 24).';

export const powerSourcesSchema = z
  .object({
    solar: z
      .boolean()
      .describe('Use the solar array (solarW) during Peak Sun Hours. Turn on for any home-solar scenario.'),
    battery: z
      .boolean()
      .describe('Use leftover daytime solar stored in batteryCapacity to cover night hours.'),
    grid: z
      .boolean()
      .describe('Draw leftover kWh from the grid at elecCost so the miner can run 24 hours. Off = solar/battery-only runtime.'),
  })
  .describe(POWER_SOURCES_HINT);

const emptyInput = z.object({});

const sitePowerInput = z.object({
  solarW: z.number().optional().describe(SOLAR_W_HINT),
  batteryCapacity: z.number().optional().describe(BATTERY_KWH_HINT),
  zipCode: z.string().optional().describe(ZIP_HINT),
  elecCost: z.number().optional().describe(`${ELEC_COST_HINT} On list_miners this overrides the API-key owner profile.`),
  powerSources: powerSourcesSchema.optional(),
});

const solarForecastInput = z.object({
  zipCode: z
    .string()
    .optional()
    .describe('5-digit US ZIP code. Falls back to the API-key owner profile, then a server default.'),
  capacityW: z
    .number()
    .optional()
    .describe('Solar array capacity in Watts (10000 = 10 kW). Falls back to the API-key owner profile solarW.'),
});

const difficultyInput = z.object({
  coin: z.string().optional().describe(`${COIN_HINT} Defaults to BTC.`),
});

const calculatorInput = z.object({
  hashrate: z
    .number()
    .describe('Hashing power (TH/s for SHA-256, MH/s for Scrypt; same units as the catalog).'),
  power: z
    .number()
    .describe('Miner wall power in Watts (3000 = 3 kW). Used with solar/battery/grid to compute leftover watts and runtime.'),
  algorithm: z.string().describe(ALGORITHM_HINT),
  elecCost: z.number().describe(ELEC_COST_HINT),
  solarW: z.number().optional().describe(SOLAR_W_HINT),
  zipCode: z.string().optional().describe(ZIP_HINT),
  hardwareCost: z.number().optional().describe('Upfront hardware cost in USD used for estimated payback days.'),
  batteryCapacity: z.number().optional().describe(BATTERY_KWH_HINT),
  powerSources: powerSourcesSchema.optional(),
  preferredCoin: z
    .string()
    .optional()
    .describe(PREFERRED_COIN_HINT),
});

export type ToolAuth = 'apiKey' | 'public';

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  method: HttpMethod;
  path: string;
  auth: ToolAuth;
  inputSchema: z.ZodType;
  toRequest: (args: Record<string, unknown>) => Omit<ApiRequest, 'requireApiKey'>;
}

const noArgsGet = (path: string) => (): Omit<ApiRequest, 'requireApiKey'> => ({
  method: 'GET',
  path,
});

export const ESTIMATE_DISCLAIMER =
  'Figures are MinerYield model estimates from live market inputs: estimates only, not investment, financial, or tax advice, and not ROI guarantees. Results vary with network difficulty, coin price, power cost, and hardware performance. Do your own research.';

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'list_miners',
    title: 'List miners',
    description: `GET /api/v1/miners — rank catalog ASICs by daily profit for a home or small-business solar+battery+grid setup (same model as the site calculator). Optional solarW (10000=10 kW), batteryCapacity (kWh), zipCode, elecCost, and powerSources override the API-key owner profile. Example: 10 kW array + 20 kWh battery → solarW=10000, batteryCapacity=20, powerSources={solar:true, battery:true, grid:true}; sort PROFIT/DAY. Includes Kadena/KDA, NexaPow/NEXA, XPHash/XP, SHA-256 QUAI, and NiceHash daily revenue when a rate exists. ${ESTIMATE_DISCLAIMER}`,
    method: 'GET',
    path: '/api/v1/miners',
    auth: 'apiKey',
    inputSchema: sitePowerInput,
    toRequest: (args) => ({
      method: 'GET',
      path: '/api/v1/miners',
      query: sitePowerQuery(args),
    }),
  },
  {
    name: 'get_rigs',
    title: 'Get saved rigs',
    description: `GET /api/v1/rigs — the signed-in API-key owner's saved My Rigs list with per-unit yield estimates, including NiceHash daily revenue (USD/day) when a market rate exists (null otherwise). ${ESTIMATE_DISCLAIMER}`,
    method: 'GET',
    path: '/api/v1/rigs',
    auth: 'apiKey',
    inputSchema: emptyInput,
    toRequest: noArgsGet('/api/v1/rigs'),
  },
  {
    name: 'calculate_profitability',
    title: 'Calculate profitability',
    description: `POST /api/v1/calculator — one-machine home/small-business profitability with the same solar/battery/grid leftover-watt model as the site. Required: hashrate, power, algorithm, elecCost. Optional: solarW, batteryCapacity, zipCode, powerSources. Example: 3 kW miner on solar by day, grid at $0.15/kWh at night → power=3000, elecCost=0.15, solarW=<array watts>, powerSources={solar:true, battery:false, grid:true} (add batteryCapacity and battery:true to store leftover sun). Returns dailyProfit, dailyCost, solarSavings, runtimeHours, effectiveElecCost. ${ESTIMATE_DISCLAIMER}`,
    method: 'POST',
    path: '/api/v1/calculator',
    auth: 'apiKey',
    inputSchema: calculatorInput,
    toRequest: (args) => ({
      method: 'POST',
      path: '/api/v1/calculator',
      body: compact(args),
    }),
  },
  {
    name: 'get_market',
    title: 'Get market spot prices',
    description:
      `GET /api/v1/market — live spot prices for ${MARKET_SPOT_TICKERS}. Prices can move; not a trading feed.`,
    method: 'GET',
    path: '/api/v1/market',
    auth: 'apiKey',
    inputSchema: emptyInput,
    toRequest: noArgsGet('/api/v1/market'),
  },
  {
    name: 'get_solar_forecast',
    title: 'Get solar forecast',
    description:
      'GET /api/v1/solar-forecast — 7-day estimated kWh from a home/small-business solar array (US ZIP + capacityW, 10000=10 kW). Weather-based production only; pair with calculate_profitability or list_miners for miner profit.',
    method: 'GET',
    path: '/api/v1/solar-forecast',
    auth: 'apiKey',
    inputSchema: solarForecastInput,
    toRequest: (args) => ({
      method: 'GET',
      path: '/api/v1/solar-forecast',
      query: {
        zipCode: asOptionalString(args.zipCode),
        capacityW: asOptionalNumber(args.capacityW),
      },
    }),
  },
  {
    name: 'get_difficulty_prediction',
    title: 'Get difficulty prediction',
    description:
      'GET /api/v1/difficulty-prediction — 7-day network difficulty trend for a coin (default BTC). Model estimate, not a guarantee.',
    method: 'GET',
    path: '/api/v1/difficulty-prediction',
    auth: 'apiKey',
    inputSchema: difficultyInput,
    toRequest: (args) => ({
      method: 'GET',
      path: '/api/v1/difficulty-prediction',
      query: { coin: asOptionalString(args.coin) },
    }),
  },
  {
    name: 'list_catalog_miners',
    title: 'List catalog miners',
    description:
      'GET /api/v1/catalog/miners — public ASIC catalog (specs only, no user profitability). Includes Kadena/KDA, NexaPow/NEXA, XPHash/XP, zkSNARK/ALEO, Blake3/ALPH, and SHA-256 QUAI-capable SKUs under 5000 W. Goldshell HS-Lite is one row (`hs-lite`) with dual modes (Blake2B-SHA3/HNS and Blake2B SC/BTCB2). No API key required.',
    method: 'GET',
    path: '/api/v1/catalog/miners',
    auth: 'public',
    inputSchema: emptyInput,
    toRequest: noArgsGet('/api/v1/catalog/miners'),
  },
  {
    name: 'list_mrr_rates',
    title: 'List Mining Rig Rentals rates',
    description:
      `GET /api/v1/mrr-rates — public cached Mining Rig Rentals algorithm rates. ${MRR_MISSING_BOOKS} No API key required. Market snapshot, not a rental booking.`,
    method: 'GET',
    path: '/api/v1/mrr-rates',
    auth: 'public',
    inputSchema: emptyInput,
    toRequest: noArgsGet('/api/v1/mrr-rates'),
  },
  {
    name: 'list_nicehash_rates',
    title: 'List NiceHash paying rates',
    description:
      `GET /api/v1/nicehash-rates — public cached NiceHash algorithm paying rates (sat per H/s or Sol/s per day). ${NICEHASH_MISSING_BOOKS} No API key required. Market snapshot used for My Rigs NiceHash revenue ($/day), not a rental booking.`,
    method: 'GET',
    path: '/api/v1/nicehash-rates',
    auth: 'public',
    inputSchema: emptyInput,
    toRequest: noArgsGet('/api/v1/nicehash-rates'),
  },
  {
    name: 'get_market_data',
    title: 'Get full market data',
    description:
      'GET /api/v1/market-data — public full market payload (prices plus network hashrate/difficulty used by the web app), including KDA, NEXA, XP, QUAI, ARRR, OCTA, ETHW, QKC, MWC, and SCP. New-coin and XP hashRate/blockReward may be null/omitted. No API key required. Broader than get_market.',
    method: 'GET',
    path: '/api/v1/market-data',
    auth: 'public',
    inputSchema: emptyInput,
    toRequest: noArgsGet('/api/v1/market-data'),
  },
];

export const TOOL_NAMES = TOOL_DEFINITIONS.map((tool) => tool.name);

export const findTool = (name: string): ToolDefinition | undefined =>
  TOOL_DEFINITIONS.find((tool) => tool.name === name);

const sitePowerQuery = (args: Record<string, unknown>): Record<string, string | number | boolean | undefined> => {
  const powerSources =
    args.powerSources && typeof args.powerSources === 'object'
      ? (args.powerSources as { solar?: boolean; battery?: boolean; grid?: boolean })
      : undefined;
  return {
    solarW: asOptionalNumber(args.solarW),
    batteryCapacity: asOptionalNumber(args.batteryCapacity),
    zipCode: asOptionalString(args.zipCode),
    elecCost: asOptionalNumber(args.elecCost),
    solar: powerSources?.solar,
    battery: powerSources?.battery,
    grid: powerSources?.grid,
  };
};

const compact = (args: Record<string, unknown>): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined) body[key] = value;
  }
  return body;
};

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const asOptionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
