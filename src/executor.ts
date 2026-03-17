import type { OpenAPIV3 } from "openapi-types";
import type { EndpointInfo } from "./endpoints.js";

function getBaseUrl(spec: OpenAPIV3.Document): string {
  const serverUrl = spec.servers?.[0]?.url ?? "";
  // Remove trailing slash
  return serverUrl.replace(/\/$/, "");
}

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  if (process.env.OPENAPI_BEARER_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.OPENAPI_BEARER_TOKEN}`;
  } else if (process.env.OPENAPI_API_KEY) {
    const keyHeader = process.env.OPENAPI_API_KEY_HEADER ?? "X-Api-Key";
    headers[keyHeader] = process.env.OPENAPI_API_KEY;
  } else if (process.env.OPENAPI_BASIC_USER) {
    const creds = Buffer.from(
      `${process.env.OPENAPI_BASIC_USER}:${process.env.OPENAPI_BASIC_PASS ?? ""}`
    ).toString("base64");
    headers["Authorization"] = `Basic ${creds}`;
  }

  return headers;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
}

export async function executeCall(
  spec: OpenAPIV3.Document,
  endpoint: EndpointInfo,
  parameters: Record<string, string | number | boolean>,
  body: unknown
): Promise<ApiResponse> {
  const baseUrl = getBaseUrl(spec);
  let urlPath = endpoint.path;
  const queryParams: Record<string, string> = {};
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...buildAuthHeaders(),
  };

  const params = (endpoint.operation.parameters ?? []) as OpenAPIV3.ParameterObject[];

  for (const param of params) {
    const value = parameters[param.name];
    if (value === undefined || value === null) {
      if (param.required) {
        throw new Error(`Missing required parameter: ${param.name} (${param.in})`);
      }
      continue;
    }

    const strValue = String(value);

    switch (param.in) {
      case "path":
        urlPath = urlPath.replace(`{${param.name}}`, encodeURIComponent(strValue));
        break;
      case "query":
        queryParams[param.name] = strValue;
        break;
      case "header":
        headers[param.name] = strValue;
        break;
      // cookie params are uncommon — skip for now
    }
  }

  let fullUrl = baseUrl + urlPath;
  if (Object.keys(queryParams).length > 0) {
    fullUrl += "?" + new URLSearchParams(queryParams).toString();
  }

  const fetchOptions: RequestInit = {
    method: endpoint.method.toUpperCase(),
    headers,
  };

  const methodHasBody = ["post", "put", "patch"].includes(endpoint.method.toLowerCase());
  if (methodHasBody && body !== undefined && body !== null) {
    if (typeof body === "string") {
      fetchOptions.body = body;
      headers["Content-Type"] = "text/plain";
    } else {
      fetchOptions.body = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    }
  }

  const response = await fetch(fullUrl, fetchOptions);
  const responseText = await response.text();

  let responseBody: unknown;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json") || contentType.includes("+json")) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }
  } else {
    responseBody = responseText;
  }

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body: responseBody,
  };
}
