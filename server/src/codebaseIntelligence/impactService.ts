import { prisma } from "../db/client";
import { chatCompletionText } from "../llm/openaiCompletion";
import { isOpenAIConfigured } from "../llm/openaiClient";
import { logger } from "../utils/logger";
import { parseImports, resolveImportPath } from "./directoryService";
import { isTestFilePath } from "./fileMetrics";
import { requireRepoScope } from "./repoScope";

const prismaAny = prisma as any;

export type ImpactFileRef = {
  path: string;
  via: string;
  probability: "certain" | "likely" | "possible" | "unlikely";
};

export type ImpactReport = {
  branchName: string;
  changeDescription: string;
  targets: string[];
  directImpact: ImpactFileRef[];
  indirectImpact: ImpactFileRef[];
  testImpact: Array<{ path: string; reason: string }>;
  risk: { level: "low" | "medium" | "high" | "critical"; reasoning: string };
  mapHighlights: {
    changed: string[];
    direct: string[];
    indirect: string[];
    tests: string[];
  };
};

type FileRow = { filePath: string; imports: unknown; summary: string | null };

function buildIncomingIndex(files: FileRow[]): Map<string, Set<string>> {
  const paths = new Set(files.map((f) => f.filePath));
  const incoming = new Map<string, Set<string>>();

  for (const file of files) {
    for (const imp of parseImports(file.imports)) {
      const resolved = resolveImportPath(file.filePath, imp.from, paths);
      if (!resolved) continue;
      if (!incoming.has(resolved)) incoming.set(resolved, new Set());
      incoming.get(resolved)!.add(file.filePath);
    }
  }

  return incoming;
}

function collectDependents(
  targets: Set<string>,
  incoming: Map<string, Set<string>>,
  maxDepth: number
): Map<string, { via: string; depth: number }> {
  const result = new Map<string, { via: string; depth: number }>();

  for (const target of targets) {
    const queue: Array<{ path: string; via: string; depth: number }> = [];
    for (const dep of incoming.get(target) ?? []) {
      queue.push({ path: dep, via: target, depth: 1 });
    }

    while (queue.length) {
      const current = queue.shift()!;
      if (targets.has(current.path)) continue;
      const existing = result.get(current.path);
      if (!existing || current.depth < existing.depth) {
        result.set(current.path, { via: current.via, depth: current.depth });
      }
      if (current.depth >= maxDepth) continue;
      for (const dep of incoming.get(current.path) ?? []) {
        queue.push({ path: dep, via: current.path, depth: current.depth + 1 });
      }
    }
  }

  return result;
}

function findRelatedTests(paths: Set<string>, allPaths: string[]): string[] {
  return allPaths.filter((p) => {
    if (!isTestFilePath(p)) return false;
    const base = p.replace(/\.(test|spec)\.[^/]+$/, "").replace(/__tests__\//, "/");
    for (const target of paths) {
      if (p.includes(target.split("/").pop() ?? "") || base.includes(target)) return true;
    }
    return false;
  });
}

function heuristicRisk(
  directCount: number,
  indirectCount: number,
  testCount: number
): ImpactReport["risk"] {
  if (directCount >= 12 || (directCount >= 6 && testCount === 0)) {
    return {
      level: "critical",
      reasoning: `${directCount} direct dependents with limited test coverage signals high blast radius.`,
    };
  }
  if (directCount >= 5 || indirectCount >= 15) {
    return {
      level: "high",
      reasoning: "Multiple modules depend on the changed files directly or through intermediaries.",
    };
  }
  if (directCount >= 2 || indirectCount >= 6) {
    return {
      level: "medium",
      reasoning: "Some downstream modules may need updates after this change.",
    };
  }
  return {
    level: "low",
    reasoning: `Limited dependency fan-out (${directCount} direct, ${indirectCount} indirect).`,
  };
}

export async function analyzeImpact(input: {
  branchName: string;
  filePaths: string[];
  changeDescription: string;
}): Promise<ImpactReport> {
  const { repoOwner, repoName } = requireRepoScope();
  const targets = [...new Set(input.filePaths.map((p) => p.trim()).filter(Boolean))];
  const changeDescription = input.changeDescription.trim() || "Unspecified change";

  if (!targets.length) {
    throw new Error("At least one file path is required");
  }

  const files: FileRow[] = await prismaAny.codebaseFile.findMany({
    where: { repoOwner, repoName, branchName: input.branchName, isDeleted: false },
    select: { filePath: true, imports: true, summary: true },
  });

  const allPaths = files.map((f) => f.filePath);
  const incoming = buildIncomingIndex(files);
  const targetSet = new Set(targets);
  const dependents = collectDependents(targetSet, incoming, 2);

  const directImpact: ImpactFileRef[] = [];
  const indirectImpact: ImpactFileRef[] = [];

  for (const [path, meta] of dependents) {
    const ref: ImpactFileRef = {
      path,
      via: meta.via,
      probability: meta.depth === 1 ? "certain" : meta.depth === 2 ? "likely" : "possible",
    };
    if (meta.depth === 1) directImpact.push(ref);
    else indirectImpact.push(ref);
  }

  directImpact.sort((a, b) => a.path.localeCompare(b.path));
  indirectImpact.sort((a, b) => a.path.localeCompare(b.path));

  const affectedPaths = new Set([...targets, ...directImpact.map((d) => d.path)]);
  const testPaths = findRelatedTests(affectedPaths, allPaths);
  const testImpact = testPaths.map((path) => ({
    path,
    reason: "Test file likely covers or references the changed module",
  }));

  let risk = heuristicRisk(directImpact.length, indirectImpact.length, testImpact.length);
  let reasoning = risk.reasoning;

  if (isOpenAIConfigured()) {
    try {
      const context = {
        changeDescription,
        targets,
        directImpact: directImpact.slice(0, 25),
        indirectImpact: indirectImpact.slice(0, 25),
        testImpact: testImpact.slice(0, 15),
      };

      const { text } = await chatCompletionText({
        maxTokens: 900,
        system: `You assess codebase change risk from dependency graphs. Return JSON only:
{"risk":{"level":"low"|"medium"|"high"|"critical","reasoning":string},"notes":string}`,
        user: `Analyze this change impact:\n${JSON.stringify(context, null, 2)}`,
      });

      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as {
        risk?: { level?: ImpactReport["risk"]["level"]; reasoning?: string };
      };
      if (parsed.risk?.level && parsed.risk.reasoning) {
        risk = { level: parsed.risk.level, reasoning: parsed.risk.reasoning };
        reasoning = parsed.risk.reasoning;
      }
    } catch (err) {
      logger.warn({ err }, "impact GPT risk assessment failed — using heuristic");
    }
  }

  return {
    branchName: input.branchName,
    changeDescription,
    targets,
    directImpact,
    indirectImpact,
    testImpact,
    risk: { ...risk, reasoning },
    mapHighlights: {
      changed: targets,
      direct: directImpact.map((d) => d.path),
      indirect: indirectImpact.map((d) => d.path),
      tests: testPaths,
    },
  };
}
