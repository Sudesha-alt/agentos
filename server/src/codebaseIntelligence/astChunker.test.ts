import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSemanticChunks, buildEmbeddingChunks } from "./astChunker";
import {
  CODEBASE_CHUNK_MAX_CHARS,
  CODEBASE_CHUNK_MAX_TOKENS,
  CODEBASE_EMBEDDING_INPUT_MAX_CHARS,
} from "./retrievalConfig";

describe("astChunker", () => {
  it("defaults chunk budget to ~2048 tokens / ~8192 chars", () => {
    assert.equal(CODEBASE_CHUNK_MAX_TOKENS, 2048);
    assert.equal(CODEBASE_CHUNK_MAX_CHARS, 8192);
    assert.equal(CODEBASE_EMBEDDING_INPUT_MAX_CHARS, 8192 + 512);
  });

  it("keeps TypeScript functions intact (no mid-body split)", () => {
    const content = `import { foo } from "./foo";

export function calculateTotal(items: number[]): number {
  let sum = 0;
  for (const item of items) {
    sum += item;
  }
  return sum;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}
`;
    const chunks = buildSemanticChunks("src/billing.ts", content);
    const fnChunks = chunks.filter(
      (c) =>
        c.spanType === "function_declaration" || c.spanType === "export_statement"
    );

    assert.ok(fnChunks.length >= 2, "expected separate function chunks");
    for (const chunk of fnChunks) {
      assert.ok(
        chunk.text.includes("return") || chunk.text.includes("export function"),
        "function chunk should contain full body"
      );
      assert.equal(chunk.chunkStrategy, "ast");
      assert.ok(chunk.symbolName);
    }
  });

  it("splits oversized classes into method-level spans", () => {
    const methods = Array.from({ length: 40 }, (_, i) => {
      return `  method${i}(input: string): string {
    const lines = input.split("\\n").map((line) => line.trim().toLowerCase());
    const filtered = lines.filter((line) => line.length > 2 && !line.startsWith("#"));
    const joined = filtered.join(" ").repeat(5);
    return joined.padEnd(200, "x");
  }`;
    }).join("\n\n");

    const content = `export class LargeService {
${methods}
}
`;
    const chunks = buildSemanticChunks("src/large.ts", content);
    const methodChunks = chunks.filter(
      (c) => c.spanType === "method_definition" || c.spanType === "method_signature"
    );

    assert.ok(
      methodChunks.length >= 8,
      `expected method-level chunks, got ${methodChunks.length}`
    );
    assert.ok(
      !chunks.some((c) => c.text.length > CODEBASE_CHUNK_MAX_CHARS + 100),
      "no chunk should exceed char budget"
    );
  });

  it("chunks Java methods at class boundaries", () => {
    const content = `public class BillingService {
  public int calculateTotal(int[] items) {
  int sum = 0;
  for (int item : items) { sum += item; }
  return sum;
  }
}
`;
    const chunks = buildSemanticChunks("src/BillingService.java", content);
    const classChunks = chunks.filter((c) => c.spanType === "class_declaration");
    assert.ok(classChunks.length >= 1);
    assert.equal(classChunks[0]?.chunkStrategy, "ast");
    assert.equal(classChunks[0]?.symbolName, "BillingService");
  });

  it("chunks Ruby classes and methods", () => {
    const content = `class InvoiceBuilder
  def build(line_items)
    line_items.map(&:total).sum
  end
end
`;
    const chunks = buildSemanticChunks("app/models/invoice_builder.rb", content);
    const classChunk = chunks.find((c) => c.spanType === "class");
    assert.ok(classChunk, "expected Ruby class chunk");
    assert.equal(classChunk.chunkStrategy, "ast");
    assert.equal(classChunk.symbolName, "InvoiceBuilder");
  });

  it("chunks Rust functions", () => {
    const content = `pub fn calculate_total(items: &[i32]) -> i32 {
  items.iter().copied().sum()
}
`;
    const chunks = buildSemanticChunks("src/billing.rs", content);
    const fnChunk = chunks.find((c) => c.spanType === "function_item");
    assert.ok(fnChunk);
    assert.equal(fnChunk.chunkStrategy, "ast");
    assert.equal(fnChunk.symbolName, "calculate_total");
  });

  it("chunks Swift classes", () => {
    const content = `class CheckoutService {
  func total(for items: [Int]) -> Int {
    return items.reduce(0, +)
  }
}
`;
    const chunks = buildSemanticChunks("Sources/CheckoutService.swift", content);
    const classChunk = chunks.find((c) => c.spanType === "class_declaration");
    assert.ok(classChunk);
    assert.equal(classChunk.chunkStrategy, "ast");
    assert.equal(classChunk.symbolName, "CheckoutService");
  });

  it("chunks Prisma schema by model blocks", () => {
    const content = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id    String @id @default(cuid())
  email String @unique
}

model Workspace {
  id   String @id @default(cuid())
  name String
}
`;
    const chunks = buildSemanticChunks("prisma/schema.prisma", content);
    const modelChunks = chunks.filter((c) => c.spanType === "model_block");
    assert.ok(modelChunks.length >= 2);
    assert.ok(modelChunks.every((c) => c.chunkStrategy === "prisma_schema"));
    assert.ok(modelChunks.some((c) => c.symbolName === "User"));
    assert.ok(modelChunks.some((c) => c.symbolName === "Workspace"));
  });

  it("chunks YAML by top-level keys when tree-sitter unavailable", () => {
    const content = `database:
  host: localhost
  port: 5432
  name: agentos_production_database

cache:
  host: redis.internal
  port: 6379
  ttl_seconds: 3600
`;
    const chunks = buildSemanticChunks("config/app.yaml", content);
    assert.ok(chunks.length >= 2);
    assert.ok(
      chunks.every(
        (c) => c.chunkStrategy === "ast" || c.chunkStrategy === "schema_block"
      )
    );
    assert.ok(chunks.some((c) => c.symbolName === "database" || c.text.includes("database:")));
  });

  it("chunks GraphQL types via schema blocks when tree-sitter unavailable", () => {
    const content = `type Query {
  user(id: ID!): User
  users: [User!]!
}

type User {
  id: ID!
  email: String!
  workspaces: [Workspace!]!
}
`;
    const chunks = buildSemanticChunks("schema.graphql", content);
    const typeChunks = chunks.filter((c) => c.spanType === "type_block");
    assert.ok(typeChunks.length >= 2);
    assert.ok(typeChunks.every((c) => c.chunkStrategy === "schema_block"));
  });

  it("chunks markdown by headings", () => {
    const content = `# Overview
This is the overview section with enough text to pass the minimum chunk size threshold easily.

## API
Details about the API endpoints and how they work in practice for integrators.

## Deployment
Notes on deploying to production with environment variables configured.
`;
    const chunks = buildSemanticChunks("docs/guide.md", content);
    assert.ok(chunks.length >= 2);
    assert.ok(chunks.every((c) => c.chunkStrategy === "markdown"));
  });

  it("emits header chunk plus semantic body chunks", () => {
    const content = `export function hello(): string {
  return "world";
}
`;
    const embedded = buildEmbeddingChunks("src/hello.ts", content, {
      summary: "hello helper",
      exports: [{ name: "hello", type: "function" }],
      patterns: [],
    });

    assert.equal(embedded[0]?.metadata.isHeader, true);
    assert.equal(embedded[0]?.metadata.chunkStrategy, "header");
    assert.ok(embedded.length >= 2);
    assert.ok(embedded[1]?.text.includes("SYMBOL: hello"));
  });
});
