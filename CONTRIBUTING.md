# Contributing to mcp-openapi

Thanks for your interest in contributing! This project turns any OpenAPI spec into MCP tools for Claude, and we welcome all contributions.

## Getting started

```bash
git clone https://github.com/saurav61091/mcp-openapi.git
cd mcp-openapi
npm install
npm run build
npm test
```

## Development workflow

1. Create a feature branch: `git checkout -b my-feature`
2. Make your changes in `src/`
3. Add tests in `test/`
4. Run `npm run build && npm test && npm run lint`
5. Open a pull request

## Project structure

```
src/
  index.ts      # CLI entry point and MCP server setup
  loader.ts     # OpenAPI spec loading (URL/file, JSON/YAML)
  endpoints.ts  # Endpoint extraction and summarization
  executor.ts   # HTTP request execution with auth
test/
  *.test.ts     # Unit tests (vitest)
```

## Ideas for contributions

- Support for more auth methods (OAuth2, cookie-based)
- OpenAPI 3.1 features (webhooks, pathItems)
- Response schema validation
- Rate limiting / retry logic
- More real-world API examples in the README
- Performance optimization for very large specs

## Code style

- TypeScript strict mode
- ESLint for linting (`npm run lint`)
- Keep dependencies minimal
- Prefer clarity over cleverness

## Reporting issues

Please include:
- Your Node.js version (`node -v`)
- The OpenAPI spec URL or a minimal reproducing spec
- Expected vs actual behavior

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
