# Contributing

Issues and pull requests are welcome.

1. Use Node.js 20.10 or newer.
2. Run `npm ci`.
3. Make focused changes with tests.
4. Run `npm run qa`.

To refresh the bundled API contract from QuickFile's public Swagger endpoint,
run `npm run openapi:sync`. Review the generated diff carefully before
committing it.
