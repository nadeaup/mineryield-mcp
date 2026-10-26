#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createHttpClient } from './client.js';
import { loadConfig } from './config.js';
import { listenHttp } from './http.js';
import { createMinerYieldServer } from './server.js';

const parsePort = (argv: string[], env: NodeJS.ProcessEnv): number => {
  const flag = argv.findIndex((arg) => arg === '--port');
  if (flag >= 0 && argv[flag + 1]) {
    const parsed = Number(argv[flag + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const fromEnv = Number(env.PORT || 3333);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 3333;
};

const main = async (): Promise<void> => {
  const config = loadConfig();
  if (process.argv.includes('--http')) {
    await listenHttp(config, parsePort(process.argv, process.env));
    return;
  }

  const server = createMinerYieldServer(config, createHttpClient(config));
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`MinerYield MCP ${config.baseUrl} (stdio)`);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
