import { prisma } from "../client";

export type IntakeEventOutcome = "enqueued" | "skipped" | "failed";
export type IntakeEventSource = "webhook" | "poll" | "scan" | "manual" | "startup";

export interface RecordIntakeEventInput {
  organizationId: string;
  jiraKey: string;
  source: IntakeEventSource;
  outcome: IntakeEventOutcome;
  skipReason?: string;
  message?: string;
  summary?: string;
  issueType?: string;
}

export async function recordIntakeEvent(input: RecordIntakeEventInput) {
  return prisma.intakeEvent.create({
    data: {
      organizationId: input.organizationId,
      jiraKey: input.jiraKey,
      source: input.source,
      outcome: input.outcome,
      skipReason: input.skipReason ?? null,
      message: input.message ?? null,
      summary: input.summary ?? null,
      issueType: input.issueType ?? null,
    },
  });
}

export async function listRecentIntakeEvents(organizationId: string, limit = 25) {
  return prisma.intakeEvent.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getLatestIntakeEvent(
  organizationId: string,
  filters?: { source?: string; outcome?: string }
) {
  return prisma.intakeEvent.findFirst({
    where: {
      organizationId,
      ...(filters?.source ? { source: filters.source } : {}),
      ...(filters?.outcome ? { outcome: filters.outcome } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}
