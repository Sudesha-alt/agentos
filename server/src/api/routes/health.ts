import { Router } from "express";
import { getPrisma } from "../../db/client";

const router = Router();

router.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    openaiChatTokenParam: "max_completion_tokens",
  });
});

router.get("/readyz", async (_req, res) => {
  const checks: Record<string, "ok" | string> = {};
  const prisma = getPrisma();
  if (!prisma) {
    checks.postgres = "skipped (DATABASE_URL not set)";
  } else {
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = "ok";
    } catch (err) {
      checks.postgres = err instanceof Error ? err.message : "error";
    }
  }
  const ok = Object.values(checks).every((v) => v === "ok" || v.startsWith("skipped"));
  res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "degraded", checks });
});

export default router;
