import { prisma } from "../db/client";
import { chatCompletionText } from "../llm/openaiCompletion";
import { isOpenAIConfigured } from "../llm/openaiClient";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import { getCodebaseInsights } from "./insightsService";
import {
  buildQuickReference,
  buildTourSteps,
  type VisualizationDistrict,
  type VisualizationNode,
} from "./layoutComputer";
import { resolveRepoScope } from "./repoScope";
import { visualizationCache } from "./visualizationCache";

const prismaAny = prisma as any;

export type TourStep = {
  id: string;
  title: string;
  narration: string;
  focusPath: string | null;
  zoomLevel: "galaxy" | "district" | "file";
  highlightPaths?: string[];
  spotlights?: Array<{ path: string; summary: string }>;
  quiz?: { prompt: string; correctPathPrefix: string; explanation: string };
};

export type CodebaseTour = {
  branchName: string;
  steps: TourStep[];
  cheatSheet: Array<{ question: string; pathPrefix: string; highlightPaths?: string[] }>;
  generatedAt: string;
  source: "openai" | "heuristic" | "cache";
};

function isTourLlmConfigured(): boolean {
  return isOpenAIConfigured();
}

function parsePatterns(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is string => typeof p === "string");
}

function countImports(imports: unknown): number {
  if (!Array.isArray(imports)) return 0;
  return imports.length;
}

async function loadTopFiles(branchName: string, limit = 30) {
  const scope = resolveRepoScope();
  if (!scope) return [];

  const rows = await prismaAny.codebaseFile.findMany({
    where: {
      repoOwner: scope.repoOwner,
      repoName: scope.repoName,
      branchName,
      isDeleted: false,
    },
    select: {
      filePath: true,
      summary: true,
      patterns: true,
      imports: true,
    },
    take: 500,
  });

  return rows
    .map((row: { filePath: string; summary: string | null; patterns: unknown; imports: unknown }) => ({
      path: row.filePath,
      summary: row.summary?.slice(0, 200) ?? "",
      patterns: parsePatterns(row.patterns),
      importCount: countImports(row.imports),
    }))
    .sort(
      (
        a: { importCount: number },
        b: { importCount: number }
      ) => b.importCount - a.importCount
    )
    .slice(0, limit);
}

function buildHeuristicTour(
  branchName: string,
  districts: VisualizationDistrict[],
  nodes: VisualizationNode[]
): CodebaseTour {
  const steps = buildTourSteps(districts, nodes, branchName) as TourStep[];
  const cheatSheet = buildQuickReference(districts);
  return {
    branchName,
    steps,
    cheatSheet,
    generatedAt: new Date().toISOString(),
    source: "heuristic",
  };
}

function normalizeTour(raw: unknown, branchName: string, source: CodebaseTour["source"]): CodebaseTour {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const steps = Array.isArray(obj.steps) ? (obj.steps as TourStep[]) : [];
  const cheatSheet = Array.isArray(obj.cheatSheet)
    ? (obj.cheatSheet as CodebaseTour["cheatSheet"])
    : [];

  return {
    branchName,
    steps: steps.filter((s) => s?.id && s?.title && s?.narration),
    cheatSheet: cheatSheet.filter((c) => c?.question && c?.pathPrefix),
    generatedAt:
      typeof obj.generatedAt === "string" ? obj.generatedAt : new Date().toISOString(),
    source,
  };
}

async function readCachedTour(branchName: string): Promise<CodebaseTour | null> {
  const scope = resolveRepoScope();
  if (!scope) return null;

  const row = await prismaAny.codebaseTourCache.findUnique({
    where: {
      repoOwner_repoName_branchName: {
        repoOwner: scope.repoOwner,
        repoName: scope.repoName,
        branchName,
      },
    },
  });

  if (!row?.tourJson) return null;
  return normalizeTour(row.tourJson, branchName, "cache");
}

async function writeCachedTour(branchName: string, tour: CodebaseTour): Promise<void> {
  const scope = resolveRepoScope();
  if (!scope) return;

  const payload = {
    branchName: tour.branchName,
    steps: tour.steps,
    cheatSheet: tour.cheatSheet,
    generatedAt: tour.generatedAt,
    source: tour.source,
  };

  await prismaAny.codebaseTourCache.upsert({
    where: {
      repoOwner_repoName_branchName: {
        repoOwner: scope.repoOwner,
        repoName: scope.repoName,
        branchName,
      },
    },
    create: {
      repoOwner: scope.repoOwner,
      repoName: scope.repoName,
      branchName,
      tourJson: payload,
    },
    update: {
      tourJson: payload,
      generatedAt: new Date(),
    },
  });
}

async function buildFallbackTour(branchName: string): Promise<CodebaseTour> {
  const layout = await visualizationCache.get(branchName);
  if (layout?.meta?.districts?.length) {
    return buildHeuristicTour(branchName, layout.meta.districts, layout.nodes ?? []);
  }

  const insights = await getCodebaseInsights(branchName);
  const districts: VisualizationDistrict[] = insights.topDirectories.map((d) => ({
    path: d.path,
    summary: `${d.fileCount} files in ${d.path}`,
    fileCount: d.fileCount,
    primaryPattern: "module",
  }));

  const nodes: VisualizationNode[] = insights.highlights.map((h, i) => ({
    id: h.path,
    path: h.path,
    name: h.path.split("/").pop() ?? h.path,
    type: "file" as const,
    size: h.size,
    depth: h.path.split("/").length,
    parent: null,
    language: h.language,
    summary: h.summary ?? "",
    patterns: h.patterns,
    lastModified: null,
    lastModifiedBy: "unknown" as const,
    coverage: 0,
    complexity: 0,
    importCount: insights.highlights.length - i,
    exportCount: 0,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  }));

  return buildHeuristicTour(branchName, districts, nodes);
}

export async function getTour(branchName = "main"): Promise<CodebaseTour> {
  const cached = await readCachedTour(branchName);
  if (cached && cached.steps.length > 0) {
    return cached;
  }
  return buildFallbackTour(branchName);
}

export async function generateTour(branchName = "main"): Promise<CodebaseTour> {
  if (!isTourLlmConfigured()) {
    logger.info({ branchName }, "OpenAI not configured — using heuristic tour");
    const fallback = await buildFallbackTour(branchName);
    await writeCachedTour(branchName, fallback);
    return fallback;
  }

  const [insights, topFiles, layout] = await Promise.all([
    getCodebaseInsights(branchName),
    loadTopFiles(branchName),
    visualizationCache.get(branchName),
  ]);

  const districts = layout?.meta?.districts ?? insights.topDirectories.map((d) => ({
    path: d.path,
    fileCount: d.fileCount,
    summary: `${d.fileCount} files`,
    primaryPattern: "module",
  }));

  const context = {
    branchName,
    repo: insights.repo,
    totals: insights.totals,
    languages: insights.languages.slice(0, 10),
    patterns: insights.patterns.slice(0, 15),
    topDirectories: insights.topDirectories.slice(0, 12),
    highlights: insights.highlights.slice(0, 20).map((h) => ({
      path: h.path,
      language: h.language,
      summary: h.summary?.slice(0, 160),
      patterns: h.patterns,
    })),
    topFilesByImports: topFiles,
    districts,
  };

  try {
    const { text } = await withRetry(
      () =>
        chatCompletionText({
          maxTokens: 4000,
          system: `You are a codebase onboarding guide. Generate a guided tour from aggregated intelligence only — never invent file paths not in the context.
Return JSON only with this shape:
{
  "steps": [
    {
      "id": "string",
      "title": "string",
      "narration": "string (2-4 sentences, conversational)",
      "focusPath": "district path or null",
      "zoomLevel": "galaxy"|"district"|"file",
      "highlightPaths": ["optional file paths from context"],
      "spotlights": [{"path":"file","summary":"why read this"}],
      "quiz": {"prompt":"...","correctPathPrefix":"district","explanation":"..."}
    }
  ],
  "cheatSheet": [
    {"question":"Where is X?","pathPrefix":"path","highlightPaths":["optional"]}
  ]
}
Rules:
- 6-10 steps, foundational to specific
- Include exactly 2-3 quiz steps with correctPathPrefix matching a real district path
- cheatSheet: 8-12 practical questions developers ask
- Use only paths from the provided context`,
          user: `Generate a guided tour for this codebase:\n${JSON.stringify(context, null, 2)}`,
        }),
      { maxAttempts: 2, baseDelayMs: 1000, maxDelayMs: 8000 }
    );
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as { steps?: TourStep[]; cheatSheet?: CodebaseTour["cheatSheet"] };

    let tour: CodebaseTour = {
      branchName,
      steps: (parsed.steps ?? []).filter((s) => s?.id && s?.title),
      cheatSheet: parsed.cheatSheet ?? [],
      generatedAt: new Date().toISOString(),
      source: "openai",
    };

    if (tour.steps.length < 3) {
      logger.warn({ branchName }, "GPT tour too short — merging heuristic fallback");
      const fallback = await buildFallbackTour(branchName);
      tour = {
        ...fallback,
        cheatSheet: tour.cheatSheet.length >= 5 ? tour.cheatSheet : fallback.cheatSheet,
        source: "heuristic",
      };
    }

    await writeCachedTour(branchName, tour);
    logger.info({ branchName, steps: tour.steps.length, source: tour.source }, "codebase tour generated");
    return tour;
  } catch (err) {
    logger.warn({ err, branchName }, "GPT tour generation failed — heuristic fallback");
    const fallback = await buildFallbackTour(branchName);
    await writeCachedTour(branchName, fallback);
    return fallback;
  }
}
