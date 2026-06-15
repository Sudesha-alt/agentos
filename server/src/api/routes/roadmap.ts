import { Router } from "express";
import { z } from "zod";
import { roadmapService } from "../../roadmap/service";
import {
  requireOrganizationUser,
  withOrganizationContext,
} from "../orgRequestContext";

const router = Router();

const createItemSchema = z.object({
  stageKey: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  routeType: z.enum(["USER_INPUT", "AGENT", "APPROVAL"]).optional(),
  dependsOnSlugs: z.array(z.string()).optional(),
});

const updateItemSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
  stageKey: z.string().min(1).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  routeType: z.enum(["USER_INPUT", "AGENT", "APPROVAL"]).optional(),
  dependsOnSlugs: z.array(z.string()).optional(),
  jiraKey: z.string().nullable().optional(),
});

router.get("/board", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      try {
        const board = await roadmapService.getOrCreateBoard();
        res.json(board);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("does not exist") || msg.includes("Roadmap")) {
          res.status(503).json({
            error: "roadmap_unavailable",
            message:
              "Roadmap tables are not ready. Run prisma migrate deploy on the server.",
          });
          return;
        }
        throw err;
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post("/items", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }

    await withOrganizationContext(user.organizationId, async () => {
      const board = await roadmapService.createItem(parsed.data);
      res.status(201).json(board);
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/items/:itemId", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const parsed = updateItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }

    await withOrganizationContext(user.organizationId, async () => {
      try {
        const board = await roadmapService.updateItem(req.params.itemId, parsed.data);
        res.json(board);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("prerequisite") || msg.includes("not found")) {
          res.status(400).json({ error: msg });
          return;
        }
        throw e;
      }
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/items/:itemId", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const board = await roadmapService.deleteItem(req.params.itemId);
      res.json(board);
    });
  } catch (err) {
    next(err);
  }
});

export default router;
