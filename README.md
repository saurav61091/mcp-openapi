# mcp-openapi

> Turn any OpenAPI spec into MCP tools for Claude — instantly.

Point `mcp-openapi` at any OpenAPI 3.x spec and Claude can call every endpoint through natural language. No custom integration code. No manual tool definitions. One line of config.

## Quick start

Add to your Claude Desktop / Cursor / Cline MCP config:

```json
{
  "mcpServers": {
    "my-api": {
      "command": "npx",
      "args": ["-y", "mcp-openapi", "--spec", "https://petstore3.swagger.io/api/v3/openapi.json"]
    }
  }
}
```

That's it. Claude can now discover and call every endpoint in that API.

## Example conversation

> **You:** What pets are available, and add a new dog named Buddy

> **Claude:** Let me check what's available first.
> *[calls `list_endpoints` → sees `findPetsByStatus`, `addPet`, etc.]*
> *[calls `call_endpoint` with `findPetsByStatus`, `status=available`]*
>
> There are 3 pets currently available. Now I'll add Buddy...
> *[calls `call_endpoint` with `addPet`, body `{"name":"Buddy","status":"available"}`]*
>
> Done! Buddy has been added with ID 12345.

## Authentication

Pass credentials via environment variables:

```json
{
  "mcpServers": {
    "my-api": {
      "command": "npx",
      "args": ["-y", "mcp-openapi", "--spec", "https://api.example.com/openapi.json"],
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

## Tools

`mcp-openapi` exposes exactly two tools:

| Tool | Description |
|---|---|
| `list_endpoints` | Returns all operations grouped by tag with operationIds, methods, paths, and required parameters |
| `call_endpoint` | Executes any operation by `operationId` with path/query/body parameters |

The two-tool design means Claude always has a clear workflow: **discover → call**.

## Using a local spec file

```json
{
  "mcpServers": {
    "my-api": {
      "command": "npx",
      "args": ["-y", "mcp-openapi", "--spec", "/path/to/your/openapi.yaml"]
    }
  }
}
```

Supports both JSON and YAML specs. All `$ref` references are resolved automatically.

## Requirements

- Node.js 18+
- OpenAPI 3.x spec (JSON or YAML, local file or URL)

## Real-world examples

**Stripe API:**
```json
["--spec", "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json"]
```

**GitHub REST API:**
```json
["--spec", "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json"]
```

**Your internal API:**
```json
["--spec", "http://localhost:8080/openapi.json"]
```

## CLI usage

```bash
# From URL
npx mcp-openapi --spec https://api.example.com/openapi.json

# From file
npx mcp-openapi --spec ./openapi.yaml

# With auth
OPENAPI_BEARER_TOKEN=mytoken npx mcp-openapi --spec https://api.example.com/openapi.json

# Help
npx mcp-openapi --help
```

## How it works

1. At startup, loads the spec from the given URL or file path
2. Dereferences all `$ref` schemas using `@apidevtools/swagger-parser`
3. Registers two MCP tools with the connected client
4. `list_endpoints` generates a human+LLM-readable summary of all operations
5. `call_endpoint` resolves path params, builds the URL, attaches auth headers, and returns the response

## License

MIT
