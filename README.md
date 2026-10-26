# mineryield-mcp

MinerYield is for **home miners and small businesses** with solar and battery in the numbers. This MCP server (and the hosted endpoint at `https://mineryield.com/mcp`) exposes the **same leftover-watt solar / battery / grid model** the site calculator already uses. Tools call `https://mineryield.com/api/v1/**`. They do not reimplement profitability math.

Ask an assistant:

- "I have a 10 kW solar array and a 20 kWh battery, which miner makes the most per day?"
- "a 3 kW miner on solar by day, grid at $0.15/kWh at night"

`list_miners` answers the first (optional `solarW=10000`, `batteryCapacity=20`, sort `PROFIT/DAY`). `calculate_profitability` answers the second (`power=3000`, `elecCost=0.15`, `powerSources={solar:true, battery:false, grid:true}`).

Figures are model estimates from live market and weather inputs. They are estimates only, not investment, financial, or tax advice, **not ROI guarantees**, and not hardware telemetry. Results vary with network difficulty, coin price, power cost, and hardware performance. Do your own research.

Admin routes (`/api/v1/admin/*`) are not exposed.

**Requirements:** Node.js 22 or newer.

**Hosted endpoint:** `https://mineryield.com/mcp` (Streamable HTTP, `Authorization: Bearer <key>`). **Setup page:** [mineryield.com/ai/](https://mineryield.com/ai/).

**Registry name:** `io.github.nadeaup/mineryield-mcp`

## What's supported (existing site calculator)

No new calculation logic. These are the site calculator inputs the tools already forward:

| Input | Units | Meaning |
| --- | --- | --- |
| `solarW` | Watts (`10000` = 10 kW) | Array capacity. Solar generation is treated as free during the Peak Sun Hours window. |
| `batteryCapacity` | kWh (`20` = 20 kWh) | Storage. Excess daytime solar charges it; it covers night hours before grid. |
| `zipCode` | 5-digit US ZIP | Peak Sun Hours. Defaults to the API-key owner profile, then a server default. |
| `elecCost` | USD / kWh (`0.15` = 15 cents) | **One leftover-grid rate.** There is no separate day/night tariff: solar covers the sun window, leftover night kWh use this price when `grid` is on. |
| `powerSources` | `{ solar, battery, grid }` | Which legs to use. `solar` + `grid` + `battery:false` is "solar by day, grid at night". `grid:false` means the miner only runs while solar or battery energy lasts (`runtimeHours` &lt; 24). |

On `GET /api/v1/miners` / `list_miners`, query values override the API-key owner profile. Sending `solarW` without `solar=false` turns solar on; sending `batteryCapacity` without `battery=false` turns battery on.

`get_solar_forecast` is weather-based array production only (`zipCode` + `capacityW`). Pair it with `list_miners` or `calculate_profitability` for miner profit.

## API key

Create a Bearer API key while signed in at [mineryield.com/api](https://mineryield.com/api). Set it as `MINERYIELD_API_KEY`. Never commit it.

Optional: `MINERYIELD_API_BASE_URL` (defaults to `https://mineryield.com`).

Setup walkthrough: [Use MinerYield in your AI assistant](https://mineryield.com/ai/).

## npx (recommended)

```bash
export MINERYIELD_API_KEY="your-key"
npx -y mineryield-mcp
```

Local Streamable HTTP (for debugging a hosted-style client):

```bash
npx -y mineryield-mcp --http --port 3333
```

## npm package

```bash
npm install -g mineryield-mcp
export MINERYIELD_API_KEY="your-key"
mineryield-mcp
```

From this repository:

```bash
npm install
npm run build
export MINERYIELD_API_KEY="your-key"
npm start
```

## Claude Desktop

Add to `claude_desktop_config.json` (Claude → Settings → Developer):

```json
{
  "mcpServers": {
    "mineryield": {
      "command": "npx",
      "args": ["-y", "mineryield-mcp"],
      "env": {
        "MINERYIELD_API_KEY": "your-key"
      }
    }
  }
}
```

Or connect Claude to the hosted endpoint `https://mineryield.com/mcp` with `Authorization: Bearer your-key`.

## Cursor

This repository also ships `.cursor-plugin/plugin.json` and a root `mcp.json` (runs `npx -y mineryield-mcp`).

Published package / npx snippet for Cursor MCP settings:

```json
{
  "mcpServers": {
    "mineryield": {
      "command": "npx",
      "args": ["-y", "mineryield-mcp"],
      "env": {
        "MINERYIELD_API_KEY": "your-key"
      }
    }
  }
}
```

Hosted Streamable HTTP:

```json
{
  "mcpServers": {
    "mineryield": {
      "url": "https://mineryield.com/mcp",
      "headers": {
        "Authorization": "Bearer your-key"
      }
    }
  }
}
```

## ChatGPT and other MCP clients

Use Streamable HTTP:

- URL: `https://mineryield.com/mcp`
- Auth: `Authorization: Bearer <MINERYIELD_API_KEY>`
- Discovery: `https://mineryield.com/.well-known/mcp.json`

ChatGPT (Connectors / custom MCP), Claude remote MCP, and Grok custom connectors all accept that URL plus the Bearer header. Public tools still require the key on the hosted endpoint so per-key rate limits and quotas apply.

OpenAPI remains the HTTP contract: [mineryield.com/swagger.yaml](https://mineryield.com/swagger.yaml).

## Tools

| Tool | HTTP | Auth | Purpose |
| --- | --- | --- | --- |
| `list_miners` | `GET /api/v1/miners` | Bearer API key | Rank catalog ASICs by daily profit for a home/small-business solar+battery+grid setup. Optional `solarW`, `batteryCapacity`, `zipCode`, `elecCost`, `powerSources` override the key-owner profile. Same SKUs as the UI, including KDA/NEXA/XP/ALEO/ALPH. |
| `get_rigs` | `GET /api/v1/rigs` | Bearer API key | Saved My Rigs plus per-unit estimates (includes NiceHash daily revenue when a rate exists) |
| `calculate_profitability` | `POST /api/v1/calculator` | Bearer API key | One-machine leftover-watt model (`algorithm` catalog names include Kadena, NexaPow, XPHash; SHA-256 `preferredCoin` may be QUAI) |
| `get_market` | `GET /api/v1/market` | Bearer API key | Live spot prices (BTC, BCH, LTC, DOGE, ZEC, KAS, CKB, RXD, SC, DCR, DASH, GRIN, ALPH, XTM, ETC, XMR, ALEO, HNS, BTCB2, KDA, NEXA, XP, QUAI, ARRR, OCTA, ETHW, QKC, MWC, SCP) |
| `get_solar_forecast` | `GET /api/v1/solar-forecast` | Bearer API key | 7-day solar production estimate (`zipCode`, `capacityW`) |
| `get_difficulty_prediction` | `GET /api/v1/difficulty-prediction` | Bearer API key | 7-day difficulty trend (`coin`, default BTC; allowlist is the supported market symbol set) |
| `list_catalog_miners` | `GET /api/v1/catalog/miners` | Public | Specs-only ASIC catalog (Kadena, NexaPow, XPHash, ALEO, ALPH, SHA-256 QUAI-capable SKUs). Goldshell HS-Lite is one row with dual `modes` (Blake2B-SHA3/HNS and Blake2B SC/BTCB2). |
| `list_mrr_rates` | `GET /api/v1/mrr-rates` | Public | Cached Mining Rig Rentals algorithm rates. NexaPow maps to `nexapow`. SHA3X, zkSNARK, Blake256R14, Kadena, and XPHash have no primary book. |
| `list_nicehash_rates` | `GET /api/v1/nicehash-rates` | Public | Cached NiceHash paying rates (sat/H/day). SHA3X, zkSNARK, Blake256R14, Kadena, and XPHash have no NiceHash book. |
| `get_market_data` | `GET /api/v1/market-data` | Public | Full market payload used by the web app (includes KDA/NEXA/XP/QUAI/ARRR/OCTA/ETHW/QKC/MWC/SCP prices + nethash/difficulty; new-coin and XP fields may be omitted) |

### `calculate_profitability` body

Matches `POST /api/v1/calculator` in the [OpenAPI spec](https://mineryield.com/swagger.yaml):

| Field | Required | Notes |
| --- | --- | --- |
| `hashrate` | yes | Catalog units (TH/s for SHA-256 and Kadena, GH/s for NexaPow and XPHash, MH/s for Scrypt) |
| `power` | yes | Watts (`3000` = 3 kW) |
| `algorithm` | yes | Catalog name (`SHA-256`, `Scrypt`, `Kadena`, `NexaPow`, `XPHash`, `KHeavyHash`, …) |
| `elecCost` | yes | USD / kWh leftover-grid rate |
| `solarW` | no | Array watts |
| `zipCode` | no | 5-digit US ZIP for Peak Sun Hours |
| `hardwareCost` | no | USD, used for estimated payback days |
| `batteryCapacity` | no | kWh |
| `powerSources` | no | `{ solar, battery, grid }` booleans |
| `preferredCoin` | no | e.g. BTC/BCH/QUAI, SC/BTCB2, BTCB2/SC, ZEC/ARRR, ETC/OCTA/ETHW/QKC, DCR/SCP. Blake2B-SHA3 is HNS only; Cuckatoo31 is MWC only; Cuckatoo32 is GRIN only. Scrypt reports LTC/DOGE (merged). When omitted, the most profitable supported coin is used except Ethash4G, which defaults to ETC. |

### API-key management (not a tool)

`GET` / `POST` / `DELETE /api/v1/api-keys` require a Firebase ID token from a signed-in browser session, not the Bearer API key. Creating or revoking keys from an agent is not part of this default tool set. Use the site at `/api`.

## Example prompts

- "I have a 10 kW solar array and a 20 kWh battery, which miner makes the most per day?"
- "a 3 kW miner on solar by day, grid at $0.15/kWh at night"
- "List MinerYield catalog ASICs and show name, algorithm, hashrate, and watts."
- "Estimate daily profit for a 200 TH/s, 3500 W SHA-256 miner at $0.12/kWh with 10 kW solar in ZIP 10001. This is a model estimate, not a guarantee."
- "Estimate daily profit for a Bitmain KA3 (166 TH/s Kadena) at $0.12/kWh."
- "Calculate SHA-256 profitability for 200 TH/s with preferredCoin QUAI."
- "What are the current MinerYield spot prices for BCH, KAS, ETC, XMR, and QUAI?"
- "Get a 7-day difficulty prediction for KDA."
- "Get a 7-day solar forecast for ZIP 85001 with a 8 kW array."
- "Show my saved MinerYield rigs and their estimated daily profit."

## Tests

```bash
npm install
npm test
```

## Hosted Streamable HTTP

Production endpoint: `https://mineryield.com/mcp`

Bearer API-key auth uses the same key store as `/api/v1`. Admin routes and tools are not mounted. Per-key and per-IP rate limits apply at this surface; tool calls then consume the usual monthly API quota on the REST API.

Discovery:

- https://mineryield.com/llms.txt
- https://mineryield.com/.well-known/mcp.json (same document as `/mcp-discovery.json`)
- https://mineryield.com/ai/

## License

[MIT](LICENSE)
