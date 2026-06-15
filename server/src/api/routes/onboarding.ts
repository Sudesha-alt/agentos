import { Router } from "express";
import {
  completeOnboarding,
  ensureOnboarding,
  getOnboarding,
  updateOnboarding,
} from "../../onboarding/store";
import { resolveUserFromAuthHeader } from "./authSession";

const router = Router();

router.get("/", async (req, res) => {
  const user = resolveUserFromAuthHeader(req);
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const record = await getOnboarding(user.id);
  res.json({
    onboarding: record ?? {
      userId: user.id,
      email: user.email,
      name: user.name,
      companyStage: null,
      teamSize: null,
      role: null,
      completed: false,
      completedAt: null,
      updatedAt: null,
    },
  });
});

router.put("/", async (req, res) => {
  const user = resolveUserFromAuthHeader(req);
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    await ensureOnboarding({
      userId: user.id,
      email: user.email,
      name: user.name,
    });
    const record = await updateOnboarding(user.id, {
      name: typeof req.body?.name === "string" ? req.body.name : undefined,
      companyStage: req.body?.companyStage ?? undefined,
      teamSize: req.body?.teamSize ?? undefined,
      role: req.body?.role ?? undefined,
    });
    res.json({ onboarding: record });
  } catch {
    res.status(404).json({ error: "onboarding_not_found" });
  }
});

router.post("/complete", async (req, res) => {
  const user = resolveUserFromAuthHeader(req);
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    await ensureOnboarding({
      userId: user.id,
      email: user.email,
      name: user.name,
    });
    const record = await completeOnboarding(user.id);
    res.json({ onboarding: record });
  } catch {
    res.status(404).json({ error: "onboarding_not_found" });
  }
});

export default router;
