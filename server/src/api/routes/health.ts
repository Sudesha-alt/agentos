import { Router } from "express";
import { prisma } from "../../db/client";
import { redisConnection } from "../../queue/jobQueue";

const router = Router();

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.get("/readyz", async (_req, res) => {
  const checks: Record<string, "ok" | string> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = "ok";
  } catch (err) {
    checks.postgres = err instanceof Error ? err.message : "error";
  }
  try {
    await redisConnection.ping();
    checks.redis = "ok";
  } catch (err) {
    checks.redis = err instanceof Error ? err.message : "error";
  }
  const ok = Object.values(checks).every((v) => v === "ok");
  res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "degraded", checks });
});

export default router;
