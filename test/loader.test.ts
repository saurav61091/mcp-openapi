import { describe, it, expect } from "vitest";
import { loadSpec } from "../src/loader.js";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("loadSpec", () => {
  it("loads a JSON spec from a local file", async () => {
    const specPath = join(tmpdir(), `test-spec-${Date.now()}.json`);
    const spec = {
      openapi: "3.0.3",
      info: { title: "File Test", version: "1.0.0" },
      paths: {
        "/ping": {
          get: { operationId: "ping", responses: { "200": { description: "OK" } } },
        },
      },
    };

    writeFileSync(specPath, JSON.stringify(spec));

    try {
      const loaded = await loadSpec(specPath);
      expect(loaded.info.title).toBe("File Test");
      expect(loaded.paths?.["/ping"]).toBeDefined();
    } finally {
      unlinkSync(specPath);
    }
  });

  it("loads a YAML spec from a local file", async () => {
    const specPath = join(tmpdir(), `test-spec-${Date.now()}.yaml`);
    const yaml = `
openapi: "3.0.3"
info:
  title: YAML Test
  version: "1.0.0"
paths:
  /health:
    get:
      operationId: healthCheck
      responses:
        "200":
          description: OK
`;
    writeFileSync(specPath, yaml);

    try {
      const loaded = await loadSpec(specPath);
      expect(loaded.info.title).toBe("YAML Test");
      expect(loaded.paths?.["/health"]).toBeDefined();
    } finally {
      unlinkSync(specPath);
    }
  });

  it("rejects non-OpenAPI 3.x specs", async () => {
    const specPath = join(tmpdir(), `test-spec-${Date.now()}.json`);
    writeFileSync(
      specPath,
      JSON.stringify({ swagger: "2.0", info: { title: "Old", version: "1.0" }, paths: {} })
    );

    try {
      await expect(loadSpec(specPath)).rejects.toThrow("Only OpenAPI 3.x specs are supported");
    } finally {
      unlinkSync(specPath);
    }
  });

  it("throws for nonexistent file", async () => {
    await expect(loadSpec("/nonexistent/spec.json")).rejects.toThrow();
  });
});
