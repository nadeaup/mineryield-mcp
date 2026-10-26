import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createHttpClient } from './client.js';
import type { MinerYieldConfig } from './config.js';
import { SERVER_NAME, SERVER_VERSION } from './config.js';
import { createMinerYieldServer } from './server.js';

export const handleStreamableHttpRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  config: MinerYieldConfig,
  parsedBody?: unknown
): Promise<void> => {
  const server = createMinerYieldServer(config, createHttpClient(config));
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  try {
    await transport.handleRequest(req, res, parsedBody);
  } finally {
    await transport.close();
    await server.close();
  }
};

const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return undefined;
  return JSON.parse(raw) as unknown;
};

const applyLocalCors = (res: ServerResponse): void => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID'
  );
};

export const listenHttp = async (config: MinerYieldConfig, port: number): Promise<void> => {
  const server = createServer((req, res) => {
    void (async () => {
      applyLocalCors(res);
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      let parsedBody: unknown;
      if (req.method === 'POST') {
        try {
          parsedBody = await readJsonBody(req);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }
      }
      await handleStreamableHttpRequest(req, res, config, parsedBody);
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'MCP HTTP handler failed';
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify({ error: message }));
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(port, '127.0.0.1', resolve);
  });
  console.error(`${SERVER_NAME} MCP ${SERVER_VERSION} http://127.0.0.1:${port}/ (Streamable HTTP)`);
};
