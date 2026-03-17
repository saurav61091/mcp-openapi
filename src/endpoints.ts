import type { OpenAPIV3 } from "openapi-types";

export interface EndpointInfo {
  path: string;
  method: string;
  operationId: string;
  operation: OpenAPIV3.OperationObject;
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

export function getAllEndpoints(spec: OpenAPIV3.Document): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!pathItem) continue;

    for (const method of HTTP_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method] as
        | OpenAPIV3.OperationObject
        | undefined;
      if (!operation) continue;

      // Generate a stable operationId if the spec doesn't have one
      const operationId =
        operation.operationId ??
        `${method}_${path.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "")}`;

      endpoints.push({
        path,
        method,
        operationId,
        operation: { ...operation, operationId },
      });
    }
  }

  return endpoints;
}

export function findEndpoint(
  spec: OpenAPIV3.Document,
  operationId: string
): EndpointInfo | undefined {
  return getAllEndpoints(spec).find((e) => e.operationId === operationId);
}

export function getEndpointSummaries(spec: OpenAPIV3.Document): string {
  const endpoints = getAllEndpoints(spec);
  const lines: string[] = [
    `# ${spec.info.title} (v${spec.info.version})`,
    "",
  ];

  if (spec.info.description) {
    lines.push(spec.info.description.split("\n")[0], "");
  }

  if (spec.servers?.[0]?.url) {
    lines.push(`Base URL: ${spec.servers[0].url}`, "");
  }

  // Group by first tag
  const byTag = new Map<string, EndpointInfo[]>();
  for (const ep of endpoints) {
    const tag = ep.operation.tags?.[0] ?? "General";
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag)!.push(ep);
  }

  for (const [tag, eps] of byTag) {
    lines.push(`## ${tag}`);
    for (const ep of eps) {
      const summary = ep.operation.summary ?? ep.operation.description ?? "";
      lines.push(
        `- **${ep.operationId}** \`${ep.method.toUpperCase()} ${ep.path}\`${summary ? ` — ${summary}` : ""}`
      );

      const params = (ep.operation.parameters ?? []) as OpenAPIV3.ParameterObject[];
      const required = params.filter((p) => p.required).map((p) => `${p.name} (${p.in})`);
      const optional = params.filter((p) => !p.required).map((p) => `${p.name} (${p.in})`);

      if (required.length > 0) {
        lines.push(`  Required params: ${required.join(", ")}`);
      }
      if (optional.length > 0) {
        lines.push(`  Optional params: ${optional.join(", ")}`);
      }

      const requestBody = ep.operation.requestBody as OpenAPIV3.RequestBodyObject | undefined;
      if (requestBody) {
        const bodyRequired = requestBody.required ? " (required)" : " (optional)";
        lines.push(`  Request body${bodyRequired}`);
      }
    }
    lines.push("");
  }

  lines.push(`Total: ${endpoints.length} endpoint${endpoints.length !== 1 ? "s" : ""}`);
  return lines.join("\n");
}
