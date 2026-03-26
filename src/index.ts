#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadSpec } from "./loader.js";
import { getAllEndpoints, getEndpointSummaries, findEndpoint } from "./endpoints.js";
import { executeCall } from "./executor.js";
import type { OpenAPIV3 } from "openapi-types";

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
}

function getAllArgs(name: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && i + 1 < args.length) {
      values.push(args[++i]);
    }
  }
  return values;
}

if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(`mcp-openapi — Turn any OpenAPI spec into MCP tools for Claude

Usage:
  npx mcp-openapi-runner --spec <url-or-path>

Options:
  --spec         Path or URL to an OpenAPI 3.x spec (JSON or YAML)
  --server-url   Override the base URL from the spec
  --filter       Only expose endpoints matching this pattern (substring match on path, tag, or operationId)
  --header       Add a custom header to all requests (format: "Name: Value", can repeat)
  --help         Show this help

Auth (via environment variables):
  OPENAPI_BEARER_TOKEN     Bearer token for Authorization header
  OPENAPI_API_KEY          API key value
  OPENAPI_API_KEY_HEADER   Header name for API key (default: X-Api-Key)
  OPENAPI_BASIC_USER       HTTP Basic auth username
  OPENAPI_BASIC_PASS       HTTP Basic auth password

Examples:
  npx mcp-openapi-runner --spec https://petstore3.swagger.io/api/v3/openapi.json
  npx mcp-openapi-runner --spec ./openapi.yaml
  npx mcp-openapi-runner --spec https://api.example.com/openapi.json --filter pets
  npx mcp-openapi-runner --spec https://api.example.com/openapi.json --header "X-Custom: value"
  OPENAPI_BEARER_TOKEN=mytoken npx mcp-openapi-runner --spec https://api.example.com/openapi.json
`);
  process.exit(0);
}

const specArg = getArg("--spec") ?? process.env.OPENAPI_SPEC_URL;
const serverUrlOverride = getArg("--server-url") ?? process.env.OPENAPI_SERVER_URL;
const filterPattern = getArg("--filter") ?? process.env.OPENAPI_FILTER;
const customHeaders = getAllArgs("--header");

if (!specArg) {
  process.stderr.write("Error: --spec <url-or-path> is required\n");
  process.stderr.write("Run with --help for usage information\n");
  process.exit(1);
}

process.stderr.write(`Loading spec: ${specArg}\n`);
const spec = await loadSpec(specArg);

// Override server URL if provided
if (serverUrlOverride) {
  spec.servers = [{ url: serverUrlOverride }];
}

// Parse custom headers
const extraHeaders: Record<string, string> = {};
for (const h of customHeaders) {
  const colonIdx = h.indexOf(":");
  if (colonIdx > 0) {
    extraHeaders[h.slice(0, colonIdx).trim()] = h.slice(colonIdx + 1).trim();
  }
}

// Apply endpoint filter
if (filterPattern) {
  const pattern = filterPattern.toLowerCase();
  const paths = spec.paths ?? {};
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;
    const methods = ["get", "post", "put", "patch", "delete", "head", "options"] as const;
    let hasMatch = false;
    for (const method of methods) {
      const op = (pathItem as Record<string, unknown>)[method] as OpenAPIV3.OperationObject | undefined;
      if (!op) continue;
      const searchable = [
        path,
        op.operationId ?? "",
        ...(op.tags ?? []),
        op.summary ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (searchable.includes(pattern)) {
        hasMatch = true;
      }
    }
    if (!hasMatch) {
      delete paths[path];
    }
  }
}

const apiTitle = spec.info?.title ?? "API";
const endpointCount = getAllEndpoints(spec).length;
process.stderr.write(`Loaded: ${apiTitle} (${endpointCount} endpoints)\n`);
if (filterPattern) {
  process.stderr.write(`Filter: "${filterPattern}" applied\n`);
}
if (serverUrlOverride) {
  process.stderr.write(`Server URL override: ${serverUrlOverride}\n`);
}
if (customHeaders.length > 0) {
  process.stderr.write(`Custom headers: ${customHeaders.length} configured\n`);
}

const server = new McpServer({
  name: "mcp-openapi",
  version: "1.1.0",
});

server.tool(
  "list_endpoints",
  `List all available endpoints in the ${apiTitle}. ` +
    "Call this first to discover what operations are available and get their operationIds.",
  {},
  async () => ({
    content: [{ type: "text" as const, text: getEndpointSummaries(spec) }],
  })
);

server.tool(
  "call_endpoint",
  `Call an endpoint in the ${apiTitle}. ` +
    "Use list_endpoints first to discover available operationIds and their required parameters.",
  {
    operationId: z
      .string()
      .describe("The operationId from list_endpoints, e.g. 'getPetById' or 'createUser'"),
    parameters: z
      .record(z.union([z.string(), z.number(), z.boolean()]))
      .optional()
      .describe("Path, query, and header parameters as key-value pairs"),
    body: z
      .unknown()
      .optional()
      .describe("Request body for POST/PUT/PATCH requests (object or string)"),
  },
  async ({ operationId, parameters, body }) => {
    const endpoint = findEndpoint(spec, operationId);

    if (!endpoint) {
      const available = getAllEndpoints(spec)
        .map((e) => e.operationId)
        .join(", ");
      return {
        content: [
          {
            type: "text" as const,
            text: `Unknown operationId: "${operationId}".\n\nAvailable operations: ${available}`,
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await executeCall(spec, endpoint, parameters ?? {}, body, extraHeaders);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error calling ${operationId}: ${message}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
