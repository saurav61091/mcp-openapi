# mcp-openapi

[![npm version](https://img.shields.io/npm/v/mcp-openapi-runner.svg)](https://www.npmjs.com/package/mcp-openapi-runner)
[![CI](https://github.com/saurav61091/mcp-openapi/actions/workflows/ci.yml/badge.svg)](https://github.com/saurav61091/mcp-openapi/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple.svg)](https://modelcontextprotocol.io)

> Turn any OpenAPI spec into MCP tools for Claude — zero config, instant API access.

Point `mcp-openapi-runner` at any OpenAPI 3.x spec and Claude can call every endpoint through natural language. No custom integration code. No manual tool definitions. **One line of config.**

## Why mcp-openapi?

| Without mcp-openapi | With mcp-openapi |
|---|---|
| Write custom MCP server per API | One config line per API |
| Define tool schemas manually | Auto-generated from OpenAPI spec |
| Handle auth, params, body yourself | Built-in auth + parameter handling |
| Maintain code as API evolves | Spec changes = tools update automatically |

## Quick start

Add to your **Claude Desktop** / **Claude Code** / **Cursor** / **Cline** MCP config:

```json
{
  "mcpServers": {
    "petstore": {
      "command": "npx",
      "args": ["-y", "mcp-openapi-runner", "--spec", "https://petstore3.swagger.io/api/v3/openapi.json"]
    }
  }
}
```

That's it. Claude can now discover and call every endpoint in that API.

## Example conversation

> **You:** What pets are available? Add a new dog named Buddy.
>
> **Claude:** Let me check what's available.
> *[calls `list_endpoints` → discovers `findPetsByStatus`, `addPet`, ...]*
> *[calls `call_endpoint` → `findPetsByStatus` with `status=available`]*
>
> There are 3 pets currently available. Now I'll add Buddy...
> *[calls `call_endpoint` → `addPet` with `{"name":"Buddy","status":"available"}`]*
>
> Done! Buddy has been added with ID 12345.

## Features

- **Zero config** — just point at a spec URL or file
- **Any OpenAPI 3.x spec** — JSON or YAML, local or remote, `$ref` auto-resolved
- **Auto-generated operationIds** — works even when the spec doesn't define them
- **Built-in auth** — Bearer, API key, Basic auth via environment variables
- **Endpoint filtering** — only expose the endpoints you need with `--filter`
- **Custom headers** — pass arbitrary headers with `--header`
- **Server URL override** — point at staging/local with `--server-url`
- **Two-tool design** — simple `list_endpoints` → `call_endpoint` workflow
- **Works everywhere** — Claude Desktop, Claude Code, Cursor, Cline, any MCP client

## Ready-to-use configs

### Stripe

```json
{
  "mcpServers": {
    "stripe": {
      "command": "npx",
      "args": ["-y", "mcp-openapi-runner", "--spec", "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json"],
      "env": {
        "OPENAPI_BEARER_TOKEN": "sk_test_..."
      }
    }
  }
}
```

### GitHub REST API

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "mcp-openapi-runner",
        "--spec", "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json",
        "--filter", "repos"],
      "env": {
        "OPENAPI_BEARER_TOKEN": "ghp_..."
      }
    }
  }
}
```

### Your internal API

```json
{
  "mcpServers": {
    "internal": {
      "command": "npx",
      "args": ["-y", "mcp-openapi-runner", "--spec", "http://localhost:8080/openapi.json"],
      "env": {
        "OPENAPI_API_KEY": "dev-key-123"
      }
    }
  }
}
```

### Jira (Atlassian)

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["-y", "mcp-openapi-runner",
        "--spec", "https://dac-static.atlassian.com/cloud/jira/platform/swagger-v3.v3.json",
        "--server-url", "https://your-domain.atlassian.net",
        "--filter", "issue"],
      "env": {
        "OPENAPI_BASIC_USER": "you@company.com",
        "OPENAPI_BASIC_PASS": "your-api-token"
      }
    }
  }
}
```

## Authentication

Pass credentials via environment variables:

```json
{
  "mcpServers": {
    "my-api": {
      "command": "npx",
      "args": ["-y", "mcp-openapi-runner", "--spec", "https://api.example.com/openapi.json"],
      "env": {
        "OPENAPI_BEARER_TOKEN": "your-token-here"
      }
    }
  }
}
```

| Variable | Description |
|---|---|
| `OPENAPI_BEARER_TOKEN` | Bearer token → `Authorization: Bearer <token>` |
| `OPENAPI_API_KEY` | API key value |
| `OPENAPI_API_KEY_HEADER` | Header name for API key (default: `X-Api-Key`) |
| `OPENAPI_BASIC_USER` | HTTP Basic auth username |
| `OPENAPI_BASIC_PASS` | HTTP Basic auth password |

## CLI options

```
npx mcp-openapi-runner --spec <url-or-path> [options]

Options:
  --spec         Path or URL to an OpenAPI 3.x spec (JSON or YAML)
  --server-url   Override the base URL from the spec
  --filter       Only expose endpoints matching a pattern (path, tag, or operationId)
  --header       Add custom header to all requests ("Name: Value", repeatable)
  --help         Show help
```

### Examples

```bash
# Basic usage
npx mcp-openapi-runner --spec https://petstore3.swagger.io/api/v3/openapi.json

# Only pet-related endpoints
npx mcp-openapi-runner --spec ./openapi.yaml --filter pets

# Point at local dev server
npx mcp-openapi-runner --spec ./openapi.yaml --server-url http://localhost:3000

# Custom headers
npx mcp-openapi-runner --spec ./openapi.yaml --header "X-Tenant: acme" --header "X-Debug: true"

# With auth
OPENAPI_BEARER_TOKEN=mytoken npx mcp-openapi-runner --spec https://api.example.com/openapi.json
```

## Tools

`mcp-openapi-runner` exposes exactly two tools:

| Tool | Description |
|---|---|
| `list_endpoints` | Returns all operations grouped by tag with operationIds, methods, paths, and parameters |
| `call_endpoint` | Executes any operation by `operationId` with path/query/header/body parameters |

The two-tool design means Claude always has a clear workflow: **discover → call**.

## How it works

1. Loads the OpenAPI spec from the given URL or file path
2. Dereferences all `$ref` schemas using `@apidevtools/swagger-parser`
3. Applies endpoint filter if `--filter` is set
4. Registers two MCP tools with the connected client
5. `list_endpoints` generates a human+LLM-readable summary of all operations
6. `call_endpoint` resolves params, builds the URL, attaches auth + custom headers, returns the response

## Requirements

- Node.js 18+
- OpenAPI 3.x spec (JSON or YAML, local file or URL)

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT
