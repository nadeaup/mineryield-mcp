import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MinerYieldClient } from './client.js';
import { createHttpClient } from './client.js';
import type { MinerYieldConfig } from './config.js';
import { SERVER_DESCRIPTION, SERVER_NAME, SERVER_VERSION } from './config.js';
import { TOOL_DEFINITIONS, type ToolDefinition } from './tools.js';

export type ToolExecutionResult = {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

const toText = (value: unknown): string => JSON.stringify(value, null, 2);

export const executeTool = async (
  tool: ToolDefinition,
  args: Record<string, unknown>,
  client: MinerYieldClient
): Promise<ToolExecutionResult> => {
  const parsed = tool.inputSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: parsed.error.message }],
      isError: true,
    };
  }

  const request = tool.toRequest(parsed.data as Record<string, unknown>);
  const result = await client.request({
    ...request,
    requireApiKey: tool.auth === 'apiKey',
  });

  if (!result.ok) {
    return {
      content: [{ type: 'text', text: `HTTP ${result.status}: ${result.error}` }],
      isError: true,
    };
  }

  return { content: [{ type: 'text', text: toText(result.data) }] };
};

export const createMinerYieldServer = (
  config: MinerYieldConfig,
  client: MinerYieldClient = createHttpClient(config)
): McpServer => {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      description: SERVER_DESCRIPTION,
    },
    { instructions: SERVER_DESCRIPTION }
  );

  for (const tool of TOOL_DEFINITIONS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
          destructiveHint: false,
        },
      },
      async (args) => executeTool(tool, (args ?? {}) as Record<string, unknown>, client)
    );
  }

  return server;
};
