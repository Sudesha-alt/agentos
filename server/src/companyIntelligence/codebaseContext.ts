import { getKnowledge } from "../codebaseIntelligence/knowledgeService";
import { getCodebaseInsights } from "../codebaseIntelligence/insightsService";
import { resolveRepoScope } from "../codebaseIntelligence/repoScope";
import { logger } from "../utils/logger";

const BUSINESS_PATH_RE =
  /readme|marketing|pricing|billing|subscription|checkout|payment|revenue|onboard|tenant|workspace|customer|icp|product|landing|docs\/|about/i;

export interface CodebaseBusinessSignals {
  branchName: string;
  repoLabel: string | null;
  indexedFiles: number;
  block: string;
}

function formatInsightsBlock(
  insights: Awaited<ReturnType<typeof getCodebaseInsights>>
): string {
  const lines: string[] = [];

  if (insights.repo) {
    lines.push(
      `Repository: ${insights.repo.owner}/${insights.repo.name} @ ${insights.repo.branch}`
    );
  }
  lines.push(
    `Indexed: ${insights.totals.files} files (${insights.totals.withSummary} with AI summaries)`
  );

  if (insights.languages.length) {
    lines.push(
      `Stack: ${insights.languages
        .slice(0, 8)
        .map((l) => `${l.language} (${l.count})`)
        .join(", ")}`
    );
  }

  if (insights.patterns.length) {
    lines.push(
      `Dominant patterns: ${insights.patterns
        .slice(0, 10)
        .map((p) => `${p.pattern} (${p.count})`)
        .join(", ")}`
    );
  }

  if (insights.topDirectories.length) {
    lines.push(
      `Top modules:\n${insights.topDirectories
        .slice(0, 12)
        .map((d) => `- ${d.path} (${d.fileCount} files)`)
        .join("\n")}`
    );
  }

  const businessHighlights = insights.highlights.filter((h) =>
    BUSINESS_PATH_RE.test(h.path)
  );
  const productHighlights =
    businessHighlights.length > 0
      ? businessHighlights
      : insights.highlights.slice(0, 20);

  if (productHighlights.length) {
    lines.push(
      `Key files (product/business signals):\n${productHighlights
        .map(
          (h) =>
            `- ${h.path}${h.summary ? `: ${h.summary.replace(/\s+/g, " ").slice(0, 220)}` : ""}`
        )
        .join("\n")}`
    );
  }

  return lines.join("\n\n");
}

function formatKnowledgeBlock(
  knowledge: Awaited<ReturnType<typeof getKnowledge>>
): string {
  const arch = knowledge.architecture;
  const sections = arch.sections
    .slice(0, 8)
    .map((s) => `### ${s.heading}\n${s.body}`)
    .join("\n\n");

  const components = knowledge.components
    .slice(0, 10)
    .map(
      (c) =>
        `- ${c.path} — ${c.title}: ${c.summary}\n  Responsibilities: ${c.responsibilities.slice(0, 4).join("; ")}`
    )
    .join("\n");

  return [
    `Architecture: ${arch.title}`,
    arch.purpose,
    sections ? `Sections:\n${sections}` : "",
    components ? `Components:\n${components}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function gatherCodebaseBusinessSignals(
  branchName?: string
): Promise<CodebaseBusinessSignals> {
  const scope = resolveRepoScope();
  const branch = branchName ?? scope?.defaultBranch ?? "main";

  if (!scope) {
    return {
      branchName: branch,
      repoLabel: null,
      indexedFiles: 0,
      block:
        "Codebase not connected or not indexed. Connect GitHub and run a full index before generating business context.",
    };
  }

  try {
    const [insights, knowledge] = await Promise.all([
      getCodebaseInsights(branch),
      getKnowledge(branch),
    ]);

    const block = [
      "=== CODEBASE INDEX INTELLIGENCE ===",
      formatInsightsBlock(insights),
      "",
      "=== CODEBASE KNOWLEDGE (architecture & components) ===",
      formatKnowledgeBlock(knowledge),
    ].join("\n");

    return {
      branchName: branch,
      repoLabel: `${scope.repoOwner}/${scope.repoName}`,
      indexedFiles: insights.totals.files,
      block: block.slice(0, 14000),
    };
  } catch (err) {
    logger.warn({ err, branch }, "gather codebase business signals failed");
    return {
      branchName: branch,
      repoLabel: `${scope.repoOwner}/${scope.repoName}`,
      indexedFiles: 0,
      block: "Codebase intelligence unavailable — index may be empty or the database unreachable.",
    };
  }
}
