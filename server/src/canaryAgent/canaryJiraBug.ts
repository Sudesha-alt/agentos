import { canaryRunRepo } from "../db/repositories/canaryRunRepo";
import { getPipelineJiraClient } from "../pipeline/jira/client";
import { logger } from "../utils/logger";

interface SavedFinding {
  id: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  reproductionSteps?: string | null;
  suggestedFix?: string | null;
  jiraKeyCreated?: string | null;
}

/**
 * For every critical (and optionally high) finding that doesn't already have a
 * linked Jira issue, create a Bug ticket and record the key on the finding row.
 *
 * Called after synthesis inside runCanaryCycle. Non-fatal — failures are logged
 * but do NOT propagate.
 */
export async function autoCreateJiraBugsFromFindings(
  findings: SavedFinding[],
  sourceJiraKey?: string
): Promise<void> {
  const criticals = findings.filter(
    (f) => f.severity === "critical" && !f.jiraKeyCreated
  );
  if (criticals.length === 0) return;

  let client: ReturnType<typeof getPipelineJiraClient>;
  try {
    client = getPipelineJiraClient();
  } catch {
    logger.warn("canary auto-bug skipped — Jira not configured");
    return;
  }

  for (const finding of criticals) {
    try {
      const summary = `[Canary] ${finding.title}`;
      const descriptionLines = [
        `*Severity:* ${finding.severity}`,
        `*Category:* ${finding.category}`,
        "",
        finding.description,
      ];
      if (finding.reproductionSteps) {
        descriptionLines.push("", "*Reproduction steps:*", finding.reproductionSteps);
      }
      if (finding.suggestedFix) {
        descriptionLines.push("", `*Suggested fix:* ${finding.suggestedFix}`);
      }
      if (sourceJiraKey) {
        descriptionLines.push("", `*Detected during:* ${sourceJiraKey}`);
      }

      const created = await client.createIssue({
        summary,
        description: descriptionLines.join("\n"),
        issueType: "Bug",
        labels: ["canary-finding", "agentos-canary"],
        priority: "Highest",
      });

      if (created?.key) {
        await canaryRunRepo.updateFindingJiraKey(finding.id, created.key);
        logger.info(
          { findingId: finding.id, jiraKey: created.key, sourceJiraKey },
          "canary critical finding → Jira bug created"
        );
      }
    } catch (err) {
      logger.warn(
        { err, findingTitle: finding.title },
        "canary auto-bug creation failed — non-fatal"
      );
    }
  }
}
