# Official MCP Registry publication

This repository is the npm/stdio package and the `server.json` contract for
`io.github.nadeaup/mineryield-mcp`. It is **not** the MinerYield website and it
is **not** CEV-OS Data API.

Do not touch the live official record `com.cev-os/data` (currently **1.12.0**).
Do not merge, deploy, npm-publish, or submit this server from CI. Do not log in
or extract credentials in an agent session.

## Current verified state

| Surface | Value |
| --- | --- |
| npm package | `mineryield-mcp@1.0.1` (already public) |
| `package.json` `mcpName` | `io.github.nadeaup/mineryield-mcp` (already on npm) |
| GitHub namespace | `io.github.nadeaup/*` via GitHub auth as `nadeaup` |
| Official registry | **missing** (`GET` / search return empty / 404) |
| Hosted MCP | `https://mineryield.com/mcp` — HTTP **401** without `Authorization: Bearer <key>` |
| Setup docs | https://mineryield.com/ai |
| Keys | https://mineryield.com/api (signed-in browser; max 5 active keys) |
| Glama | already listed at https://glama.ai/mcp/servers/nadeaup/mineryield-mcp |
| PulseMCP | manual submissions paused; official ingest only — **do not duplicate** |
| Site/hosted function | MinerYield PR 83; do not duplicate those changes here |

`1.0.1` is already on npm with a matching `mcpName`. **Do not bump the npm
version** for this registry submission. The official registry stores the local
`server.json`; it does not republish the tarball.

Published versions are immutable. Get `server.json` right **before** the first
`mcp-publisher publish` of `1.0.1`. Metadata-only follow-ups later would need a
new server version string (for example `1.0.1-1`) without an npm bump.

## Preflight (no login)

From the repo root, with Node 22+:

```bash
npm ci
npm test
npm run typecheck
npm run validate:registry
```

`validate:registry` POSTs `server.json` to
`https://registry.modelcontextprotocol.io/v0/validate` (no auth cookie/token),
checks that published npm `mcpName` is `io.github.nadeaup/mineryield-mcp`, and
confirms CEV `com.cev-os/data` latest remains `1.12.0`.

Equivalent official CLI (still no login):

```bash
mcp-publisher validate server.json
```

`mcp-publisher publish` has **no `--dry-run` flag**. Validation is the
`validate` subcommand. Do not run `publish` until the single approval below.

## Single publication action (human, after this PR merges)

One operator who can GitHub-auth as **`nadeaup`** (the `io.github.nadeaup/`
namespace owner) on a trusted machine:

1. Re-run the preflight commands above on the merged `main`.
2. Install current `mcp-publisher` (v1.8.8 or newer) from
   https://github.com/modelcontextprotocol/registry/releases .
3. `mcp-publisher login github` — complete the GitHub device flow in a browser.
   Tokens are stored under `~/.config/mcp-publisher/`. Never paste them into
   git, chat, CI logs, or this repo.
4. `mcp-publisher publish` — sends **only** `server.json` to
   `https://registry.modelcontextprotocol.io`. Does not npm-publish.
5. Confirm:
   `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.nadeaup/mineryield-mcp"`
   shows `name` `io.github.nadeaup/mineryield-mcp` and `version` `1.0.1`.
6. `mcp-publisher logout`.

That is the only public registry write this package needs. No PulseMCP form,
no second namespace, no CEV publish, no npm release.

GitHub OIDC / DNS / HTTP domain auth are **not** required. This name is
`io.github.nadeaup/mineryield-mcp`, so GitHub login as `nadeaup` is the
sanctioned method.

## Rollback

Registry versions cannot be edited in place.

| Intent | Command (still requires login; not done here) |
| --- | --- |
| Hide a bad version from default listings | `mcp-publisher status --status deleted --message "reason" io.github.nadeaup/mineryield-mcp 1.0.1` |
| Mark superseded | `mcp-publisher status --status deprecated --message "reason" io.github.nadeaup/mineryield-mcp 1.0.1` |
| Restore | `mcp-publisher status --status active io.github.nadeaup/mineryield-mcp 1.0.1` |

`deleted` is a listing soft-delete, not erasure. Do not reuse `1.0.1` for a
different payload.

## Out of scope

- MinerYield.com copy, hosted MCP function, quotas, billing, or key product limits
- npm `1.0.2` / any version bump
- CEV-OS Data API registry record
- PulseMCP or additional directory submissions
- Adding stdio telemetry or phoning home
