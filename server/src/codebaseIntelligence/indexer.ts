import { createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "../db/client";
import {
  createChatCompletion,
  getOpenAISummaryModel,
  isOpenAIConfigured,
} from "../llm/openaiClient";
import { createEmbeddingVectors } from "../llm/embeddings";
import { gitClient } from "../integrations/gitProvider";
import { getRepoContext } from "../git-integration/gitCredentialsStore";
import { resolveRepoIndexBranch } from "../git-integration/resolveRepoBranch";
import { getGitCredentials } from "../git-integration/gitCredentialsStore";
import { fetchFilesAtRef } from "../integrations/git/githubGraphqlClient";
import { getActiveOrganizationId } from "../organization/context";
import { requireActiveOrganizationId } from "../organization/orgScope";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import { buildEmbeddingMetadata } from "../rag/embeddingMetadata";
import { prepareTextForEmbedding } from "../rag/chunking";
import { codebaseVectorStore } from "./vectorStore";
import { visualizationCache } from "./visualizationCache";
import { generateKnowledge } from "./knowledgeService";
import { generateTour } from "./tourService";
import { recordOversizedSkipped } from "./indexSkipStats";
import { MAX_HEADER_ONLY_FILE_SIZE } from "./retrievalConfig";
import { buildEmbeddingChunks } from "./astChunker";
import type { LayoutFileInput } from "./layoutComputer";

/** Index runs carry org id explicitly so concurrent HTTP requests cannot clear scope. */
const indexOrganizationContext = new AsyncLocalStorage<string>();

function resolveIndexOrganizationId(explicit?: string): string {
  const fromScope = indexOrganizationContext.getStore();
  if (fromScope) return fromScope;
  if (explicit) return explicit;
  const fromRequest = getActiveOrganizationId();
  if (fromRequest) return fromRequest;
  return requireActiveOrganizationId();
}

function repoIds(organizationId?: string) {
  const ctx = getRepoContext();
  const orgId = resolveIndexOrganizationId(organizationId);
  return { organizationId: orgId, repoOwner: ctx.workspace, repoName: ctx.repoSlug };
}

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
const prismaAny = prisma as any;

export interface IndexRunResult {
  filesIndexed: number;
  filesUpdated: number;
  filesSkipped: number;
  filesDeleted: number;
  durationMs: number;
}

function assertRepoContext(organizationId?: string): {
  organizationId: string;
  repoOwner: string;
  repoName: string;
} {
  return repoIds(organizationId);
}

export async function runFullIndex(
  branchName: string,
  options?: {
    runId?: string;
    triggerType?: "manual" | "webhook" | "pr_merge";
    organizationId?: string;
  }
): Promise<IndexRunResult> {
  const organizationId = options?.organizationId ?? getActiveOrganizationId();
  if (!organizationId) {
    throw new Error("organization_context_required");
  }

  return indexOrganizationContext.run(organizationId, () =>
    runFullIndexInner(branchName, { ...options, organizationId })
  );
}

async function runFullIndexInner(
  branchName: string,
  options: {
    runId?: string;
    triggerType?: "manual" | "webhook" | "pr_merge";
    organizationId: string;
  }
): Promise<IndexRunResult> {
  const resolvedBranch = await resolveRepoIndexBranch(branchName);
  branchName = resolvedBranch;
  const { repoOwner, repoName } = assertRepoContext(options.organizationId);
  const startedAt = Date.now();

  const prismaAny = prisma as any;
  let runId = options?.runId;
  if (runId) {
    await prismaAny.codebaseIndexRun.update({
      where: { id: runId },
      data: {
        status: "running",
        triggerType: options?.triggerType ?? "manual",
        branchName: resolvedBranch,
      },
    });
  } else {
    const run = await prismaAny.codebaseIndexRun.create({
      data: {
        repoOwner: repoOwner,
        repoName: repoName,
        branchName,
        runType: "full",
        status: "running",
        triggerType: options?.triggerType ?? "manual",
      },
    });
    runId = run.id;
  }

  try {
    const tree = await gitClient.getRepoTree(branchName);
    const blobs = tree.filter(
      (item) => item.type === "blob" && !shouldSkip(item.path)
    );
    const candidates = blobs.filter((item) => (item.size ?? 0) <= MAX_FILE_SIZE);
    const headerOnlyCandidates = blobs.filter(
      (item) =>
        (item.size ?? 0) > MAX_FILE_SIZE &&
        (item.size ?? 0) <= MAX_HEADER_ONLY_FILE_SIZE
    );
    const oversizedSkipped = blobs.filter(
      (item) => (item.size ?? 0) > MAX_HEADER_ONLY_FILE_SIZE
    ).length;
    recordOversizedSkipped(oversizedSkipped);

    const totalWork = candidates.length + headerOnlyCandidates.length;

    await prismaAny.codebaseIndexRun.update({
      where: { id: runId },
      data: { filesTotal: totalWork, filesProcessed: 0 },
    });

    let filesIndexed = 0;
    let filesUpdated = 0;
    let filesSkipped = 0;
    let filesProcessed = 0;

    for (const item of candidates) {
      const result = await indexFile(item.path, branchName).catch((err) => {
        logger.warn({ filePath: item.path, err }, "full index file failed");
        return "unchanged" as const;
      });
      if (result === "indexed") filesIndexed += 1;
      else if (result === "updated") filesUpdated += 1;
      else filesSkipped += 1;
      filesProcessed += 1;

      if (filesProcessed % 5 === 0 || filesProcessed === totalWork) {
        await prismaAny.codebaseIndexRun.update({
          where: { id: runId },
          data: {
            filesProcessed,
            filesIndexed,
            filesUpdated,
          },
        });
      }
    }

    for (const item of headerOnlyCandidates) {
      const result = await indexFileHeaderOnly(item.path, branchName).catch((err) => {
        logger.warn({ filePath: item.path, err }, "header-only index failed");
        return "unchanged" as const;
      });
      if (result === "indexed") filesIndexed += 1;
      else if (result === "updated") filesUpdated += 1;
      else filesSkipped += 1;
      filesProcessed += 1;

      if (filesProcessed % 5 === 0 || filesProcessed === totalWork) {
        await prismaAny.codebaseIndexRun.update({
          where: { id: runId },
          data: {
            filesProcessed,
            filesIndexed,
            filesUpdated,
          },
        });
      }
    }

    const filesDeleted = await markDeletedFiles(
      [...candidates, ...headerOnlyCandidates].map((item) => item.path),
      branchName
    );

    await prismaAny.codebaseIndexRun.update({
      where: { id: runId },
      data: {
        status: "completed",
        filesProcessed: totalWork,
        filesIndexed,
        filesUpdated,
        filesDeleted,
        completedAt: new Date(),
      },
    });

    await visualizationCache.refresh(branchName).catch((err) => {
      logger.warn({ err, branchName }, "visualization refresh after full index failed");
    });

    void generateTour(branchName)
      .then(() => generateKnowledge(branchName))
      .catch((err) => {
        logger.warn({ err, branchName }, "tour/knowledge generation after full index failed");
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
      where: { id: runId },
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
  runId?: string;
  batchIndex?: number;
  batchTotal?: number;
  organizationId?: string;
}): Promise<IndexRunResult> {
  const organizationId = input.organizationId ?? getActiveOrganizationId();
  if (!organizationId) {
    throw new Error("organization_context_required");
  }

  return indexOrganizationContext.run(organizationId, () =>
    runIncrementalIndexInner({ ...input, organizationId })
  );
}

async function runIncrementalIndexInner(input: {
  branchName: string;
  changedFiles: string[];
  deletedFiles: string[];
  commitSha: string;
  triggerType: "webhook" | "manual";
  runId?: string;
  batchIndex?: number;
  batchTotal?: number;
  organizationId: string;
}): Promise<IndexRunResult> {
  const { repoOwner, repoName } = assertRepoContext(input.organizationId);
  const startedAt = Date.now();
  const prismaAny = prisma as any;

  const pathsToIndex = input.changedFiles.filter((path) => !shouldSkip(path));
  const totalWork = pathsToIndex.length + input.deletedFiles.length;

  let runId = input.runId;
  if (runId) {
    await prismaAny.codebaseIndexRun.update({
      where: { id: runId },
      data: {
        status: "running",
        triggerSha: input.commitSha,
        triggerType: input.triggerType,
        filesTotal: totalWork,
        filesProcessed: 0,
      },
    });
  } else {
    const run = await prismaAny.codebaseIndexRun.create({
      data: {
        repoOwner,
        repoName,
        branchName: input.branchName,
        runType: "incremental",
        status: "running",
        triggerType: input.triggerType,
        triggerSha: input.commitSha,
        filesTotal: totalWork,
        filesProcessed: 0,
      },
    });
    runId = run.id;
  }

  let filesIndexed = 0;
  let filesUpdated = 0;
  let filesSkipped = 0;
  let filesDeleted = 0;
  let filesProcessed = 0;

  const prefetched = await prefetchChangedFiles(pathsToIndex, input.branchName);

  try {
    for (const filePath of pathsToIndex) {
      const prefetchedFile = prefetched.get(filePath);
      const result = await indexFile(filePath, input.branchName, prefetchedFile).catch((err) => {
        logger.warn({ filePath, err }, "incremental index file failed");
        return "unchanged" as const;
      });
      if (result === "indexed") filesIndexed += 1;
      else if (result === "updated") filesUpdated += 1;
      else filesSkipped += 1;
      filesProcessed += 1;

      if (filesProcessed % 3 === 0 || filesProcessed === totalWork) {
        await prismaAny.codebaseIndexRun.update({
          where: { id: runId },
          data: { filesProcessed, filesIndexed, filesUpdated, filesDeleted },
        });
      }
    }

    for (const filePath of input.deletedFiles) {
      await removeFileFromIndex(filePath, input.branchName);
      filesDeleted += 1;
      filesProcessed += 1;
    }

    await prismaAny.codebaseIndexRun.update({
      where: { id: runId },
      data: {
        status: "completed",
        filesIndexed,
        filesUpdated,
        filesDeleted,
        filesProcessed: totalWork,
        completedAt: new Date(),
      },
    });

    if ((input.batchIndex ?? 0) === (input.batchTotal ?? 1) - 1) {
      await visualizationCache.refresh(input.branchName).catch((err) => {
        logger.warn({ err, branchName: input.branchName }, "viz refresh after incremental index failed");
      });
    }

    logger.info(
      {
        runId,
        branchName: input.branchName,
        filesIndexed,
        filesUpdated,
        filesSkipped,
        filesDeleted,
        batchIndex: input.batchIndex,
        batchTotal: input.batchTotal,
      },
      "incremental index completed"
    );

    return {
      filesIndexed,
      filesUpdated,
      filesSkipped,
      filesDeleted,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    await prismaAny.codebaseIndexRun.update({
      where: { id: runId },
      data: {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

async function prefetchChangedFiles(
  paths: string[],
  branchName: string
): Promise<Map<string, { path: string; sha: string; size: number; content: string }>> {
  const map = new Map<string, { path: string; sha: string; size: number; content: string }>();
  if (paths.length < 2) return map;

  try {
    const creds = getGitCredentials();
    if (creds.provider !== "github") return map;

    const ctx = getRepoContext();
    const blobs = await fetchFilesAtRef({
      owner: ctx.workspace,
      repo: ctx.repoSlug,
      ref: branchName,
      paths,
    });

    for (const [path, blob] of blobs) {
      map.set(path, {
        path,
        sha: blob.oid,
        size: blob.byteSize,
        content: blob.content,
      });
    }
  } catch (err) {
    logger.debug({ err }, "GraphQL prefetch skipped — falling back to REST");
  }

  return map;
}

async function indexFile(
  filePath: string,
  branchName: string,
  prefetched?: { path: string; sha: string; size: number; content: string }
): Promise<"indexed" | "updated" | "unchanged"> {
  const file =
    prefetched ??
    (await gitClient.getFileContent(filePath, branchName));
  if (file.size > MAX_FILE_SIZE) {
    if (file.size <= MAX_HEADER_ONLY_FILE_SIZE) {
      return indexFileHeaderOnly(filePath, branchName, file);
    }
    return "unchanged";
  }
  return indexFileContent(filePath, branchName, file);
}

async function indexFileHeaderOnly(
  filePath: string,
  branchName: string,
  file?: Awaited<ReturnType<typeof gitClient.getFileContent>>
): Promise<"indexed" | "updated" | "unchanged"> {
  const resolved = file ?? (await gitClient.getFileContent(filePath, branchName));
  const headerContent = resolved.content.slice(0, 8000);
  return indexFileContent(
    filePath,
    branchName,
    { ...resolved, content: headerContent },
    { headerOnly: true }
  );
}

async function indexFileContent(
  filePath: string,
  branchName: string,
  file: Awaited<ReturnType<typeof gitClient.getFileContent>>,
  opts?: { headerOnly?: boolean }
): Promise<"indexed" | "updated" | "unchanged"> {
  const { organizationId, repoOwner, repoName } = repoIds();
  const contentHash = sha256(opts?.headerOnly ? `header:${file.content}` : file.content);

  const existing = await prismaAny.codebaseFile.findUnique({
    where: {
      organizationId_repoOwner_repoName_filePath_branchName: {
        organizationId,
        repoOwner,
        repoName,
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
      organizationId_repoOwner_repoName_filePath_branchName: {
        organizationId,
        repoOwner,
        repoName,
        filePath,
        branchName,
      },
    },
    create: {
      organizationId,
      repoOwner,
      repoName,
      filePath,
      branchName,
      content: opts?.headerOnly ? null : file.content,
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
      content: opts?.headerOnly ? null : file.content,
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

  try {
    await updateFileEmbeddings(filePath, branchName, file.content, intelligence, language);
  } catch (err) {
    logger.warn(
      { filePath, branchName, err },
      "embedding failed — file metadata saved; semantic search may be partial for this file"
    );
  }

  const layoutInput: LayoutFileInput = {
    filePath,
    size: file.size,
    language,
    summary: intelligence.summary,
    patterns: intelligence.patterns,
    imports: intelligence.imports,
    exports: intelligence.exports,
    lastCommitAt: existing?.lastCommitAt ?? null,
    lastAuthor: existing?.lastAuthor ?? null,
    lastCommitMsg: existing?.lastCommitMsg ?? null,
  };
  await visualizationCache.onFileIndexed(branchName, filePath, layoutInput).catch((err) => {
    logger.warn({ filePath, branchName, err }, "viz delta after file index failed");
  });

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
  if (content.length < 200 || !isOpenAIConfigured()) {
    return regexIntelligence(content, filePath, language);
  }

  const analysisContent =
    content.length > 8_000 ? `${content.slice(0, 8_000)}\n\n[TRUNCATED]` : content;

  try {
    const summaryModel = getOpenAISummaryModel();
    const response = await withRetry(
      () =>
        createChatCompletion({
          model: summaryModel,
          maxTokens: 900,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Extract structured code intelligence. Return JSON only with keys summary, exports, imports, patterns.",
            },
            {
              role: "user",
              content: `File: ${filePath}\nLanguage: ${language}\n\n${analysisContent}\n\nReturn JSON: {"summary":string,"exports":[{"name":string,"type":string}],"imports":[{"from":string,"items":[string]}],"patterns":[string]}`,
            },
          ],
        }),
      {
        maxAttempts: 2,
        baseDelayMs: 500,
        maxDelayMs: 3000,
        context: { operation: "file-intelligence", filePath },
      }
    );

    const text = response.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(
      text.replace(/```json/gi, "").replace(/```/g, "").trim()
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

async function embedFileChunks(
  texts: string[],
  filePath: string,
  branchName: string
): Promise<number[][]> {
  const vectors: number[][] = new Array(texts.length);
  const subBatchSize = 4;
  const subBatchDelayMs = 600;

  for (let start = 0; start < texts.length; start += subBatchSize) {
    if (start > 0) {
      await new Promise((resolve) => setTimeout(resolve, subBatchDelayMs));
    }
    const end = Math.min(start + subBatchSize, texts.length);
    const batch = texts.slice(start, end);

    try {
      const batchVectors = await createEmbeddingVectors(batch, {
        filePath,
        branchName,
        chunkRange: `${start}-${end - 1}`,
      });
      batchVectors.forEach((vector, offset) => {
        vectors[start + offset] = vector;
      });
    } catch (batchErr) {
      logger.warn(
        { filePath, branchName, chunkRange: `${start}-${end - 1}`, err: batchErr },
        "embedding sub-batch failed — retrying chunks individually"
      );
      for (let i = start; i < end; i += 1) {
        if (i > start) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        try {
          const [vector] = await createEmbeddingVectors([texts[i]!], {
            filePath,
            branchName,
            chunkIndex: i,
          });
          if (vector) vectors[i] = vector;
        } catch (err) {
          logger.warn(
            { filePath, branchName, chunkIndex: i, err },
            "embedding chunk failed after retries — skipping chunk"
          );
        }
      }
    }
  }

  return vectors;
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
  if (!isOpenAIConfigured()) {
    logger.warn({ filePath, branchName }, "skipping embeddings — OPENAI_API_KEY not set");
    return;
  }

  const { organizationId, repoOwner, repoName } = repoIds();
  const chunks = buildEmbeddingChunks(filePath, content, intelligence);
  const texts = chunks.map((chunk) => prepareTextForEmbedding(chunk.text));
  const rows = [];
  const vectors = await embedFileChunks(texts, filePath, branchName);

  for (let i = 0; i < chunks.length; i += 1) {
    const vector = vectors[i];
    if (!vector) continue;
    const chunk = chunks[i]!;
    rows.push({
      filePath,
      repoOwner: repoOwner,
      repoName: repoName,
      branchName,
      organizationId,
      chunkIndex: i,
      chunkContent: chunk.text,
      embedding: vector,
      metadata: buildEmbeddingMetadata({
        filePath,
        language,
        summary: intelligence.summary,
        patterns: intelligence.patterns,
        chunkIndex: i,
        totalChunks: chunks.length,
        spanType: chunk.metadata.spanType,
        symbolName: chunk.metadata.symbolName,
        startLine: chunk.metadata.startLine,
        endLine: chunk.metadata.endLine,
        chunkStrategy: chunk.metadata.chunkStrategy,
        isHeader: chunk.metadata.isHeader,
      }),
      contentHash: sha256(chunk.text),
    });
  }

  if (!rows.length) {
    logger.warn({ filePath, branchName }, "no embedding chunks succeeded for file");
    return;
  }

  try {
    await codebaseVectorStore.replaceFileEmbeddings(
      organizationId,
      repoOwner,
      repoName,
      branchName,
      filePath,
      rows
    );
  } catch (err) {
    logger.warn(
      { err, filePath, branchName },
      "embedding write failed — file metadata still indexed; check codebase_embeddings table in Supabase"
    );
  }
}

async function markDeletedFiles(activeFilePaths: string[], branchName: string): Promise<number> {
  const { repoOwner, repoName } = repoIds();
  const result = await prismaAny.codebaseFile.updateMany({
    where: {
      repoOwner: repoOwner,
      repoName: repoName,
      branchName,
      filePath: { notIn: activeFilePaths },
      isDeleted: false,
    },
    data: { isDeleted: true },
  });
  return result.count;
}

async function removeFileFromIndex(filePath: string, branchName: string): Promise<void> {
  const { organizationId, repoOwner, repoName } = repoIds();
  await visualizationCache.onFileRemoved(branchName, filePath).catch(() => undefined);
  await prismaAny.codebaseFile.updateMany({
    where: {
      repoOwner: repoOwner,
      repoName: repoName,
      branchName,
      filePath,
    },
    data: { isDeleted: true },
  });
  await codebaseVectorStore.deleteFile(organizationId, repoOwner, repoName, branchName, filePath);
}

function parseIncludeGlobs(): string[] | null {
  const raw = process.env.CODEBASE_INDEX_INCLUDE_GLOBS?.trim();
  if (!raw) return null;
  const globs = raw.split(",").map((g) => g.trim()).filter(Boolean);
  return globs.length ? globs : null;
}

function globToRegExp(glob: string): RegExp {
  const normalized = glob.replace(/\\/g, "/").replace(/^\.\//, "");
  const pattern = normalized
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "§§")
    .replace(/\*/g, "[^/]*")
    .replace(/§§/g, ".*");
  return new RegExp(`^${pattern}$`);
}

function matchesIncludeGlob(path: string, globs: string[]): boolean {
  const normalized = path.replace(/\\/g, "/");
  return globs.some((glob) => globToRegExp(glob).test(normalized));
}

function shouldSkip(path: string): boolean {
  if (SKIP_PATTERNS.some((pattern) => path.includes(pattern))) return true;
  if (SKIP_SUFFIXES.some((suffix) => path.endsWith(suffix))) return true;
  const includeGlobs = parseIncludeGlobs();
  if (includeGlobs && !matchesIncludeGlob(path, includeGlobs)) return true;
  return false;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (!ext) return "text";
  return CODE_EXTENSIONS.has(ext) ? ext : "text";
}
