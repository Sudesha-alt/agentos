/**
 * Cursor-style semantic chunking via tree-sitter AST spans.
 *
 * Strategy (from public Cursor / cAST descriptions):
 * 1. Parse source into an AST.
 * 2. Extract spans at function / class / method / type boundaries — never mid-statement.
 * 3. Recurse into children when a span exceeds the char budget.
 * 4. Merge adjacent small sibling spans up to the budget.
 * 5. Fill uncovered gaps (imports, module preamble) as module_fragment chunks.
 * 6. Fall back to heading-based (markdown), schema blocks (prisma), or fixed windows.
 */

import Parser from "tree-sitter";
import type { SyntaxNode } from "tree-sitter";

import {
  CODEBASE_CHUNK_MAX_CHARS,
  CODEBASE_CHUNK_MIN_CHARS,
  CODEBASE_MAX_CHUNKS_PER_FILE,
} from "./retrievalConfig";

type TreeSitterLanguage = NonNullable<Parameters<Parser["setLanguage"]>[0]>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TypeScript = require("tree-sitter-typescript") as {
  typescript: TreeSitterLanguage;
  tsx: TreeSitterLanguage;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JavaScript = require("tree-sitter-javascript") as TreeSitterLanguage;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Python = require("tree-sitter-python") as TreeSitterLanguage;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Go = require("tree-sitter-go") as TreeSitterLanguage;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JsonLang = require("tree-sitter-json") as TreeSitterLanguage;

function safeLoadGrammar(moduleId: string): TreeSitterLanguage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(moduleId) as TreeSitterLanguage | { default: TreeSitterLanguage };
    return ("default" in mod && mod.default ? mod.default : mod) as TreeSitterLanguage;
  } catch {
    return null;
  }
}

/** Extension → lazy grammar loader (null when native binding unavailable). */
const GRAMMAR_BY_EXT: Record<string, () => TreeSitterLanguage | null> = {
  ts: () => TypeScript.typescript,
  tsx: () => TypeScript.tsx,
  js: () => JavaScript,
  jsx: () => JavaScript,
  mjs: () => JavaScript,
  cjs: () => JavaScript,
  py: () => Python,
  go: () => Go,
  json: () => JsonLang,
  rb: () => safeLoadGrammar("tree-sitter-ruby"),
  java: () => safeLoadGrammar("tree-sitter-java"),
  kt: () => safeLoadGrammar("tree-sitter-kotlin"),
  cs: () => safeLoadGrammar("tree-sitter-c-sharp"),
  php: () => safeLoadGrammar("tree-sitter-php"),
  rs: () => safeLoadGrammar("tree-sitter-rust"),
  swift: () => safeLoadGrammar("tree-sitter-swift"),
  sql: () => safeLoadGrammar("tree-sitter-sql"),
  graphql: () => safeLoadGrammar("tree-sitter-graphql"),
  yaml: () => safeLoadGrammar("tree-sitter-yaml"),
  yml: () => safeLoadGrammar("tree-sitter-yaml"),
};

export type ChunkStrategy =
  | "ast"
  | "markdown"
  | "fallback"
  | "header"
  | "prisma_schema"
  | "schema_block";

export interface SemanticChunk {
  text: string;
  startLine: number;
  endLine: number;
  startByte: number;
  endByte: number;
  spanType: string;
  symbolName: string | null;
  chunkStrategy: ChunkStrategy;
}

export interface EmbeddingChunkInput {
  text: string;
  metadata: {
    spanType: string;
    symbolName: string | null;
    startLine: number | null;
    endLine: number | null;
    chunkStrategy: ChunkStrategy;
    isHeader: boolean;
  };
}

const ROOT_NODE_TYPES = new Set([
  "program",
  "source_file",
  "module",
  "document",
  "translation_unit",
  "compilation_unit",
  "stream",
  "script",
  "chunk",
  "crate",
]);

const CHUNK_NODE_TYPES = new Set([
  // TypeScript / JavaScript
  "function_declaration",
  "generator_function_declaration",
  "class_declaration",
  "abstract_class_declaration",
  "interface_declaration",
  "type_alias_declaration",
  "enum_declaration",
  "method_definition",
  "lexical_declaration",
  "export_statement",
  "import_statement",
  "internal_module",
  "namespace_definition",
  "ambient_declaration",
  // Python
  "function_definition",
  "class_definition",
  "decorated_definition",
  // Go
  "method_declaration",
  "type_declaration",
  "var_declaration",
  "const_declaration",
  // JSON
  "pair",
  "object",
  "array",
  // Java / Kotlin
  "method_declaration",
  "constructor_declaration",
  "annotation_type_declaration",
  "object_declaration",
  "property_declaration",
  "companion_object",
  // Ruby
  "method",
  "class",
  "module",
  "singleton_method",
  // Rust
  "function_item",
  "impl_item",
  "struct_item",
  "enum_item",
  "trait_item",
  "mod_item",
  "const_item",
  // C#
  "method_declaration",
  "struct_declaration",
  // PHP
  "trait_declaration",
  // Swift
  "function_declaration",
  "protocol_declaration",
  "struct_declaration",
  // SQL
  "statement",
  "create_table_statement",
  "create_index_statement",
  "create_view_statement",
  // GraphQL
  "object_type_definition",
  "interface_type_definition",
  "enum_type_definition",
  "input_object_type_definition",
  "schema_definition",
  "scalar_type_definition",
  "union_type_definition",
  // YAML
  "block_mapping",
  "block_sequence",
]);

const parserByLanguage = new Map<string, Parser>();

function languageForExtension(ext: string): TreeSitterLanguage | null {
  const loader = GRAMMAR_BY_EXT[ext];
  return loader ? loader() : null;
}

function getParser(ext: string): Parser | null {
  const lang = languageForExtension(ext);
  if (!lang) return null;
  let parser = parserByLanguage.get(ext);
  if (!parser) {
    parser = new Parser();
    parser.setLanguage(lang);
    parserByLanguage.set(ext, parser);
  }
  return parser;
}

function lineNumberAt(content: string, byteIndex: number): number {
  let line = 1;
  for (let i = 0; i < byteIndex && i < content.length; i += 1) {
    if (content.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function symbolNameForNode(node: SyntaxNode): string | null {
  if (node.type === "export_statement") {
    for (const child of node.namedChildren) {
      const nested = symbolNameForNode(child);
      if (nested) return nested;
    }
  }

  if (node.type === "decorated_definition") {
    for (const child of node.namedChildren) {
      const nested = symbolNameForNode(child);
      if (nested) return nested;
    }
  }

  const nameNode =
    node.childForFieldName("name") ??
    node.childForFieldName("identifier") ??
    node.namedChildren.find((child) =>
      ["identifier", "constant", "type_identifier", "property_identifier"].includes(child.type)
    ) ??
    node.childForFieldName("declarator")?.childForFieldName("name") ??
    null;
  if (!nameNode) return null;
  const name = nameNode.text.trim();
  return name || null;
}

function spanFromNode(
  node: SyntaxNode,
  content: string,
  spanType: string,
  strategy: ChunkStrategy
): SemanticChunk {
  const text = content.slice(node.startIndex, node.endIndex);
  return {
    text,
    startByte: node.startIndex,
    endByte: node.endIndex,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    spanType,
    symbolName: symbolNameForNode(node),
    chunkStrategy: strategy,
  };
}

function lineSplitOversized(
  content: string,
  startByte: number,
  endByte: number,
  spanType: string,
  symbolName: string | null,
  strategy: ChunkStrategy = "fallback"
): SemanticChunk[] {
  const slice = content.slice(startByte, endByte);
  if (slice.length <= CODEBASE_CHUNK_MAX_CHARS) {
    return [
      {
        text: slice,
        startByte,
        endByte,
        startLine: lineNumberAt(content, startByte),
        endLine: lineNumberAt(content, Math.max(startByte, endByte - 1)),
        spanType,
        symbolName,
        chunkStrategy: strategy,
      },
    ];
  }

  const lines = slice.split("\n");
  const chunks: SemanticChunk[] = [];
  let chunkLines: string[] = [];
  let chunkStartByte = startByte;

  const flush = () => {
    if (!chunkLines.length) return;
    const text = chunkLines.join("\n");
    if (text.trim().length < CODEBASE_CHUNK_MIN_CHARS) return;
    const end = chunkStartByte + text.length;
    chunks.push({
      text,
      startByte: chunkStartByte,
      endByte: end,
      startLine: lineNumberAt(content, chunkStartByte),
      endLine: lineNumberAt(content, Math.max(chunkStartByte, end - 1)),
      spanType: "line_block",
      symbolName,
      chunkStrategy: strategy,
    });
    chunkLines = [];
    chunkStartByte = end + 1;
  };

  for (const line of lines) {
    const candidate = chunkLines.length ? `${chunkLines.join("\n")}\n${line}` : line;
    if (candidate.length > CODEBASE_CHUNK_MAX_CHARS && chunkLines.length > 0) {
      flush();
    }
    chunkLines.push(line);
  }
  flush();

  return chunks.length
    ? chunks
    : lineSplitFixed(slice, startByte, spanType, symbolName, content, strategy);
}

function lineSplitFixed(
  slice: string,
  startByte: number,
  spanType: string,
  symbolName: string | null,
  fullContent: string,
  strategy: ChunkStrategy = "fallback"
): SemanticChunk[] {
  const chunks: SemanticChunk[] = [];
  for (let i = 0; i < slice.length; i += CODEBASE_CHUNK_MAX_CHARS) {
    const text = slice.slice(i, i + CODEBASE_CHUNK_MAX_CHARS);
    const byteStart = startByte + i;
    const byteEnd = byteStart + text.length;
    chunks.push({
      text,
      startByte: byteStart,
      endByte: byteEnd,
      startLine: lineNumberAt(fullContent, byteStart),
      endLine: lineNumberAt(fullContent, Math.max(byteStart, byteEnd - 1)),
      spanType,
      symbolName,
      chunkStrategy: strategy,
    });
  }
  return chunks;
}

function extractAstSpans(node: SyntaxNode, content: string): SemanticChunk[] {
  const type = node.type;
  const size = node.endIndex - node.startIndex;

  if (CHUNK_NODE_TYPES.has(type)) {
    if (size <= CODEBASE_CHUNK_MAX_CHARS) {
      return [spanFromNode(node, content, type, "ast")];
    }
    const childSpans: SemanticChunk[] = [];
    for (const child of node.namedChildren) {
      childSpans.push(...extractAstSpans(child, content));
    }
    if (childSpans.length > 0) {
      return childSpans;
    }
    return lineSplitOversized(
      content,
      node.startIndex,
      node.endIndex,
      type,
      symbolNameForNode(node),
      "ast"
    );
  }

  if (ROOT_NODE_TYPES.has(type) || node.parent === null) {
    const spans: SemanticChunk[] = [];
    for (const child of node.namedChildren) {
      spans.push(...extractAstSpans(child, content));
    }
    return spans;
  }

  const spans: SemanticChunk[] = [];
  for (const child of node.namedChildren) {
    spans.push(...extractAstSpans(child, content));
  }
  return spans;
}

function fillGaps(content: string, spans: SemanticChunk[]): SemanticChunk[] {
  const sorted = [...spans].sort((a, b) => a.startByte - b.startByte);
  const withGaps: SemanticChunk[] = [];
  let cursor = 0;

  for (const span of sorted) {
    if (span.startByte > cursor) {
      const gapText = content.slice(cursor, span.startByte);
      if (gapText.trim().length >= CODEBASE_CHUNK_MIN_CHARS) {
        withGaps.push({
          text: gapText,
          startByte: cursor,
          endByte: span.startByte,
          startLine: lineNumberAt(content, cursor),
          endLine: lineNumberAt(content, Math.max(cursor, span.startByte - 1)),
          spanType: "module_fragment",
          symbolName: null,
          chunkStrategy: spans[0]?.chunkStrategy ?? "ast",
        });
      }
    }
    withGaps.push(span);
    cursor = Math.max(cursor, span.endByte);
  }

  if (cursor < content.length) {
    const tail = content.slice(cursor);
    if (tail.trim().length >= CODEBASE_CHUNK_MIN_CHARS) {
      withGaps.push({
        text: tail,
        startByte: cursor,
        endByte: content.length,
        startLine: lineNumberAt(content, cursor),
        endLine: lineNumberAt(content, content.length - 1),
        spanType: "module_fragment",
        symbolName: null,
        chunkStrategy: spans[0]?.chunkStrategy ?? "ast",
      });
    }
  }

  return withGaps;
}

function mergeAdjacentSmall(spans: SemanticChunk[]): SemanticChunk[] {
  if (!spans.length) return spans;
  const sorted = [...spans].sort((a, b) => a.startByte - b.startByte);
  const merged: SemanticChunk[] = [];

  for (const span of sorted) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.endByte === span.startByte &&
      prev.text.length + span.text.length + 1 <= CODEBASE_CHUNK_MAX_CHARS &&
      prev.chunkStrategy === span.chunkStrategy
    ) {
      const combined = `${prev.text}\n${span.text}`;
      merged[merged.length - 1] = {
        text: combined,
        startByte: prev.startByte,
        endByte: span.endByte,
        startLine: prev.startLine,
        endLine: span.endLine,
        spanType:
          prev.spanType === span.spanType ? prev.spanType : "merged_block",
        symbolName: prev.symbolName ?? span.symbolName,
        chunkStrategy: prev.chunkStrategy,
      };
    } else {
      merged.push({ ...span });
    }
  }

  return merged;
}

function sliceBalancedBlock(
  content: string,
  start: number,
  openChar: string,
  closeChar: string
): number {
  const braceStart = content.indexOf(openChar, start);
  if (braceStart < 0) return start;
  let depth = 0;
  for (let i = braceStart; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return content.length;
}

function chunkSchemaBlocks(
  content: string,
  blockRe: RegExp,
  strategy: ChunkStrategy
): SemanticChunk[] {
  const blocks: SemanticChunk[] = [];
  const re = new RegExp(blockRe.source, blockRe.flags.includes("g") ? blockRe.flags : `${blockRe.flags}g`);
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const start = match.index;
    const symbolName = match[2] ?? match[1] ?? null;
    const spanType = `${match[1]}_block`;
    const end = sliceBalancedBlock(content, start, "{", "}");
    const text = content.slice(start, end);
    if (text.trim().length < CODEBASE_CHUNK_MIN_CHARS) continue;
    blocks.push({
      text,
      startByte: start,
      endByte: end,
      startLine: lineNumberAt(content, start),
      endLine: lineNumberAt(content, Math.max(start, end - 1)),
      spanType,
      symbolName,
      chunkStrategy: strategy,
    });
  }
  return mergeAdjacentSmall(blocks);
}

function chunkPrisma(content: string): SemanticChunk[] {
  return chunkSchemaBlocks(
    content,
    /^(model|enum|type|generator|datasource)\s+(\w+)\s*\{/m,
    "prisma_schema"
  );
}

function chunkGraphqlStructure(content: string): SemanticChunk[] {
  return chunkSchemaBlocks(
    content,
    /^(type|interface|enum|input|scalar|union|schema|extend)\s+(\w+)\s*[{(]/m,
    "schema_block"
  );
}

function chunkYamlStructure(content: string): SemanticChunk[] {
  const docs = content.split(/\n---\n/);
  if (docs.length > 1) {
    const chunks: SemanticChunk[] = [];
    let offset = 0;
    for (let i = 0; i < docs.length; i += 1) {
      const doc = docs[i];
      const start = offset;
      const end = start + doc.length;
      if (doc.trim().length >= CODEBASE_CHUNK_MIN_CHARS) {
        chunks.push({
          text: doc,
          startByte: start,
          endByte: end,
          startLine: lineNumberAt(content, start),
          endLine: lineNumberAt(content, Math.max(start, end - 1)),
          spanType: "yaml_document",
          symbolName: null,
          chunkStrategy: "schema_block",
        });
      }
      offset = end + (i < docs.length - 1 ? 5 : 0);
    }
    if (chunks.length) return mergeAdjacentSmall(chunks);
  }

  const lines = content.split("\n");
  const sections: SemanticChunk[] = [];
  let current: string[] = [];
  let sectionStart = 0;
  let byteOffset = 0;

  const flush = (endByte: number) => {
    const text = current.join("\n");
    if (text.trim().length >= CODEBASE_CHUNK_MIN_CHARS) {
      const keyMatch = text.match(/^([a-zA-Z_][\w-]*):/m);
      sections.push({
        text,
        startByte: sectionStart,
        endByte: endByte,
        startLine: lineNumberAt(content, sectionStart),
        endLine: lineNumberAt(content, Math.max(sectionStart, endByte - 1)),
        spanType: "yaml_section",
        symbolName: keyMatch?.[1] ?? null,
        chunkStrategy: "schema_block",
      });
    }
    current = [];
    sectionStart = endByte + (endByte < content.length ? 1 : 0);
  };

  for (const line of lines) {
    const isTopLevelKey = /^[a-zA-Z_][\w-]*:/.test(line) && !line.startsWith(" ");
    const lineEnd = byteOffset + line.length;
    if (isTopLevelKey && current.length > 0) {
      flush(byteOffset - 1);
    }
    if (current.length === 0) sectionStart = byteOffset;
    current.push(line);
    byteOffset = lineEnd + 1;
    if (current.join("\n").length > CODEBASE_CHUNK_MAX_CHARS) {
      flush(lineEnd);
    }
  }
  if (current.length) flush(content.length);

  return sections.length ? mergeAdjacentSmall(sections) : [];
}

function chunkMarkdown(content: string): SemanticChunk[] {
  const lines = content.split("\n");
  const sections: SemanticChunk[] = [];
  let current: string[] = [];
  let sectionStart = 0;
  let byteOffset = 0;

  const flush = (endByte: number) => {
    const text = current.join("\n");
    if (text.trim().length >= CODEBASE_CHUNK_MIN_CHARS) {
      sections.push({
        text,
        startByte: sectionStart,
        endByte: endByte,
        startLine: lineNumberAt(content, sectionStart),
        endLine: lineNumberAt(content, Math.max(sectionStart, endByte - 1)),
        spanType: "markdown_section",
        symbolName: null,
        chunkStrategy: "markdown",
      });
    }
    current = [];
    sectionStart = endByte + (endByte < content.length ? 1 : 0);
  };

  for (const line of lines) {
    const isHeading = /^#{1,6}\s/.test(line);
    const lineEnd = byteOffset + line.length;
    if (isHeading && current.length > 0) {
      flush(byteOffset - 1);
    }
    if (current.length === 0) sectionStart = byteOffset;
    current.push(line);
    byteOffset = lineEnd + 1;

    const joined = current.join("\n");
    if (joined.length > CODEBASE_CHUNK_MAX_CHARS) {
      flush(lineEnd);
    }
  }
  if (current.length) flush(content.length);

  if (!sections.length && content.trim().length >= CODEBASE_CHUNK_MIN_CHARS) {
    return lineSplitOversized(content, 0, content.length, "markdown_section", null, "markdown");
  }
  return mergeAdjacentSmall(sections);
}

function chunkFixedWindow(content: string): SemanticChunk[] {
  const spans: SemanticChunk[] = [];
  for (let i = 0; i < content.length; i += CODEBASE_CHUNK_MAX_CHARS) {
    const end = Math.min(i + CODEBASE_CHUNK_MAX_CHARS, content.length);
    const text = content.slice(i, end);
    if (text.trim().length < CODEBASE_CHUNK_MIN_CHARS) continue;
    spans.push({
      text,
      startByte: i,
      endByte: end,
      startLine: lineNumberAt(content, i),
      endLine: lineNumberAt(content, Math.max(i, end - 1)),
      spanType: "fixed_window",
      symbolName: null,
      chunkStrategy: "fallback",
    });
  }
  return spans;
}

function parseWithTreeSitter(ext: string, content: string): SemanticChunk[] | null {
  const parser = getParser(ext);
  if (!parser) return null;
  try {
    const tree = parser.parse(content);
    if (!tree?.rootNode) return null;
    const raw = extractAstSpans(tree.rootNode, content);
    if (!raw.length) return null;
    const withGaps = fillGaps(content, raw);
    return mergeAdjacentSmall(withGaps);
  } catch {
    return null;
  }
}

export function buildSemanticChunks(
  filePath: string,
  content: string
): SemanticChunk[] {
  if (!content.trim()) return [];

  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "md" || ext === "mdx") {
    return chunkMarkdown(content);
  }

  if (ext === "prisma") {
    const prismaChunks = chunkPrisma(content);
    if (prismaChunks.length) return prismaChunks;
  }

  const astChunks = parseWithTreeSitter(ext, content);
  if (astChunks && astChunks.length > 0) {
    return astChunks;
  }

  if (ext === "yaml" || ext === "yml") {
    const yamlChunks = chunkYamlStructure(content);
    if (yamlChunks.length) return yamlChunks;
  }

  if (ext === "graphql") {
    const gqlChunks = chunkGraphqlStructure(content);
    if (gqlChunks.length) return gqlChunks;
  }

  return chunkFixedWindow(content);
}

function formatChunkBody(
  filePath: string,
  chunk: SemanticChunk,
  chunkIndex: number
): string {
  const header = [
    `FILE: ${filePath}`,
    `SPAN: ${chunk.spanType}`,
    chunk.symbolName ? `SYMBOL: ${chunk.symbolName}` : null,
    `LINES: ${chunk.startLine}-${chunk.endLine}`,
    `CHUNK: ${chunkIndex}`,
  ]
    .filter(Boolean)
    .join("\n");
  return `${header}\n${chunk.text}`;
}

export function buildEmbeddingChunks(
  filePath: string,
  content: string,
  intelligence: {
    summary: string | null;
    exports: Array<{ name: string; type: string }>;
    patterns: string[];
  }
): EmbeddingChunkInput[] {
  const headerText = [
    `FILE: ${filePath}`,
    `SUMMARY: ${intelligence.summary ?? "N/A"}`,
    `EXPORTS: ${intelligence.exports.map((item) => item.name).join(", ") || "none"}`,
    `PATTERNS: ${intelligence.patterns.join(", ") || "none"}`,
  ].join("\n");

  const header: EmbeddingChunkInput = {
    text: headerText,
    metadata: {
      spanType: "file_header",
      symbolName: null,
      startLine: null,
      endLine: null,
      chunkStrategy: "header",
      isHeader: true,
    },
  };

  const semantic = buildSemanticChunks(filePath, content);
  const maxSemantic = Math.max(0, CODEBASE_MAX_CHUNKS_PER_FILE - 1);
  const limited = semantic.slice(0, maxSemantic);

  const bodyChunks: EmbeddingChunkInput[] = limited.map((chunk, index) => ({
    text: formatChunkBody(filePath, chunk, index + 1),
    metadata: {
      spanType: chunk.spanType,
      symbolName: chunk.symbolName,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      chunkStrategy: chunk.chunkStrategy,
      isHeader: false,
    },
  }));

  return [header, ...bodyChunks];
}
