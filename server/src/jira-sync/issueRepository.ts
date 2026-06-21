import { prisma } from "../db/client";
import { isAiWorkerEligibleIssueType } from "../pipeline/jira/aiWorkerIssueTypes";
import type { Prisma } from "../db/prisma";
import { activeOrganizationFilter, requireActiveOrganizationId } from "../organization/orgScope";
import type { FetchedJiraIssue } from "./issueFetcher";

export interface ListJiraIssuesOptions {
  status?: string;
  project?: string;
  q?: string;
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
  organizationId?: string;
}

function orgWhere(organizationId?: string) {
  return { organizationId: organizationId ?? requireActiveOrganizationId() };
}

export async function upsertJiraIssueRecord(
  issue: FetchedJiraIssue,
  options?: { embeddedAt?: Date; isDeleted?: boolean; organizationId?: string }
): Promise<void> {
  const organizationId = options?.organizationId ?? requireActiveOrganizationId();
  const now = new Date();
  await prisma.jiraIssue.upsert({
    where: {
      organizationId_jiraKey: { organizationId, jiraKey: issue.jiraKey },
    },
    create: {
      organizationId,
      jiraTicketId: issue.jiraTicketId,
      jiraKey: issue.jiraKey,
      projectKey: issue.projectKey,
      summary: issue.summary,
      description: issue.description,
      issueType: issue.issueType,
      status: issue.status,
      priority: issue.priority,
      reporter: issue.reporter,
      assignee: issue.assignee,
      labels: issue.labels,
      components: issue.components,
      commentsText: issue.commentsText || null,
      resolution: issue.resolution,
      rawPayload: (issue.rawPayload ?? undefined) as Prisma.InputJsonValue | undefined,
      jiraUpdatedAt: issue.jiraUpdatedAt,
      embeddedAt: options?.embeddedAt ?? undefined,
      isDeleted: options?.isDeleted ?? false,
      updatedAt: now,
    },
    update: {
      jiraTicketId: issue.jiraTicketId,
      projectKey: issue.projectKey,
      summary: issue.summary,
      description: issue.description,
      issueType: issue.issueType,
      status: issue.status,
      priority: issue.priority,
      reporter: issue.reporter,
      assignee: issue.assignee,
      labels: issue.labels,
      components: issue.components,
      commentsText: issue.commentsText || null,
      resolution: issue.resolution,
      rawPayload: (issue.rawPayload ?? undefined) as Prisma.InputJsonValue | undefined,
      jiraUpdatedAt: issue.jiraUpdatedAt,
      isDeleted: options?.isDeleted ?? false,
      updatedAt: now,
      ...(options?.embeddedAt ? { embeddedAt: options.embeddedAt } : {}),
    },
  });
}

export async function markJiraIssueDeleted(
  jiraKey: string,
  organizationId?: string
): Promise<void> {
  const org = orgWhere(organizationId);
  await prisma.jiraIssue.updateMany({
    where: { jiraKey, ...org },
    data: { isDeleted: true, updatedAt: new Date() },
  });
}

export async function getJiraIssueByKey(jiraKey: string, organizationId?: string) {
  const org = orgWhere(organizationId);
  return prisma.jiraIssue.findFirst({
    where: { jiraKey, isDeleted: false, ...org },
  });
}

export async function listJiraIssues(options: ListJiraIssuesOptions = {}) {
  const limit = Math.min(options.limit ?? 50, 200);
  const offset = options.offset ?? 0;
  const where: Record<string, unknown> = { ...orgWhere(options.organizationId) };

  if (!options.includeDeleted) {
    where.isDeleted = false;
  }
  if (options.status) {
    where.status = options.status;
  }
  if (options.project) {
    where.projectKey = options.project;
  }
  if (options.q?.trim()) {
    const q = options.q.trim();
    where.OR = [
      { jiraKey: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.jiraIssue.findMany({
      where,
      orderBy: { jiraUpdatedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.jiraIssue.count({ where }),
  ]);

  return { items, total, limit, offset };
}

export async function getJiraIssueStats(organizationId?: string): Promise<{
  total: number;
  embedded: number;
  deleted: number;
  byStatus: Record<string, number>;
}> {
  const org = orgWhere(organizationId);
  const [total, embedded, deleted, rows] = await Promise.all([
    prisma.jiraIssue.count({ where: { ...org, isDeleted: false } }),
    prisma.jiraIssue.count({
      where: { ...org, isDeleted: false, embeddedAt: { not: null } },
    }),
    prisma.jiraIssue.count({ where: { ...org, isDeleted: true } }),
    prisma.jiraIssue.groupBy({
      by: ["status"],
      where: { ...org, isDeleted: false },
      _count: { status: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of rows) {
    byStatus[row.status] = row._count.status;
  }

  return { total, embedded, deleted, byStatus };
}

export async function listJiraIssuesByStatus(
  statuses: string[],
  organizationId?: string
): Promise<Array<{ jiraKey: string; status: string; issueType: string }>> {
  if (statuses.length === 0) return [];
  const org = orgWhere(organizationId);
  const rows = await prisma.jiraIssue.findMany({
    where: {
      ...org,
      isDeleted: false,
      status: { in: statuses },
    },
    select: { jiraKey: true, status: true, issueType: true },
  });
  return rows.filter((row) => isAiWorkerEligibleIssueType(row.issueType));
}
