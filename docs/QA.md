# QA report

## Release candidate

- Version: 0.1.0
- Date: 25 July 2026
- QuickFile contract: Swagger 2.0, v2
- Contract source: `https://api-beta.quickfile.co.uk/api-docs/v2`
- Bundled contract SHA-256:
  `5598241f3259530492e4c80ed66b5ed0900a901a07ad9a7c4174d16c9d89d22a`

## What was verified

| Area | Verification |
| --- | --- |
| API coverage | 75 unique operations across 45 paths and 121 schemas |
| MCP discovery | 80 tools, 2 resources, and 1 prompt over an in-memory MCP transport |
| Read tools | URL/path/query construction, bearer auth, structured output, rate-limit headers |
| Write tools | JSON bodies and mandatory `confirm=true` |
| Delete tools | Mandatory exact `DELETE <OperationId>` acknowledgement |
| Documents | Multipart form construction from bounded base64 input |
| Contract schemas | Required fields, primitive types, enums, ranges, arrays, nested objects, and references |
| Error handling | HTTP categorisation, secret redaction, missing-token response, oversized-response rejection |
| Prompt-injection hygiene | Invisible controls removed and secret-shaped fields redacted |
| Visual reports | P&L SVG rendering and structured chart fallback without external chart services |
| Packaging | TypeScript build and npm package dry run |
| Static quality | Strict TypeScript and ESLint |
| Dependency audit | `npm audit` reported 0 known vulnerabilities |
| Built-package smoke test | Spawned compiled stdio server; discovered 80 tools, 2 resources, and 1 prompt |
| Compatibility | CI matrix for Node.js 20, 22, and 24 |

Automated test coverage at release-candidate QA:

- Statements: 85.27%
- Branches: 75.29%
- Functions: 89.15%
- Lines: 85.42%

## Live checks possible without an account

- The Swagger UI and JSON contract were reachable over HTTPS.
- The contract identified `api-beta.quickfile.co.uk` as its host and bearer
  authentication as its security scheme.
- `GET /account/me` without credentials returned HTTP 401 with QuickFile's
  documented instruction to use the `Authorization: Bearer …` scheme. No
  accounting data was submitted or changed.

## Not verified without a QuickFile account

The maintainer did not have a QuickFile account or real bearer token. Therefore
the following remain community-validation items:

- A successful authenticated `GET /account/me`.
- Real response samples for all 75 operations.
- QuickFile-side validation nuances not fully represented in Swagger.
- Real invoice, client, supplier, bank, journal, payment, and document writes.
- Delete behaviour and whether individual deletes are soft or hard.
- Rendering of returned SVG image content in every MCP client version.
- Token scope combinations, expiry, and IP restriction behaviour.

No claim should be made that authenticated end-to-end testing has occurred.
The safest first community test is:

1. Create a read-only/scoped token.
2. Run `quickfile_connection_status` with `live=true`.
3. Exercise search/report GET tools.
4. Review schemas and payloads before testing writes in a disposable or test
   account.

## Reproduction

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run openapi:check
npm pack --dry-run
```
