import { describe, it, expect } from "vitest";
import { getAllEndpoints, findEndpoint, getEndpointSummaries } from "../src/endpoints.js";
import type { OpenAPIV3 } from "openapi-types";

function makeSpec(paths: OpenAPIV3.PathsObject = {}): OpenAPIV3.Document {
  return {
    openapi: "3.0.3",
    info: { title: "Test API", version: "1.0.0" },
    paths,
  };
}

describe("getAllEndpoints", () => {
  it("returns empty array for spec with no paths", () => {
    expect(getAllEndpoints(makeSpec())).toEqual([]);
  });

  it("extracts endpoints from all HTTP methods", () => {
    const spec = makeSpec({
      "/pets": {
        get: { operationId: "listPets", responses: {} },
        post: { operationId: "createPet", responses: {} },
      },
      "/pets/{id}": {
        get: { operationId: "getPet", responses: {} },
        delete: { operationId: "deletePet", responses: {} },
      },
    });

    const endpoints = getAllEndpoints(spec);
    expect(endpoints).toHaveLength(4);
    expect(endpoints.map((e) => e.operationId)).toEqual([
      "listPets",
      "createPet",
      "getPet",
      "deletePet",
    ]);
  });

  it("generates operationId when missing", () => {
    const spec = makeSpec({
      "/users/{id}/posts": {
        get: { responses: {} },
      },
    });

    const endpoints = getAllEndpoints(spec);
    expect(endpoints[0].operationId).toBe("get_users_id_posts");
  });

  it("captures method and path correctly", () => {
    const spec = makeSpec({
      "/items": {
        put: { operationId: "updateItem", responses: {} },
      },
    });

    const ep = getAllEndpoints(spec)[0];
    expect(ep.method).toBe("put");
    expect(ep.path).toBe("/items");
  });
});

describe("findEndpoint", () => {
  const spec = makeSpec({
    "/pets": {
      get: { operationId: "listPets", responses: {} },
      post: { operationId: "createPet", responses: {} },
    },
  });

  it("finds endpoint by operationId", () => {
    const ep = findEndpoint(spec, "listPets");
    expect(ep).toBeDefined();
    expect(ep!.method).toBe("get");
    expect(ep!.path).toBe("/pets");
  });

  it("returns undefined for unknown operationId", () => {
    expect(findEndpoint(spec, "nonexistent")).toBeUndefined();
  });
});

describe("getEndpointSummaries", () => {
  it("includes API title and version", () => {
    const spec = makeSpec({
      "/health": { get: { operationId: "health", responses: {} } },
    });
    const summary = getEndpointSummaries(spec);
    expect(summary).toContain("Test API");
    expect(summary).toContain("v1.0.0");
  });

  it("groups by tags", () => {
    const spec = makeSpec({
      "/pets": {
        get: { operationId: "listPets", tags: ["Pets"], responses: {} },
      },
      "/users": {
        get: { operationId: "listUsers", tags: ["Users"], responses: {} },
      },
    });

    const summary = getEndpointSummaries(spec);
    expect(summary).toContain("## Pets");
    expect(summary).toContain("## Users");
  });

  it("shows required and optional params", () => {
    const spec = makeSpec({
      "/pets": {
        get: {
          operationId: "listPets",
          parameters: [
            { name: "status", in: "query", required: true },
            { name: "limit", in: "query", required: false },
          ],
          responses: {},
        },
      },
    });

    const summary = getEndpointSummaries(spec);
    expect(summary).toContain("Required params: status (query)");
    expect(summary).toContain("Optional params: limit (query)");
  });

  it("shows endpoint count", () => {
    const spec = makeSpec({
      "/a": { get: { operationId: "a", responses: {} } },
      "/b": { get: { operationId: "b", responses: {} } },
    });

    const summary = getEndpointSummaries(spec);
    expect(summary).toContain("Total: 2 endpoints");
  });
});
