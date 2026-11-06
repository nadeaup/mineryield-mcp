#!/usr/bin/env node
/**
 * Official MCP Registry preflight. Validates the local server.json contract
 * against the live schema endpoint. Does not login, publish, bump npm, or
 * print secrets.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_URL = 'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json';
const VALIDATE_URL = 'https://registry.modelcontextprotocol.io/v0/validate';
const SEARCH_URL =
  'https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.nadeaup/mineryield-mcp';
const NPM_URL = 'https://registry.npmjs.org/mineryield-mcp/1.0.1';
const CEV_SEARCH_URL = 'https://registry.modelcontextprotocol.io/v0.1/servers?search=com.cev-os/data';

const EXPECTED_NAME = 'io.github.nadeaup/mineryield-mcp';
const EXPECTED_NPM = 'mineryield-mcp';
const EXPECTED_VERSION = '1.0.1';
const EXPECTED_REPO_ID = '1434579542';

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const readJson = (relativePath) =>
  JSON.parse(readFileSync(join(root, relativePath), 'utf8'));

const fetchJson = async (url, init) => {
  const response = await fetch(url, init);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    fail(`${url} returned non-JSON HTTP ${response.status}`);
  }
  return { status: response.status, data };
};

const packageJson = readJson('package.json');
const serverJson = readJson('server.json');
const configSource = readFileSync(join(root, 'src/config.ts'), 'utf8');
const versionMatch = configSource.match(/export const SERVER_VERSION = '([^']+)'/);

if (packageJson.name !== EXPECTED_NPM) fail(`package.json name must stay ${EXPECTED_NPM}`);
if (packageJson.version !== EXPECTED_VERSION) fail(`package.json version must stay ${EXPECTED_VERSION} (no bump)`);
if (packageJson.mcpName !== EXPECTED_NAME) fail(`package.json mcpName must be ${EXPECTED_NAME}`);
if (serverJson.name !== EXPECTED_NAME) fail(`server.json name must be ${EXPECTED_NAME}`);
if (serverJson.version !== EXPECTED_VERSION) fail(`server.json version must stay ${EXPECTED_VERSION}`);
if (serverJson.$schema !== SCHEMA_URL) fail(`server.json $schema must be ${SCHEMA_URL}`);
if (typeof serverJson.description !== 'string' || serverJson.description.length > 100) {
  fail('server.json description must be 1-100 characters');
}
if (serverJson.repository?.id !== EXPECTED_REPO_ID) {
  fail(`server.json repository.id must be GitHub repo id ${EXPECTED_REPO_ID}`);
}

const npmPackage = serverJson.packages?.[0];
if (npmPackage?.registryType !== 'npm' || npmPackage.identifier !== EXPECTED_NPM) {
  fail('server.json packages[0] must be npm identifier mineryield-mcp');
}
if (npmPackage.version !== EXPECTED_VERSION) fail('server.json package version must match 1.0.1');
if (npmPackage.registryBaseUrl !== 'https://registry.npmjs.org') {
  fail('server.json registryBaseUrl must be https://registry.npmjs.org');
}
if (npmPackage.transport?.type !== 'stdio') fail('local package transport must be stdio');

const apiKey = npmPackage.environmentVariables?.find((item) => item.name === 'MINERYIELD_API_KEY');
if (!apiKey?.isRequired || !apiKey?.isSecret) fail('MINERYIELD_API_KEY must be required and secret');

const remote = serverJson.remotes?.[0];
if (remote?.type !== 'streamable-http' || remote.url !== 'https://mineryield.com/mcp') {
  fail('hosted remote must be streamable-http https://mineryield.com/mcp');
}
const authHeader = remote.headers?.find((item) => item.name === 'Authorization');
if (!authHeader?.isRequired || !authHeader?.isSecret) {
  fail('hosted Authorization header must be required and secret (not keyless)');
}

if (!versionMatch || versionMatch[1] !== EXPECTED_VERSION) {
  fail('src/config.ts SERVER_VERSION must match 1.0.1');
}

const { status: validateStatus, data: validateResult } = await fetchJson(VALIDATE_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify(serverJson),
});
if (validateStatus !== 200 || validateResult.valid !== true) {
  fail(`official /v0/validate failed: HTTP ${validateStatus} ${JSON.stringify(validateResult)}`);
}

const { status: npmStatus, data: npmPack } = await fetchJson(NPM_URL);
if (npmStatus !== 200) fail(`npm ${EXPECTED_NPM}@${EXPECTED_VERSION} lookup failed: HTTP ${npmStatus}`);
if (npmPack.mcpName !== EXPECTED_NAME) {
  fail(`published npm mcpName is ${JSON.stringify(npmPack.mcpName)}, expected ${EXPECTED_NAME}`);
}
if (npmPack.version !== EXPECTED_VERSION) fail('published npm version mismatch');

const { status: searchStatus, data: search } = await fetchJson(SEARCH_URL);
if (searchStatus !== 200) fail(`official registry search failed: HTTP ${searchStatus}`);
const alreadyPublished = (search.servers ?? []).some(
  (entry) => entry.server?.name === EXPECTED_NAME && entry.server?.version === EXPECTED_VERSION
);

if (serverJson.name === 'com.cev-os/data') {
  fail('this package must not publish the CEV Data API namespace');
}
const { status: cevStatus, data: cevSearch } = await fetchJson(CEV_SEARCH_URL);
if (cevStatus !== 200) fail(`CEV registry lookup failed: HTTP ${cevStatus}`);
const cevLatest = (cevSearch.servers ?? []).find(
  (entry) =>
    entry.server?.name === 'com.cev-os/data' &&
    entry._meta?.['io.modelcontextprotocol.registry/official']?.isLatest
);
if (!cevLatest) fail('CEV com.cev-os/data latest record missing; refusing to confuse namespaces');
const cevLatestVersion = cevLatest.server?.version;

console.log(
  JSON.stringify(
    {
      ok: true,
      schema: SCHEMA_URL,
      name: EXPECTED_NAME,
      version: EXPECTED_VERSION,
      npm: { name: EXPECTED_NPM, version: EXPECTED_VERSION, mcpName: npmPack.mcpName },
      officialRegistry: {
        recordForThisVersion: alreadyPublished ? 'present' : 'missing',
        searchCount: search.metadata?.count ?? (search.servers ?? []).length,
      },
      cevUntouched: { name: 'com.cev-os/data', latest: cevLatestVersion, thisRepoPublishes: EXPECTED_NAME },
      nextHumanAction: alreadyPublished
        ? 'none: io.github.nadeaup/mineryield-mcp@1.0.1 is already in the official registry'
        : 'after merge: mcp-publisher login github && mcp-publisher publish (no npm bump)',
    },
    null,
    2
  )
);
