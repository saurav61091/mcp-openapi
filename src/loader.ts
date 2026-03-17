import { readFileSync } from "fs";
import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPIV3 } from "openapi-types";

export async function loadSpec(specPathOrUrl: string): Promise<OpenAPIV3.Document> {
  let raw: string;

  if (specPathOrUrl.startsWith("http://") || specPathOrUrl.startsWith("https://")) {
    const res = await fetch(specPathOrUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch spec: ${res.status} ${res.statusText}`);
    }
    raw = await res.text();
  } else {
    raw = readFileSync(specPathOrUrl, "utf-8");
  }

  // Write to a temp-like parse — swagger-parser accepts a raw object or URL
  // Parse JSON/YAML ourselves first so swagger-parser can dereference it
  let parsed: unknown;
  if (raw.trimStart().startsWith("{") || raw.trimStart().startsWith("[")) {
    parsed = JSON.parse(raw);
  } else {
    const { load } = await import("js-yaml");
    parsed = load(raw);
  }

  // Validate and dereference all $refs
  const dereferenced = await SwaggerParser.dereference(parsed as Parameters<typeof SwaggerParser.dereference>[0]);

  // Ensure it's OpenAPI 3.x
  const doc = dereferenced as Record<string, unknown>;
  if (!doc["openapi"] || !(doc["openapi"] as string).startsWith("3.")) {
    throw new Error(
      `Only OpenAPI 3.x specs are supported. Found: openapi=${doc["openapi"] ?? doc["swagger"] ?? "unknown"}`
    );
  }

  return dereferenced as OpenAPIV3.Document;
}
