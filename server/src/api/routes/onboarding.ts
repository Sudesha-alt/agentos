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
    res.status(401).json({ error: "unauthorized", message: "Your session expired. Please sign in again." });
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
    res.status(401).json({ error: "unauthorized", message: "Your session expired. Please sign in again." });
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save onboarding step";
    res.status(500).json({ error: "onboarding_update_failed", message });
  }
});

router.post("/complete", async (req, res) => {
  const user = resolveUserFromAuthHeader(req);
  if (!user) {
    res.status(401).json({ error: "unauthorized", message: "Your session expired. Please sign in again." });
    return;
  }
  try {
    await ensureOnboarding({
      userId: user.id,
      email: user.email,
      name: user.name,
    });
    const existing = await getOnboarding(user.id);
    if (existing?.completed) {
      res.json({ onboarding: existing, alreadyCompleted: true });
      return;
    }
    const record = await completeOnboarding(user.id);
    res.json({ onboarding: record });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not complete onboarding";
    res.status(500).json({ error: "onboarding_complete_failed", message });
  }
});

export default router;
