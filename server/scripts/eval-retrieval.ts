/**
 * Offline retrieval evaluation: Recall@K, MRR on a golden query set.
 *
 * Usage:
 *   npx tsx scripts/eval-retrieval.ts [--file eval/golden-set.json] [--k 5,10]
 *
 * Golden set format (JSON array):
 *   { "query": "...", "expectedJiraKeys": ["PROJ-1"], "expectedFiles": ["src/foo.ts"] }
 */
import "dotenv/config";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { retrieveSimilarTickets } from "../src/rag/ticketRetrievalService";
import { searchWorkFiles } from "../src/codebaseIntelligence/fileRanker";

interface GoldenCase {
  query: string;
  summary?: string;
  description?: string;
  components?: string[];
  currentJiraKey?: string;
  branchName?: string;
  expectedJiraKeys?: string[];
  expectedFiles?: string[];
}

interface EvalMetrics {
  recallAtK: Record<number, number>;
  mrrTickets: number;
  mrrFiles: number;
  exactMatchRate: number;
  cases: number;
}

function parseKArg(): number[] {
  const kArg = process.argv.find((a) => a.startsWith("--k"));
  if (!kArg) return [5, 10];
  const raw = kArg.includes("=") ? kArg.split("=")[1] : process.argv[process.argv.indexOf(kArg) + 1];
  return (raw ?? "5,10")
    .split(",")
    .map((n) => Number.parseInt(n.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function loadGoldenSet(filePath: string): GoldenCase[] {
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as GoldenCase[];
  if (!Array.isArray(parsed) || !parsed.length) {
    throw new Error(`Golden set empty or invalid: ${filePath}`);
  }
  return parsed;
}

function recallAt(expected: string[], retrieved: string[], k: number): number {
  if (!expected.length) return 1;
  const top = retrieved.slice(0, k);
  return expected.some((e) => top.includes(e)) ? 1 : 0;
}

function mrr(expected: string[], retrieved: string[]): number {
  for (let i = 0; i < retrieved.length; i += 1) {
    if (expected.includes(retrieved[i]!)) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

async function evalCase(testCase: GoldenCase, kValues: number[]): Promise<{
  ticketKeys: string[];
  filePaths: string[];
  metrics: Partial<EvalMetrics>;
}> {
  const summary = testCase.summary ?? testCase.query;
  const description = testCase.description ?? "";
  const currentJiraKey = testCase.currentJiraKey ?? "__EVAL__";

  const ticketHits = await retrieveSimilarTickets({
    summary,
    description,
    components: testCase.components ?? [],
    currentJiraKey,
    includeJql: false,
    includeJiraGraph: false,
  });
  const ticketKeys = ticketHits.map((h) => h.jiraKey);

  let filePaths: string[] = [];
  try {
    const fileHits = await searchWorkFiles({
      query: testCase.query,
      branchName: testCase.branchName ?? "main",
    });
    filePaths = fileHits.map((f) => f.path);
  } catch {
    /* repo scope may be unavailable in CI */
  }

  const expectedKeys = testCase.expectedJiraKeys ?? [];
  const expectedFiles = testCase.expectedFiles ?? [];

  const recallAtK: Record<number, number> = {};
  for (const k of kValues) {
    recallAtK[k] = recallAt(expectedKeys, ticketKeys, k);
  }

  return {
    ticketKeys,
    filePaths,
    metrics: {
      recallAtK,
      mrrTickets: mrr(expectedKeys, ticketKeys),
      mrrFiles: mrr(expectedFiles, filePaths),
      exactMatchRate:
        expectedKeys.length && ticketKeys[0] === expectedKeys[0] ? 1 : 0,
    },
  };
}

async function main() {
  const fileArg = process.argv.find((a) => a.startsWith("--file"));
  const goldenPath = fileArg?.includes("=")
    ? fileArg.split("=")[1]!
    : join(__dirname, "..", "eval", "golden-set.example.json");

  const kValues = parseKArg();
  const cases = loadGoldenSet(goldenPath);

  const aggregate: EvalMetrics = {
    recallAtK: Object.fromEntries(kValues.map((k) => [k, 0])),
    mrrTickets: 0,
    mrrFiles: 0,
    exactMatchRate: 0,
    cases: cases.length,
  };

  const details: Array<Record<string, unknown>> = [];

  for (const testCase of cases) {
    const result = await evalCase(testCase, kValues);
    for (const k of kValues) {
      aggregate.recallAtK[k] = (aggregate.recallAtK[k] ?? 0) + (result.metrics.recallAtK?.[k] ?? 0);
    }
    aggregate.mrrTickets += result.metrics.mrrTickets ?? 0;
    aggregate.mrrFiles += result.metrics.mrrFiles ?? 0;
    aggregate.exactMatchRate += result.metrics.exactMatchRate ?? 0;

    details.push({
      query: testCase.query,
      expectedJiraKeys: testCase.expectedJiraKeys,
      expectedFiles: testCase.expectedFiles,
      retrievedJiraKeys: result.ticketKeys.slice(0, 10),
      retrievedFiles: result.filePaths.slice(0, 10),
      ...result.metrics,
    });
  }

  for (const k of kValues) {
    aggregate.recallAtK[k] = (aggregate.recallAtK[k] ?? 0) / cases.length;
  }
  aggregate.mrrTickets /= cases.length;
  aggregate.mrrFiles /= cases.length;
  aggregate.exactMatchRate /= cases.length;

  const outDir = join(__dirname, "..", "eval", "results");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(outDir, `eval-${stamp}.json`);
  const report = { generatedAt: new Date().toISOString(), kValues, aggregate, details };
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("Retrieval eval complete");
  console.log(JSON.stringify(aggregate, null, 2));
  console.log(`Report: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
