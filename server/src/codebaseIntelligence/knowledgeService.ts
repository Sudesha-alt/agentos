import { prisma } from "../db/client";
import { chatCompletionText } from "../llm/openaiCompletion";
import { isOpenAIConfigured } from "../llm/openaiClient";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import { getCodebaseInsights } from "./insightsService";
import { resolveRepoScope } from "./repoScope";

const prismaAny = prisma as any;

export type ArchitectureSection = {
  heading: string;
  body: string;
  fileRefs?: string[];
};

export type ArchitectureDoc = {
  title: string;
  purpose: string;
  sections: ArchitectureSection[];
};

export type ComponentGuide = {
  path: string;
  title: string;
  summary: string;
  responsibilities: string[];
  inputs: string[];
  outputs: string[];
  dependencies: string[];
  keyFiles: Array<{ path: string; summary: string }>;
};

export type Runbook = {
  task: string;
  title: string;
  summary: string;
  steps: Array<{ order: number; instruction: string; fileRef?: string }>;
  exampleFiles: string[];
};

export type CodebaseKnowledge = {
  branchName: string;
  generatedAt: string;
  source: "openai" | "heuristic" | "cache";
  architecture: ArchitectureDoc;
  components: ComponentGuide[];
  runbooks: Runbook[];
};

const DEFAULT_RUNBOOK_TASKS = [
  "add-api-endpoint",
  "add-database-migration",
  "add-test",
  "add-service-module",
];

function slugify(task: string): string {
  return task
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeKnowledge(
  raw: unknown,
  branchName: string,
  source: CodebaseKnowledge["source"]
): CodebaseKnowledge {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const arch = obj.architecture as ArchitectureDoc | undefined;
  const components = Array.isArray(obj.components) ? (obj.components as ComponentGuide[]) : [];
  const runbooks = Array.isArray(obj.runbooks) ? (obj.runbooks as Runbook[]) : [];

  return {
    branchName,
    generatedAt:
      typeof obj.generatedAt === "string" ? obj.generatedAt : new Date().toISOString(),
    source,
    architecture: {
      title: arch?.title ?? "Architecture overview",
      purpose: arch?.purpose ?? "Indexed codebase understanding.",
      sections: Array.isArray(arch?.sections) ? arch!.sections : [],
    },
    components: components.filter((c) => c?.path && c?.title),
    runbooks: runbooks.filter((r) => r?.task && r?.title),
  };
}

async function readCachedKnowledge(branchName: string): Promise<CodebaseKnowledge | null> {
  const scope = resolveRepoScope();
  if (!scope) return null;

  const row = await prismaAny.codebaseKnowledgeCache.findUnique({
    where: {
      organizationId_repoOwner_repoName_branchName: {
        organizationId: scope.organizationId,
        repoOwner: scope.repoOwner,
        repoName: scope.repoName,
        branchName,
      },
    },
  });

  if (!row?.knowledgeJson) return null;
  return normalizeKnowledge(row.knowledgeJson, branchName, "cache");
}

async function writeCachedKnowledge(
  branchName: string,
  knowledge: CodebaseKnowledge
): Promise<void> {
  const scope = resolveRepoScope();
  if (!scope) return;

  await prismaAny.codebaseKnowledgeCache.upsert({
    where: {
      organizationId_repoOwner_repoName_branchName: {
        organizationId: scope.organizationId,
        repoOwner: scope.repoOwner,
        repoName: scope.repoName,
        branchName,
      },
    },
    create: {
      organizationId: scope.organizationId,
      repoOwner: scope.repoOwner,
      repoName: scope.repoName,
      branchName,
      knowledgeJson: knowledge,
    },
    update: {
      knowledgeJson: knowledge,
      generatedAt: new Date(),
    },
  });
}

async function loadFilesByDirectory(branchName: string, dirPath: string, limit = 8) {
  const scope = resolveRepoScope();
  if (!scope) return [];

  const prefix = dirPath ? `${dirPath}/` : "";
  const rows = await prismaAny.codebaseFile.findMany({
    where: {
      repoOwner: scope.repoOwner,
      repoName: scope.repoName,
      branchName,
      isDeleted: false,
      filePath: { startsWith: prefix },
    },
    select: { filePath: true, summary: true, patterns: true },
    take: 200,
  });

  return rows
    .filter((r: { filePath: string }) => {
      if (!dirPath) return !r.filePath.includes("/");
      const rel = r.filePath.slice(prefix.length);
      return rel && !rel.includes("/");
    })
    .slice(0, limit)
    .map((r: { filePath: string; summary: string | null }) => ({
      path: r.filePath,
      summary: r.summary?.slice(0, 160) ?? "Indexed module",
    }));
}

function buildHeuristicKnowledge(
  branchName: string,
  insights: Awaited<ReturnType<typeof getCodebaseInsights>>
): CodebaseKnowledge {
  const repoLabel = insights.repo
    ? `${insights.repo.owner}/${insights.repo.name}`
    : "this repository";

  const architecture: ArchitectureDoc = {
    title: `${repoLabel} architecture`,
    purpose: `AgentOS-indexed understanding of ${repoLabel} on branch ${branchName}.`,
    sections: [
      {
        heading: "System purpose",
        body: `${insights.totals.files} indexed files with ${insights.totals.withSummary} AI summaries. Dominant languages: ${insights.languages
          .slice(0, 3)
          .map((l) => l.language)
          .join(", ")}.`,
      },
      {
        heading: "Major components",
        body: insights.topDirectories
          .map((d) => `${d.path}/ (${d.fileCount} files)`)
          .join(" · "),
        fileRefs: insights.topDirectories.map((d) => d.path),
      },
      {
        heading: "Architectural patterns",
        body: insights.patterns.map((p) => `${p.pattern} (${p.count})`).join(" · ") || "Patterns emerge after indexing.",
      },
      {
        heading: "Key modules",
        body: insights.highlights
          .slice(0, 5)
          .map((h) => `${h.path}: ${h.summary ?? "No summary"}`)
          .join("\n"),
        fileRefs: insights.highlights.slice(0, 5).map((h) => h.path),
      },
    ],
  };

  const components: ComponentGuide[] = insights.topDirectories.slice(0, 6).map((dir) => ({
    path: dir.path,
    title: `${dir.path} component`,
    summary: `Top-level directory with ${dir.fileCount} indexed files.`,
    responsibilities: [`Hosts modules under ${dir.path}/`],
    inputs: ["Internal imports from sibling directories"],
    outputs: ["Exports consumed by other districts"],
    dependencies: insights.topDirectories
      .filter((d) => d.path !== dir.path)
      .slice(0, 3)
      .map((d) => d.path),
    keyFiles: insights.highlights
      .filter((h) => h.path.startsWith(`${dir.path}/`))
      .slice(0, 4)
      .map((h) => ({ path: h.path, summary: h.summary ?? "" })),
  }));

  const runbooks: Runbook[] = [
    {
      task: "add-api-endpoint",
      title: "Add a new API endpoint",
      summary: "Follow existing route patterns in the API layer.",
      steps: [
        { order: 1, instruction: "Locate the routes directory and an existing endpoint as a template." },
        { order: 2, instruction: "Add a new route module and wire it in the app router." },
        { order: 3, instruction: "Add tests alongside existing API tests." },
      ],
      exampleFiles: insights.highlights
        .filter((h) => h.path.includes("route") || h.patterns.includes("api-route"))
        .slice(0, 3)
        .map((h) => h.path),
    },
    {
      task: "add-database-migration",
      title: "Add a database migration",
      summary: "Use the project's schema migration workflow.",
      steps: [
        { order: 1, instruction: "Update the Prisma schema or SQL migration folder." },
        { order: 2, instruction: "Generate and apply the migration in dev." },
        { order: 3, instruction: "Update repositories and types that reference changed models." },
      ],
      exampleFiles: insights.highlights
        .filter((h) => h.path.includes("prisma") || h.path.includes("migration"))
        .slice(0, 3)
        .map((h) => h.path),
    },
    {
      task: "add-test",
      title: "Add a test for a service",
      summary: "Mirror conventions from existing test files.",
      steps: [
        { order: 1, instruction: "Find a test file for a similar module." },
        { order: 2, instruction: "Create a new spec beside the production code or in __tests__." },
        { order: 3, instruction: "Run the project's test runner." },
      ],
      exampleFiles: insights.highlights
        .filter((h) => h.path.includes("test") || h.patterns.includes("test"))
        .slice(0, 3)
        .map((h) => h.path),
    },
  ];

  return {
    branchName,
    generatedAt: new Date().toISOString(),
    source: "heuristic",
    architecture,
    components,
    runbooks,
  };
}

export async function getKnowledge(branchName = "main"): Promise<CodebaseKnowledge> {
  const cached = await readCachedKnowledge(branchName);
  if (cached && cached.architecture.sections.length > 0) {
    return cached;
  }
  const insights = await getCodebaseInsights(branchName);
  return buildHeuristicKnowledge(branchName, insights);
}

export async function getArchitectureDoc(branchName = "main"): Promise<ArchitectureDoc> {
  const knowledge = await getKnowledge(branchName);
  return knowledge.architecture;
}

export async function getComponentGuide(
  branchName: string,
  dirPath: string
): Promise<ComponentGuide | null> {
  const knowledge = await getKnowledge(branchName);
  const normalized = dirPath.replace(/\/+$/, "");
  const guide =
    knowledge.components.find((c) => c.path === normalized) ??
    knowledge.components.find((c) => normalized.startsWith(c.path));

  if (guide) return guide;

  const keyFiles = await loadFilesByDirectory(branchName, normalized);
  if (!keyFiles.length) return null;

  return {
    path: normalized,
    title: `${normalized} component`,
    summary: `Component guide not generated yet — showing indexed files under ${normalized}/.`,
    responsibilities: [],
    inputs: [],
    outputs: [],
    dependencies: [],
    keyFiles,
  };
}

export async function getRunbook(
  branchName: string,
  task: string
): Promise<Runbook | null> {
  const knowledge = await getKnowledge(branchName);
  const slug = slugify(task);
  return (
    knowledge.runbooks.find((r) => r.task === slug) ??
    knowledge.runbooks.find((r) => slugify(r.title).includes(slug)) ??
    null
  );
}

export async function generateKnowledge(branchName = "main"): Promise<CodebaseKnowledge> {
  const insights = await getCodebaseInsights(branchName);

  if (!insights.totals.files) {
    const empty = buildHeuristicKnowledge(branchName, insights);
    await writeCachedKnowledge(branchName, empty);
    return empty;
  }

  if (!isOpenAIConfigured()) {
    logger.info({ branchName }, "OpenAI not configured — heuristic knowledge base");
    const fallback = buildHeuristicKnowledge(branchName, insights);
    await writeCachedKnowledge(branchName, fallback);
    return fallback;
  }

  const context = {
    branchName,
    repo: insights.repo,
    totals: insights.totals,
    languages: insights.languages.slice(0, 10),
    patterns: insights.patterns.slice(0, 12),
    topDirectories: insights.topDirectories.slice(0, 10),
    highlights: insights.highlights.slice(0, 25).map((h) => ({
      path: h.path,
      summary: h.summary?.slice(0, 200),
      patterns: h.patterns,
    })),
    runbookTasks: DEFAULT_RUNBOOK_TASKS,
  };

  try {
    const { text } = await withRetry(
      () =>
        chatCompletionText({
          maxTokens: 5000,
          system: `You write living codebase documentation from indexed intelligence only — never invent paths.
Return JSON only:
{
  "architecture": {
    "title": string,
    "purpose": string,
    "sections": [{"heading": string, "body": string, "fileRefs": [string]}]
  },
  "components": [{
    "path": string,
    "title": string,
    "summary": string,
    "responsibilities": [string],
    "inputs": [string],
    "outputs": [string],
    "dependencies": [string],
    "keyFiles": [{"path": string, "summary": string}]
  }],
  "runbooks": [{
    "task": string,
    "title": string,
    "summary": string,
    "steps": [{"order": number, "instruction": string, "fileRef": string}],
    "exampleFiles": [string]
  }]
}
Rules:
- architecture: 4-6 prose sections (purpose, components, data flows, patterns, decisions)
- components: one guide per top-level directory in context
- runbooks: cover tasks add-api-endpoint, add-database-migration, add-test, add-service-module
- Use only paths from context`,
          user: `Generate knowledge base documentation:\n${JSON.stringify(context, null, 2)}`,
        }),
      { maxAttempts: 2, baseDelayMs: 1000, maxDelayMs: 12000 }
    );

    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as Partial<CodebaseKnowledge>;
    let knowledge = normalizeKnowledge(
      { ...parsed, generatedAt: new Date().toISOString(), source: "openai" },
      branchName,
      "openai"
    );

    if (knowledge.architecture.sections.length < 2 || knowledge.components.length < 1) {
      logger.warn({ branchName }, "GPT knowledge too thin — merging heuristic fallback");
      const fallback = buildHeuristicKnowledge(branchName, insights);
      knowledge = {
        ...fallback,
        architecture:
          knowledge.architecture.sections.length >= 2
            ? knowledge.architecture
            : fallback.architecture,
        runbooks: knowledge.runbooks.length >= 2 ? knowledge.runbooks : fallback.runbooks,
        source: "heuristic",
      };
    }

    await writeCachedKnowledge(branchName, knowledge);
    logger.info(
      {
        branchName,
        components: knowledge.components.length,
        runbooks: knowledge.runbooks.length,
        source: knowledge.source,
      },
      "codebase knowledge generated"
    );
    return knowledge;
  } catch (err) {
    logger.warn({ err, branchName }, "GPT knowledge generation failed — heuristic fallback");
    const fallback = buildHeuristicKnowledge(branchName, insights);
    await writeCachedKnowledge(branchName, fallback);
    return fallback;
  }
}
