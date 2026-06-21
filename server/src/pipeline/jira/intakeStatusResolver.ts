import { getActiveOrganizationId } from "../../organization/context";
import { logger } from "../../utils/logger";
import {
  getPipelineIntakeMapping,
  getPipelineIntakeStatuses,
  warmOrganizationIntakeMapping,
} from "./intakeConfig";
import { validatePipelineJiraConfig } from "./credentialsStore";
import {
  getBoardColumnsOrdered,
  resolveIntakeStatusesForColumn,
} from "./boardService";

const liveCache = new Map<string, { statuses: string[]; at: number }>();
const LIVE_STATUS_TTL_MS = 60_000;

/** Status names that belong to the configured AI Worker board column (live from Jira). */
export async function getLiveAiWorkerColumnStatuses(): Promise<string[]> {
  const orgId = getActiveOrganizationId();
  if (!orgId) return [];

  const cached = liveCache.get(orgId);
  if (cached && Date.now() - cached.at < LIVE_STATUS_TTL_MS) {
    return cached.statuses;
  }

  const mapping = getPipelineIntakeMapping();
  if (!mapping.boardId?.trim() || !mapping.aiWorkerColumnName?.trim()) {
    return [];
  }

  try {
    validatePipelineJiraConfig();
    const columns = await getBoardColumnsOrdered(mapping.boardId);
    const statuses = resolveIntakeStatusesForColumn(
      mapping.aiWorkerColumnName,
      columns
    );
    liveCache.set(orgId, { statuses, at: Date.now() });
    return statuses;
  } catch (err) {
    logger.warn({ err, orgId }, "failed to load live AI Worker column statuses");
    return [];
  }
}

/** Cached config + live board column statuses, persisted when Jira board mapping drifts. */
export async function getAiWorkerIntakeStatusesLive(): Promise<string[]> {
  const configured = getPipelineIntakeStatuses();
  const fromBoard = await getLiveAiWorkerColumnStatuses();
  const merged = [...new Set([...configured, ...fromBoard].filter(Boolean))];

  const orgId = getActiveOrganizationId();
  const mapping = getPipelineIntakeMapping();
  if (
    orgId &&
    fromBoard.length > 0 &&
    mapping.aiWorkerColumnName &&
    !statusSetsEqual(configured, fromBoard)
  ) {
    try {
      const { saveOrganizationPipelineIntake } = await import(
        "../../organization/jiraConfigStore"
      );
      await saveOrganizationPipelineIntake(orgId, {
        boardId: mapping.boardId,
        columnName: mapping.aiWorkerColumnName,
        statuses: fromBoard,
      });
      liveCache.delete(orgId);
      logger.info(
        { column: mapping.aiWorkerColumnName, statuses: fromBoard, previous: configured },
        "synced AI Worker intake statuses from Jira board column"
      );
      return fromBoard;
    } catch (err) {
      logger.warn({ err }, "failed to persist refreshed AI Worker statuses");
    }
  }

  return merged.length ? merged : configured;
}

function statusSetsEqual(a: string[], b: string[]): boolean {
  const norm = (list: string[]) =>
    [...new Set(list.map((s) => s.trim().toLowerCase()).filter(Boolean))].sort();
  const aa = norm(a);
  const bb = norm(b);
  return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
}

export async function isIssueInAiWorkerIntake(
  statusName: string | undefined
): Promise<boolean> {
  if (!statusName?.trim()) return false;
  const normalized = statusName.trim().toLowerCase();
  const statuses = await getAiWorkerIntakeStatusesLive();
  return statuses.some((s) => s.trim().toLowerCase() === normalized);
}

export function formatIntakeStatusSkipMessage(
  jiraKey: string,
  statusName: string,
  configuredStatuses: string[],
  liveColumnStatuses: string[]
): string {
  const parts = [
    `${jiraKey} is in "${statusName}"`,
    configuredStatuses.length
      ? `configured: ${configuredStatuses.join(", ")}`
      : "no statuses configured",
  ];
  if (liveColumnStatuses.length) {
    parts.push(`AI Worker column maps to: ${liveColumnStatuses.join(", ")}`);
  }
  parts.push(
    "Move the ticket into the AI Worker column, then use Scan AI Worker now if needed"
  );
  return parts.join(" — ");
}

export async function warmLiveIntakeStatuses(organizationId: string): Promise<void> {
  await warmOrganizationIntakeMapping(organizationId);
  liveCache.delete(organizationId);
}
