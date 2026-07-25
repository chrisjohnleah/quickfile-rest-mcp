# QuickFile community forum post

## Suggested title

Open-source MCP server for the new QuickFile REST API (beta testers wanted)

## Suggested category

Extensibility

## Body

Hi everyone,

I’ve released a free, open-source Model Context Protocol server for QuickFile’s
new REST API:

https://github.com/chrisjohnleah/quickfile-rest-mcp

It is built for the new personal bearer-token approach, not the legacy
MD5/ApplicationID API.

The first release maps all 75 operations currently published in QuickFile’s v2
Swagger document to typed MCP tools, including clients, suppliers, invoices,
purchases, banking, payments, journals, reports, documents, projects and
inventory. Read, write and delete tools carry MCP safety annotations; writes
require explicit confirmation, and deletes require an operation-specific
acknowledgement.

I also added local visual tools for profit and loss, balance sheet and aged
debt. They return structured data plus an SVG chart without sending accounting
figures to an external chart service.

The project includes strict TypeScript, protocol-level tests, CI across current
Node LTS versions, generated Swagger schemas, secret redaction and documented
QA limitations.

Important caveat: I don’t currently have a QuickFile account, so the release has
been tested with contract checks, mocked API responses, MCP client/server
integration tests and live unauthenticated endpoint checks—but not with a real
bearer token. I’ve been explicit about that in the QA report.

If anyone has REST API beta access, I’d really appreciate help validating the
read-only flow first:

1. Create a narrowly scoped personal token.
2. Add the MCP server to Claude Desktop or another MCP client.
3. Run the connection check and a few GET/report tools.
4. Report any response-shape or Swagger differences as a GitHub issue.

Please don’t post tokens or private accounting data in issues. Contributions
and feedback are very welcome.

QuickFile team: if there are any beta conventions, endpoint caveats or branding
changes you’d like reflected, I’m happy to update it.

Thanks!

Chris
