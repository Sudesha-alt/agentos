import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../db/client";
import { getOpenAIClient } from "../llm/openaiClient";
import { githubClient } from "../integrations/githubClient";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import { codebaseVectorStore } from "./vectorStore";
import { visualizationCache } from "./visualizationCache";

const claude = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const REPO_OWNER = process.env.GITHUB_REPO_OWNER ?? "";
const REPO_NAME = process.env.GITHUB_REPO_NAME ?? "";

const SKIP_PATTERNS = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  ".next/",
  "coverage/",
  ".nyc_output/",
  "vendor/",
  "__pycache__/",
];

const SKIP_SUFFIXES = [
  ".env",
  ".env.local",
  ".env.production",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".mp4",
  ".mp3",
  ".pdf",
  ".zip",
  ".tar",
  ".min.js",
  ".min.css",
];

const CODE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "py",
  "go",
  "rb",
  "java",
  "cs",
  "php",
  "rs",
  "swift",
  "kt",
  "sql",
  "prisma",
  "graphql",
  "json",
  "yaml",
  "yml",
  "md",
  "mdx",
]);

const MAX_FILE_SIZE = 100 * 1024;
const EMBEDDING_MODEL = "text-embedding-3-small";
const prismaAny = prisma as any;

export interface IndexRunResult {
  filesIndexed: number;
  filesUpdated: number;
  filesSkipped: number;
  filesDeleted: number;
  durationMs: number;
}

function assertRepoContext(): void {
  if (!REPO_OWNER || !REPO_NAME) {
    throw new Error("Missing GITHUB_REPO_OWNER or GITHUB_REPO_NAME");
  }
}

export async function runFullIndex(branchName: string): Promise<IndexRunResult> {
  assertRepoContext();
  const startedAt = Date.now();

  const run = await prismaAny.codebaseIndexRun.create({
    data: {
      repoOwner: REPO_OWNER,
      repoName: REPO_NAME,
      branchName,
      runType: "full",
      status: "running",
      triggerType: "manual",
    },
  });

  try {
    const tree = await githubClient.getRepoTree(branchName);
    const candidates = tree.filter(
      (item) =>
        item.type === "blob" &&
        !shouldSkip(item.path) &&
        (item.size ?? 0) <= MAX_FILE_SIZE
    );

    let filesIndexed = 0;
    let filesUpdated = 0;
    let filesSkipped = 0;

    for (const item of candidates) {
      const result = await indexFile(item.path, branchName).catch((err) => {
        logger.warn({ filePath: item.path, err }, "full index file failed");
        return "unchanged" as const;
      });
      if (result === "indexed") filesIndexed += 1;
      else if (result === "updated") filesUpdated += 1;
      else filesSkipped += 1;
    }

    const filesDeleted = await markDeletedFiles(
      candidates.map((item) => item.path),
      branchName
    );

    await prismaAny.codebaseIndexRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        filesIndexed,
        filesUpdated,
        filesDeleted,
        completedAt: new Date(),
      },
    });

    await visualizationCache.refresh(branchName).catch((err) => {
      logger.warn({ err, branchName }, "visualization refresh after full index failed");
    });

    return {
      filesIndexed,
      filesUpdated,
      filesSkipped,
      filesDeleted,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    await prismaAny.codebaseIndexRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

export async function runIncrementalIndex(input: {
  branchName: string;
  changedFiles: string[];
  deletedFiles: string[];
  commitSha: string;
  triggerType: "webhook" | "manual";
}): Promise<IndexRunResult> {
  assertRepoContext();
  const startedAt = Date.now();
  const run = await prismaAny.codebaseIndexRun.create({
    data: {
      repoOwner: REPO_OWNER,
      repoName: REPO_NAME,
      branchName: input.branchName,
      runType: "incremental",
      status: "running",
      triggerType: input.triggerType,
      triggerSha: input.commitSha,
    },
  });

  let filesIndexed = 0;
  let filesUpdated = 0;
  let filesDeleted = 0;

  try {
    for (const filePath of input.changedFiles.filter((path) => !shouldSkip(path))) {
      const result = await indexFile(filePath, input.branchName).catch((err) => {
        logger.warn({ filePath, err }, "incremental index file failed");
        return "unchanged" as const;
      });
      if (result === "indexed") filesIndexed += 1;
      else if (result === "updated") filesUpdated += 1;
    }

    for (const filePath of input.deletedFiles) {
      await removeFileFromIndex(filePath, input.branchName);
      filesDeleted += 1;
    }

    await prismaAny.codebaseIndexRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        filesIndexed,
        filesUpdated,
        filesDeleted,
        completedAt: new Date(),
      },
    });

    await visualizationCache.refresh(input.branchName).catch((err) => {
      logger.warn({ err, branchName: input.branchName }, "viz refresh after incremental index failed");
    });

    return {
      filesIndexed,
      filesUpdated,
      filesSkipped: 0,
      filesDeleted,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    await prismaAny.codebaseIndexRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

async function indexFile(
  filePath: string,
  branchName: string
): Promise<"indexed" | "updated" | "unchanged"> {
  const file = await githubClient.getFileContent(filePath, branchName);
  const contentHash = sha256(file.content);

  const existing = await prismaAny.codebaseFile.findUnique({
    where: {
      repoOwner_repoName_filePath_branchName: {
        repoOwner: REPO_OWNER,
        repoName: REPO_NAME,
        filePath,
        branchName,
      },
    },
  });

  if (existing?.contentHash === contentHash) return "unchanged";

  const language = detectLanguage(filePath);
  const intelligence = await extractFileIntelligence(file.content, filePath, language);
  const now = new Date();

  await prismaAny.codebaseFile.upsert({
    where: {
      repoOwner_repoName_filePath_branchName: {
        repoOwner: REPO_OWNER,
        repoName: REPO_NAME,
        filePath,
        branchName,
      },
    },
    create: {
      repoOwner: REPO_OWNER,
      repoName: REPO_NAME,
      filePath,
      branchName,
      content: file.content,
      contentHash,
      size: file.size,
      language,
      summary: intelligence.summary,
      exports: intelligence.exports,
      imports: intelligence.imports,
      patterns: intelligence.patterns,
      lastCommitSha: file.sha,
      indexedAt: now,
      isDeleted: false,
    },
    update: {
      content: file.content,
      contentHash,
      size: file.size,
      language,
      summary: intelligence.summary,
      exports: intelligence.exports,
      imports: intelligence.imports,
      patterns: intelligence.patterns,
      lastCommitSha: file.sha,
      isDeleted: false,
    },
  });

  await updateFileEmbeddings(filePath, branchName, file.content, intelligence, language);
  return existing ? "updated" : "indexed";
}

async function extractFileIntelligence(
  content: string,
  filePath: string,
  language: string
): Promise<{
  summary: string | null;
  exports: Array<{ name: string; type: string }>;
  imports: Array<{ from: string; items: string[] }>;
  patterns: string[];
}> {
  if (content.length < 200 || !claude) {
    return regexIntelligence(content, filePath, language);
  }

  const analysisContent =
    content.length > 8_000 ? `${content.slice(0, 8_000)}\n\n[TRUNCATED]` : content;

  try {
    const response = await withRetry(
      () =>
        claude.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 900,
          system:
            "Extract structured code intelligence. Return JSON only, no markdown.",
          messages: [
            {
              role: "user",
              content: `File: ${filePath}\nLanguage: ${language}\n\n${analysisContent}\n\nReturn JSON: {"summary":string,"exports":[{"name":string,"type":string}],"imports":[{"from":string,"items":[string]}],"patterns":[string]}`,
            },
          ],
        }),
      { maxAttempts: 2, baseDelayMs: 500, maxDelayMs: 3000 }
    );

    const text = response.content.find((item) => item.type === "text");
    const parsed = JSON.parse(
      (text?.text ?? "").replace(/```json/gi, "").replace(/```/g, "").trim()
    ) as {
      summary?: string;
      exports?: Array<{ name: string; type: string }>;
      imports?: Array<{ from: string; items: string[] }>;
      patterns?: string[];
    };

    return {
      summary: parsed.summary ?? `${language} file: ${filePath}`,
      exports: parsed.exports ?? [],
      imports: parsed.imports ?? [],
      patterns: parsed.patterns ?? [],
    };
  } catch {
    return regexIntelligence(content, filePath, language);
  }
}

function regexIntelligence(content: string, filePath: string, language: string) {
  const exports: Array<{ name: string; type: string }> = [];
  const imports: Array<{ from: string; items: string[] }> = [];
  const patterns: string[] = [];

  const exportMatches = content.matchAll(
    /export\s+(?:class|function|const|type|interface)\s+([A-Za-z0-9_]+)/g
  );
  for (const match of exportMatches) {
    exports.push({ name: match[1], type: "symbol" });
  }

  const importMatches = content.matchAll(
    /import\s+(.+?)\s+from\s+["'](.+?)["']/g
  );
  for (const match of importMatches) {
    imports.push({ from: match[2], items: [match[1]] });
  }

  if (/router\.|express\./i.test(content)) patterns.push("api-route");
  if (/prisma|select \*|from\s+\w+/i.test(content)) patterns.push("database-query");
  if (/auth|jwt|session/i.test(content)) patterns.push("auth");
  if (/test\(|describe\(/i.test(content)) patterns.push("test");

  return {
    summary: `${language} file: ${filePath}`,
    exports,
    imports,
    patterns: [...new Set(patterns)],
  };
}

async function updateFileEmbeddings(
  filePath: string,
  branchName: string,
  content: string,
  intelligence: {
    summary: string | null;
    exports: Array<{ name: string; type: string }>;
    patterns: string[];
  },
  language: string
): Promise<void> {
  const chunks = buildEmbeddingTexts(filePath, content, intelligence).slice(0, 16);
  const rows = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const embeddingResponse = await withRetry(
      () =>
        getOpenAIClient().embeddings.create({
          model: EMBEDDING_MODEL,
          input: chunk.slice(0, 8_000),
        }),
      { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 4000 }
    );

    rows.push({
      filePath,
      repoOwner: REPO_OWNER,
      repoName: REPO_NAME,
      branchName,
      chunkIndex: i,
      chunkContent: chunk,
      embedding: embeddingResponse.data[0].embedding,
      metadata: {
        filePath,
        language,
        summary: intelligence.summary,
        patterns: intelligence.patterns,
        chunkIndex: i,
        totalChunks: chunks.length,
      },
      contentHash: sha256(chunk),
    });
  }

  await codebaseVectorStore.replaceFileEmbeddings(
    REPO_OWNER,
    REPO_NAME,
    branchName,
    filePath,
    rows
  );
}

function buildEmbeddingTexts(
  filePath: string,
  content: string,
  intelligence: {
    summary: string | null;
    exports: Array<{ name: string; type: string }>;
    patterns: string[];
  }
): string[] {
  const header = [
    `FILE: ${filePath}`,
    `SUMMARY: ${intelligence.summary ?? "N/A"}`,
    `EXPORTS: ${intelligence.exports.map((item) => item.name).join(", ") || "none"}`,
    `PATTERNS: ${intelligence.patterns.join(", ") || "none"}`,
  ].join("\n");

  const chunkSize = 1800;
  const chunks = [header];
  for (let i = 0; i < content.length; i += chunkSize) {
    chunks.push(`FILE: ${filePath}\nCHUNK ${Math.floor(i / chunkSize)}\n${content.slice(i, i + chunkSize)}`);
  }
  return chunks;
}

async function markDeletedFiles(activeFilePaths: string[], branchName: string): Promise<number> {
  const result = await prismaAny.codebaseFile.updateMany({
    where: {
      repoOwner: REPO_OWNER,
      repoName: REPO_NAME,
      branchName,
      filePath: { notIn: activeFilePaths },
      isDeleted: false,
    },
    data: { isDeleted: true },
  });
  return result.count;
}

async function removeFileFromIndex(filePath: string, branchName: string): Promise<void> {
  await visualizationCache.onFileRemoved(branchName, filePath).catch(() => undefined);
  await prismaAny.codebaseFile.updateMany({
    where: {
      repoOwner: REPO_OWNER,
      repoName: REPO_NAME,
      branchName,
      filePath,
    },
    data: { isDeleted: true },
  });
  await codebaseVectorStore.deleteFile(REPO_OWNER, REPO_NAME, branchName, filePath);
}

function shouldSkip(path: string): boolean {
  return SKIP_PATTERNS.some((pattern) => path.includes(pattern)) ||
    SKIP_SUFFIXES.some((suffix) => path.endsWith(suffix));
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (!ext) return "text";
  return CODE_EXTENSIONS.has(ext) ? ext : "text";
}
