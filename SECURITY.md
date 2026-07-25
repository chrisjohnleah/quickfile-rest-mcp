# Security

## Supported versions

Security fixes are applied to the latest release.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature rather than a
public issue.

## Credential handling

- The server reads `QUICKFILE_API_TOKEN` from its process environment.
- Tokens are never accepted as MCP tool arguments or returned in tool output.
- Requests can only target operations present in the bundled QuickFile Swagger
  specification.
- The default API origin is HTTPS and restricted to QuickFile's beta API host.
- Error messages and debug metadata are redacted before being returned.

Use the narrowest QuickFile token scopes that meet your needs. Treat accounting
write and delete tools as sensitive actions and keep MCP client approval enabled.
