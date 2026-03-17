#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadSpec } from "./loader.js";
import { getAllEndpoints, getEndpointSummaries, findEndpoint } from "./endpoints.js";
import { executeCall } from "./executor.js";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(`mcp-openapi — Turn any OpenAPI spec into MCP tools for Claude

Usage:
  npx mcp-openapi --spec <url-or-path>

Options:
  --spec   Path or URL to an OpenAPI 3.x spec (JSON or YAML)
  --help   Show this help

Auth (via environment variables):
  OPENAPI_BEARER_TOKEN     Bearer token for Authorization header
  OPENAPI_API_KEY          API key value
  OPENAPI_API_KEY_HEADER   Header name for API key (default: X-Api-Key)
  OPENAPI_BASIC_USER       HTTP Basic auth username
  OPENAPI_BASIC_PASS       HTTP Basic auth password

Examples:
  npx mcp-openapi --spec https://petstore3.swagger.io/api/v3/openapi.json
  npx mcp-openapi --spec ./openapi.yaml
  OPENAPI_BEARER_TOKEN=mytoken npx mcp-openapi --spec https://api.example.com/openapi.json
`);
  process.exit(0);
}

const specIdx = args.indexOf("--spec");
const specArg = specIdx !== -1 ? args[specIdx + 1] : process.env.OPENAPI_SPEC_URL;

if (!specArg) {
  process.stderr.write("Error: --spec <url-or-path> is required\n");
  process.stderr.write("Run with --help for usage information\n");
  process.exit(1);
}

process.stderr.write(`Loading spec: ${specArg}\n`);
const spec = await loadSpec(specArg);
const apiTitle = spec.info?.title ?? "API";
process.stderr.write(`Loaded: ${apiTitle} (${getAllEndpoints(spec).length} endpoints)\n`);

const server = new McpServer({
  name: "mcp-openapi",
  version: "1.0.0",
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
      const result = await executeCall(spec, endpoint, parameters ?? {}, body);
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
