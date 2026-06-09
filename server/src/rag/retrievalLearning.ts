import { prisma } from "../db/client";
import { resolveRepoScope } from "../codebaseIntelligence/repoScope";
import { logger } from "../utils/logger";
import type { RetrospectiveOutput } from "../agents/pm/types";

const componentPatternBoosts = new Map<string, Set<string>>();

const PATTERN_KEYWORDS: Record<string, string[]> = {
  billing: ["billing", "config", "api-route"],
  config: ["config", "utility"],
  auth: ["auth", "middleware"],
};

export function recordRetrospectiveLearning(
  retrospective: RetrospectiveOutput,
  ticketComponents: string[] = []
): void {
  for (const component of ticketComponents) {
    if (!componentPatternBoosts.has(component)) {
      componentPatternBoosts.set(component, new Set());
    }
    const boosts = componentPatternBoosts.get(component)!;
    for (const [key, patterns] of Object.entries(PATTERN_KEYWORDS)) {
      if (component.toLowerCase().includes(key)) {
        patterns.forEach((p) => boosts.add(p));
      }
    }
  }

  for (const signal of retrospective.learningSignals ?? []) {
    const lower = signal.toLowerCase();
    for (const [key, patterns] of Object.entries(PATTERN_KEYWORDS)) {
      if (lower.includes(key)) {
        for (const component of ticketComponents) {
          if (!componentPatternBoosts.has(component)) {
            componentPatternBoosts.set(component, new Set());
          }
          patterns.forEach((p) => componentPatternBoosts.get(component)!.add(p));
        }
      }
    }
  }

  if (retrospective.patternFlag && retrospective.patternFlag !== "none") {
    logger.info(
      { patternFlag: retrospective.patternFlag },
      "retrospective pattern recorded for retrieval boosts"
    );
  }
}

export function getBoostedPatternTags(components: string[]): string[] {
  const tags = new Set<string>();
  for (const component of components) {
    const boosted = componentPatternBoosts.get(component);
    if (boosted) boosted.forEach((t) => tags.add(t));
    for (const [key, patterns] of Object.entries(PATTERN_KEYWORDS)) {
      if (component.toLowerCase().includes(key)) {
        patterns.forEach((p) => tags.add(p));
      }
    }
  }
  return [...tags];
}

/** Append pattern tags to codebase files mentioned in retrospective file-detection notes. */
export async function applyFilePatternBoostsFromRetrospective(
  retrospective: RetrospectiveOutput,
  affectedFilePaths: string[],
  branchName: string
): Promise<void> {
  const scope = resolveRepoScope();
  if (!scope || affectedFilePaths.length === 0) return;

  const note = retrospective.fileDetectionAccuracy ?? "";
  const tags = getBoostedPatternTags([]);
  if (note.toLowerCase().includes("config")) tags.push("config");
  if (note.toLowerCase().includes("billing")) tags.push("billing");

  if (tags.length === 0) return;

  for (const filePath of affectedFilePaths.slice(0, 10)) {
    try {
      const row = await prisma.codebaseFile.findUnique({
        where: {
          repoOwner_repoName_filePath_branchName: {
            repoOwner: scope.repoOwner,
            repoName: scope.repoName,
            filePath,
            branchName,
          },
        },
      });
      if (!row) continue;

      const existing = Array.isArray(row.patterns) ? (row.patterns as string[]) : [];
      const merged = [...new Set([...existing, ...tags])];
      await prisma.codebaseFile.update({
        where: { id: row.id },
        data: { patterns: merged },
      });
    } catch (err) {
      logger.warn({ err, filePath }, "retrospective pattern boost failed");
    }
  }
}
