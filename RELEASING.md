# Releasing mineryield-mcp

A release is two independent publishes. Do npm first; the official MCP Registry
checks that the live npm tarball's `mcpName` matches `server.json`.

## 1. npm (`mineryield-mcp`)

1. Set the same version in `package.json`, `server.json` (`version` and
   `packages[0].version`), and `package.json` `mcpName` /
   `server.json` `name` (`io.github.nadeaup/mineryield-mcp`).
2. From a trusted machine with npm publish rights:

   ```bash
   npm test
   npm publish
   ```

   `prepublishOnly` runs `npm run build`.

## 2. Official MCP Registry (`io.github.nadeaup/mineryield-mcp`)

GitHub Actions publishes `server.json` with OIDC. No `mcp-publisher login github`
device flow and no stored PAT.

- Tag a version and push it (`git tag v1.0.2 && git push origin v1.0.2`), or
- Publish a GitHub Release, or
- Run **Actions → Publish to MCP Registry → Run workflow** on `main`.

The workflow fails if `server.json` and `package.json` versions differ. If the
Registry already has that version, the job succeeds (versions are immutable).

Confirm:

```bash
curl "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.nadeaup/mineryield-mcp"
```
