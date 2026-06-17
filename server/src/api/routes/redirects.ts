import { Router } from "express";
import { prisma } from "../../db/client";
import {
  frontendBaseUrl,
  frontendIntegrationUrl,
} from "../../shared/frontendUrls";

const router = Router();

/** GitHub App Setup URL posts to site root — resolve org and forward to integration page. */
router.get("/github-setup", async (req, res) => {
  const installationId = String(req.query.installation_id ?? "").trim();
  const setupAction = String(req.query.setup_action ?? "").trim();
  const base = frontendBaseUrl();

  if (!installationId) {
    res.redirect(base || "/");
    return;
  }

  const install = await prisma.githubInstallation.findFirst({
    where: { installationId },
    select: { organizationId: true },
  });

  let slug: string | undefined;
  if (install?.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: install.organizationId },
      select: { slug: true },
    });
    slug = org?.slug;
  }

  const params = new URLSearchParams();
  params.set("installation_id", installationId);
  if (setupAction) params.set("setup_action", setupAction);
  params.set("provider", "github");

  if (slug) {
    res.redirect(`${frontendIntegrationUrl(slug, "github")}?${params.toString()}`);
    return;
  }

  const fallback = base ? `${base}/app/settings/integrations/github` : "/app/settings/integrations/github";
  res.redirect(`${fallback}?${params.toString()}`);
});

export default router;
