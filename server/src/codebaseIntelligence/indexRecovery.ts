import { prisma } from "../db/client";
import { withOrganizationContext } from "../api/orgRequestContext";
import { logger } from "../utils/logger";
import { runFullIndex } from "./indexer";

const prismaAny = prisma as any;

/** Resume index runs that were interrupted when the API process restarted. */
export async function recoverStaleIndexRuns(): Promise<void> {
  const stuck = await prismaAny.codebaseIndexRun.findMany({
    where: { status: { in: ["running", "queued"] } },
    orderBy: { startedAt: "asc" },
  });

  if (stuck.length === 0) return;

  logger.info({ count: stuck.length }, "recovering stale codebase index runs");

  for (const run of stuck) {
    if (run.runType !== "full") {
      await prismaAny.codebaseIndexRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          error: "Incremental index interrupted by server restart — trigger a full re-index.",
          completedAt: new Date(),
        },
      });
      continue;
    }

    logger.info(
      { runId: run.id, branch: run.branchName, repo: `${run.repoOwner}/${run.repoName}` },
      "restarting full index after interruption"
    );

    void withOrganizationContext(run.organizationId, async () => {
      await runFullIndex(run.branchName, {
        runId: run.id,
        triggerType: run.triggerType ?? "manual",
      });
    }).catch((err) => {
      logger.warn({ err, runId: run.id }, "recovered full index failed");
    });
  }
}
