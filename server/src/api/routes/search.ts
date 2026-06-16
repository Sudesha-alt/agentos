import { Router } from "express";
import { prisma } from "../../db/client";
import { searchCodebase } from "../../codebaseIntelligence/searchService";
import {
  requireOrganizationUser,
  withOrganizationContext,
} from "../orgRequestContext";
import { logger } from "../../utils/logger";

const router = Router();

function ticketSummary(ticket: { normalizedData?: unknown; jiraKey?: string | null } | null) {
  const data = ticket?.normalizedData;
  if (data && typeof data === "object" && "summary" in data) {
    const summary = (data as { summary?: string }).summary;
    if (typeof summary === "string" && summary.trim()) return summary.trim();
  }
  return ticket?.jiraKey ?? "Untitled ticket";
}

function metadataText(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  try {
    return JSON.stringify(metadata).toLowerCase();
  } catch {
    return "";
  }
}

router.get("/", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const query = String(req.query.q ?? "").trim();
    const branch = String(req.query.branch ?? "main").trim() || "main";

    if (!query) {
      res.json({
        query: "",
        tickets: [],
        codebase: { files: [], patterns: [], results: [] },
        audit: [],
      });
      return;
    }

    await withOrganizationContext(user.organizationId, async () => {
      const q = query.toLowerCase();

      const pipelines = await prisma.pipeline.findMany({
        where: { organizationId: user.organizationId },
        include: { ticket: true },
        orderBy: { startedAt: "desc" },
        take: 100,
      });

      const tickets = pipelines
        .filter((pipeline) => {
          const key = pipeline.ticket?.jiraKey?.toLowerCase() ?? "";
          const summary = ticketSummary(pipeline.ticket).toLowerCase();
          return key.includes(q) || summary.includes(q);
        })
        .slice(0, 8)
        .map((pipeline) => ({
          id: pipeline.id,
          jiraKey: pipeline.ticket?.jiraKey ?? pipeline.id,
          summary: ticketSummary(pipeline.ticket),
          status: pipeline.status,
          currentStage: pipeline.currentStage,
        }));

      const pipelineIds = pipelines.map((p) => p.id);
      const pipelineById = new Map(pipelines.map((p) => [p.id, p]));

      let audit: Array<{
        id: string;
        event: string;
        timestamp: string;
        pipelineId: string;
        jiraKey: string;
        summary: string;
      }> = [];

      if (pipelineIds.length) {
        const logs = await prisma.auditLog.findMany({
          where: { pipelineId: { in: pipelineIds } },
          orderBy: { timestamp: "desc" },
          take: 200,
        });

        audit = logs
          .filter((log) => {
            const eventMatch = log.event.toLowerCase().includes(q);
            const metaMatch = metadataText(log.metadata).includes(q);
            return eventMatch || metaMatch;
          })
          .slice(0, 8)
          .map((log) => {
            const pipeline = pipelineById.get(log.pipelineId);
            return {
              id: log.id,
              event: log.event,
              timestamp: log.timestamp.toISOString(),
              pipelineId: log.pipelineId,
              jiraKey: pipeline?.ticket?.jiraKey ?? log.pipelineId,
              summary: ticketSummary(pipeline?.ticket ?? null),
              metadata: log.metadata,
            };
          });
      }

      let codebase: Awaited<ReturnType<typeof searchCodebase>> = {
        query,
        files: [],
        patterns: [],
        results: [],
      };

      if (query.length >= 2) {
        try {
          codebase = await searchCodebase({ query, branchName: branch });
        } catch (err) {
          logger.warn({ err, query }, "global search codebase failed");
        }
      }

      res.json({
        query,
        tickets,
        codebase: {
          files: codebase.files ?? [],
          patterns: codebase.patterns ?? [],
          results: codebase.results ?? codebase.files ?? [],
        },
        audit,
      });
    });
  } catch (err) {
    next(err);
  }
});

export default router;
