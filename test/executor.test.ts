import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeCall } from "../src/executor.js";
import type { OpenAPIV3 } from "openapi-types";
import type { EndpointInfo } from "../src/endpoints.js";

function makeSpec(
  serverUrl = "https://api.example.com"
): OpenAPIV3.Document {
  return {
    openapi: "3.0.3",
    info: { title: "Test", version: "1.0.0" },
    servers: [{ url: serverUrl }],
    paths: {},
  };
}

function makeEndpoint(overrides: Partial<EndpointInfo> = {}): EndpointInfo {
  return {
    path: "/pets",
    method: "get",
    operationId: "listPets",
    operation: { responses: {} },
    ...overrides,
  };
}

describe("executeCall", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.OPENAPI_BEARER_TOKEN;
    delete process.env.OPENAPI_API_KEY;
    delete process.env.OPENAPI_API_KEY_HEADER;
    delete process.env.OPENAPI_BASIC_USER;
    delete process.env.OPENAPI_BASIC_PASS;
  });

  it("builds correct URL with path parameters", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), {
        headers: { "content-type": "application/json" },
      })
    );

    const endpoint = makeEndpoint({
      path: "/pets/{petId}",
      operationId: "getPet",
      operation: {
        parameters: [{ name: "petId", in: "path", required: true }],
        responses: {},
      },
    });

    await executeCall(makeSpec(), endpoint, { petId: "42" }, undefined);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.example.com/pets/42",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("adds query parameters to URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { headers: { "content-type": "application/json" } })
    );

    const endpoint = makeEndpoint({
      operation: {
        parameters: [{ name: "status", in: "query", required: false }],
        responses: {},
      },
    });

    await executeCall(makeSpec(), endpoint, { status: "available" }, undefined);

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("?status=available");
  });

  it("sends JSON body for POST requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), {
        headers: { "content-type": "application/json" },
      })
    );

    const endpoint = makeEndpoint({
      method: "post",
      operationId: "createPet",
      operation: {
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {},
      },
    });

    const body = { name: "Buddy", status: "available" };
    await executeCall(makeSpec(), endpoint, {}, body);

    const [, options] = fetchSpy.mock.calls[0];
    expect(options?.method).toBe("POST");
    expect(options?.body).toBe(JSON.stringify(body));
  });

  it("adds bearer token when OPENAPI_BEARER_TOKEN is set", async () => {
    process.env.OPENAPI_BEARER_TOKEN = "test-token-123";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { headers: { "content-type": "application/json" } })
    );

    await executeCall(makeSpec(), makeEndpoint(), {}, undefined);

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-token-123");
  });

  it("adds API key header when OPENAPI_API_KEY is set", async () => {
    process.env.OPENAPI_API_KEY = "my-key";
    process.env.OPENAPI_API_KEY_HEADER = "X-Custom-Key";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { headers: { "content-type": "application/json" } })
    );

    await executeCall(makeSpec(), makeEndpoint(), {}, undefined);

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["X-Custom-Key"]).toBe("my-key");
  });

  it("throws for missing required parameters", async () => {
    const endpoint = makeEndpoint({
      operation: {
        parameters: [{ name: "id", in: "path", required: true }],
        responses: {},
      },
    });

    await expect(
      executeCall(makeSpec(), endpoint, {}, undefined)
    ).rejects.toThrow("Missing required parameter: id");
  });

  it("returns structured response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ pets: [] }), {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
      })
    );

    const result = await executeCall(makeSpec(), makeEndpoint(), {}, undefined);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ pets: [] });
  });
});
