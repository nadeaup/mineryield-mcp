import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SERVER_VERSION } from './config.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const read = (relativePath: string): string => readFileSync(join(repoRoot, relativePath), 'utf8');

const readJson = (relativePath: string): Record<string, unknown> =>
  JSON.parse(read(relativePath)) as Record<string, unknown>;

const EXPECTED_NAME = 'io.github.nadeaup/mineryield-mcp';
const EXPECTED_NPM = 'mineryield-mcp';
const EXPECTED_VERSION = '1.0.1';
const SCHEMA_URL = 'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json';

const walkTsFiles = (dir: string): string[] => {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walkTsFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [full] : [];
  });
};

describe('official MCP Registry contract', () => {
  const pkg = readJson('package.json');
  const server = readJson('server.json');
  const readme = read('README.md');
  const registryDoc = read('docs/official-registry.md');

  it('keeps npm 1.0.1, mcpName, and server.json name aligned for GitHub-namespace publish', () => {
    expect(pkg.name).toBe(EXPECTED_NPM);
    expect(pkg.version).toBe(EXPECTED_VERSION);
    expect(pkg.mcpName).toBe(EXPECTED_NAME);
    expect(pkg.private).toBe(false);
    expect(server.name).toBe(EXPECTED_NAME);
    expect(server.version).toBe(EXPECTED_VERSION);
    expect(server.$schema).toBe(SCHEMA_URL);
    expect(SERVER_VERSION).toBe(EXPECTED_VERSION);
    expect(typeof server.description).toBe('string');
    expect(String(server.description).length).toBeGreaterThan(0);
    expect(String(server.description).length).toBeLessThanOrEqual(100);
    expect(String(server.description).toLowerCase()).toContain('api key');
  });

  it('declares stdio npm plus hosted Streamable HTTP that is not keyless', () => {
    const packages = server.packages as Array<Record<string, unknown>>;
    const remotes = server.remotes as Array<Record<string, unknown>>;
    expect(packages).toHaveLength(1);
    expect(remotes).toHaveLength(1);

    const npmPackage = packages[0];
    expect(npmPackage.registryType).toBe('npm');
    expect(npmPackage.identifier).toBe(EXPECTED_NPM);
    expect(npmPackage.version).toBe(EXPECTED_VERSION);
    expect(npmPackage.registryBaseUrl).toBe('https://registry.npmjs.org');
    expect(npmPackage.runtimeHint).toBe('npx');
    expect(npmPackage.transport).toEqual({ type: 'stdio' });

    const envVars = npmPackage.environmentVariables as Array<Record<string, unknown>>;
    const apiKey = envVars.find((item) => item.name === 'MINERYIELD_API_KEY');
    expect(apiKey?.isRequired).toBe(true);
    expect(apiKey?.isSecret).toBe(true);

    const remote = remotes[0];
    expect(remote.type).toBe('streamable-http');
    expect(remote.url).toBe('https://mineryield.com/mcp');
    const headers = remote.headers as Array<Record<string, unknown>>;
    const authorization = headers.find((item) => item.name === 'Authorization');
    expect(authorization?.isRequired).toBe(true);
    expect(authorization?.isSecret).toBe(true);
    expect(authorization?.value).toBe('Bearer {api_key}');
  });

  it('pins the GitHub repository id used for official namespace proof', () => {
    const repository = server.repository as Record<string, unknown>;
    expect(repository.url).toBe('https://github.com/nadeaup/mineryield-mcp');
    expect(repository.source).toBe('github');
    expect(repository.id).toBe('1434579542');
    expect(server.websiteUrl).toBe('https://mineryield.com/ai');
  });

  it('documents local stdio vs hosted auth, quotas, and existing listings', () => {
    expect(readme).toContain('npx -y mineryield-mcp');
    expect(readme).toContain('MINERYIELD_API_KEY');
    expect(readme).toContain('https://mineryield.com/mcp');
    expect(readme).toContain('Authorization: Bearer');
    expect(readme).toContain('https://mineryield.com/api');
    expect(readme).toContain('https://mineryield.com/ai');
    expect(readme).toMatch(/25/);
    expect(readme.toLowerCase()).toContain('rolling 30');
    expect(readme).toContain('60 requests/min');
    expect(readme).toContain('30 requests/min');
    expect(readme).toContain('5 active');
    expect(readme).toContain('io.github.nadeaup/mineryield-mcp');
    expect(readme).toContain('https://glama.ai/mcp/servers/nadeaup/mineryield-mcp');
    expect(readme.toLowerCase()).toContain('not keyless');
    expect(readme).toContain('does not add telemetry');
    expect(registryDoc).toContain('mcp-publisher login github');
    expect(registryDoc).toContain('mcp-publisher publish');
    expect(registryDoc).toContain('mcp-publisher validate');
  });

  it('does not instruct a PulseMCP or CEV registry submission from this repo', () => {
    expect(readme.toLowerCase()).toContain('pulsemcp');
    expect(readme.toLowerCase()).toContain('do not submit');
    expect(registryDoc).toContain('Do not touch the live official record `com.cev-os/data`');
    expect(registryDoc).toContain('PulseMCP');
    expect(registryDoc).toContain('No PulseMCP form');
  });
});

describe('stdio package has no extra telemetry', () => {
  it('only talks to the configured MinerYield API origin on tool calls', () => {
    const srcFiles = walkTsFiles(join(repoRoot, 'src'));
    const joined = srcFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(joined).not.toMatch(/googletagmanager|google-analytics|posthog|sentry\.io|mixpanel|segment\.com|telemetry\.|phone.?home/i);
    expect(joined).toContain("User-Agent': 'MinerYield-MCP/1.0'");
    expect(read('src/http.ts')).toContain("server.listen(port, '127.0.0.1'");
  });
});
