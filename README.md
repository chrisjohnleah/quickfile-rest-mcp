# QuickFile REST MCP

[![CI](https://github.com/chrisjohnleah/quickfile-rest-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/chrisjohnleah/quickfile-rest-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An open-source Model Context Protocol server for QuickFile's **modern REST
API**. It uses a personal bearer token—no legacy MD5 signatures, account
number, submission number, or ApplicationID.

The server maps every operation in QuickFile's current public Swagger v2
contract to a typed MCP tool. It supports reads, creates, updates, deletes,
multipart document uploads, report data, and locally rendered accounting
charts.

> [!IMPORTANT]
> QuickFile's REST API is currently in beta and may not be enabled for every
> account. Ask QuickFile for access if the API section is unavailable. This is
> an independent community project and is not affiliated with or endorsed by
> QuickFile Ltd.

## Why this server

- **Complete API mapping:** 75 REST operations become 75 descriptive MCP tools.
- **Typed from QuickFile's contract:** path, query, request-body, enum, range,
  and required-field validation are generated from Swagger.
- **Safe action boundaries:** MCP read-only, idempotent, open-world, and
  destructive annotations; all writes require `confirm=true`; deletes also
  require an operation-specific acknowledgement.
- **Private visualisations:** P&L, balance sheet, and aged-debt SVG charts are
  rendered locally. Accounting data is not sent to Google Charts, QuickChart,
  or another chart service.
- **Token-safe client:** the bearer token is environment-only, requests are
  restricted to the bundled QuickFile operation catalogue, origins are locked
  to QuickFile by default, and errors are redacted.
- **MCP-native extras:** API/setup resources, a searchable API catalogue, live
  connection checking, structured results, and a cautious month-end prompt.

## Quick start

### 1. Create a QuickFile personal bearer token

In QuickFile, open:

**Account Settings → Third Party Integration → API**

Create a personal token and grant only the endpoint groups you need. You can
also set an expiry date and IP restrictions. If this page is not available,
contact QuickFile because the REST API is still in beta.

### 2. Add it to Claude Desktop

Open Claude Desktop's configuration:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add:

```json
{
  "mcpServers": {
    "quickfile": {
      "command": "npx",
      "args": [
        "-y",
        "--package=github:chrisjohnleah/quickfile-rest-mcp",
        "quickfile-rest-mcp"
      ],
      "env": {
        "QUICKFILE_API_TOKEN": "YOUR_PERSONAL_BEARER_TOKEN"
      }
    }
  }
}
```

Restart Claude Desktop, then ask:

> Check my QuickFile connection, show this month's profit and loss as a chart,
> and list overdue debtor balances. Do not make any changes.

### Local installation

```bash
git clone https://github.com/chrisjohnleah/quickfile-rest-mcp.git
cd quickfile-rest-mcp
npm ci
npm run build
```

Use `node /absolute/path/to/quickfile-rest-mcp/dist/index.js` as the MCP
command and set `QUICKFILE_API_TOKEN` in the client's environment.

## What is mapped

| QuickFile group | Tools |
| --- | ---: |
| Account | 1 |
| Bank | 6 |
| Client | 12 |
| Client payments | 4 |
| Documents | 3 |
| Inventory | 4 |
| Invoices | 7 |
| Journals | 4 |
| Ledgers | 2 |
| Projects | 3 |
| Purchases | 5 |
| Purchase orders | 4 |
| Reports | 7 |
| Suppliers | 9 |
| Supplier payments | 4 |
| **Total REST operations** | **75** |

That comprises 36 GET, 20 POST, 7 PUT, and 12 DELETE operations. Tool names
follow the predictable format `quickfile_<operation_id>`, for example:

- `quickfile_invoice_search`
- `quickfile_invoice_post`
- `quickfile_client_update`
- `quickfile_bank_create_transaction`
- `quickfile_reports_profit_and_loss`
- `quickfile_document_upload_receipt`
- `quickfile_supplier_delete`

Use `quickfile_api_catalog` to search the full live tool catalogue from an MCP
client. The following extra tools are included:

- `quickfile_connection_status`
- `quickfile_api_catalog`
- `quickfile_visual_profit_and_loss`
- `quickfile_visual_balance_sheet`
- `quickfile_visual_ageing`

## Safety model

Accounting changes can have real financial consequences. This server provides
several layers of defence:

1. Every non-GET tool is marked as a write action in MCP metadata.
2. Every write requires a literal `confirm: true`.
3. Every DELETE also requires `confirmation: "DELETE <OperationId>"`.
4. The API token is never a tool argument and is never included in results.
5. Requests cannot specify arbitrary URLs or headers.
6. QuickFile response text is stripped of invisible control characters and
   secret-shaped response fields are redacted.
7. Response sizes, upload sizes, and request timeouts are bounded.

Keep your MCP client's approval UI enabled. The confirmation fields are a
backstop, not a substitute for reviewing what an agent proposes to change.

## Visual reports

The three visual tools call QuickFile's own report endpoints, preserve the raw
structured report, derive chart-ready data, and return a local SVG image.
Clients without SVG rendering can still use the structured data to create their
own table or chart.

No accounting figures leave the machine except for the request to QuickFile's
API.

## Configuration

| Environment variable | Required | Default | Description |
| --- | --- | --- | --- |
| `QUICKFILE_API_TOKEN` | For API calls | — | Personal bearer token |
| `QUICKFILE_BASE_URL` | No | `https://api-beta.quickfile.co.uk` | QuickFile API origin |
| `QUICKFILE_TIMEOUT_MS` | No | `30000` | Request timeout, 1–120 seconds |
| `QUICKFILE_MAX_RESPONSE_BYTES` | No | `2000000` | Response limit, 10 KB–10 MB |

The server can start without a token so its catalogue, setup resource, and
configuration status remain available. API tools return a clear
`NOT_CONFIGURED` result until a token is supplied.

## API contract updates

The generated tool catalogue is pinned to QuickFile's public contract at:

`https://api-beta.quickfile.co.uk/api-docs/v2`

To review an upstream beta API change:

```bash
npm run openapi:sync
npm run qa
git diff -- src/generated/quickfile-openapi.ts
```

The generator validates the Swagger version, QuickFile host, minimum path
count, operation count, and schema count before replacing the bundled contract.

## Development and QA

```bash
npm ci
npm run qa
npm run test:coverage
npm pack --dry-run
```

Tests use mocked QuickFile responses and the MCP SDK's in-memory transport, so
they do not need an account or token. See [docs/QA.md](docs/QA.md) for the exact
coverage and the limits of account-free testing.

## API and authentication references

- [QuickFile REST API overview](https://community.quickfile.co.uk/t/rest-api-overview/64912)
- [QuickFile REST Swagger UI](https://api-beta.quickfile.co.uk/api-docs/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and
[SECURITY.md](SECURITY.md). This project is free software under the
[MIT License](LICENSE).
