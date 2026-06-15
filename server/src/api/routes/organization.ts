import { Router } from "express";
import {
  createOrganizationForUser,
  extractEmailDomain,
  findOrganizationsByDomain,
  getOrganizationForUser,
  joinOrganizationForUser,
} from "../../organization/service";
import { getPublicOrganizationJiraConfig } from "../../organization/jiraConfigStore";
import { getCompanyProfile } from "../../companyIntelligence/store";
import { issueSessionForUserId, resolveUserFromAuthHeader } from "./authSession";
import { requireAuthUser } from "../orgRequestContext";

const router = Router();

router.get("/", async (req, res) => {
  const user = resolveUserFromAuthHeader(req);
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  if (!user.organizationId) {
    res.json({
      organization: null,
      jira: null,
      companyProfileConfigured: false,
    });
    return;
  }

  const membership = await getOrganizationForUser(user.id);
  const jira = membership
    ? await getPublicOrganizationJiraConfig(membership.organization.id)
    : null;
  const companyProfile = await getCompanyProfile(user.organizationId);

  res.json({
    organization: {
      id: user.organizationId,
      name: user.organizationName,
      domain: user.organizationDomain,
      slug: membership?.organization.slug ?? null,
      role: user.organizationRole,
    },
    jira,
    companyProfileConfigured: Boolean(
      companyProfile.companyName || companyProfile.productSummary
    ),
  });
});

router.get("/by-domain", async (req, res) => {
  const user = requireAuthUser(req, res);
  if (!user) return;

  try {
    const domain = extractEmailDomain(user.email);
    const organizations = await findOrganizationsByDomain(domain);
    res.json({
      domain,
      organizations,
      currentOrganizationId: user.organizationId ?? null,
    });
  } catch (err) {
    res.status(400).json({
      error: "invalid_email_domain",
      message: err instanceof Error ? err.message : "Invalid email domain",
    });
  }
});

router.post("/create", async (req, res) => {
  const user = requireAuthUser(req, res);
  if (!user) return;

  if (user.organizationId) {
    res.status(409).json({
      error: "organization_already_assigned",
      message: "You already belong to a workspace.",
    });
    return;
  }

  const name =
    typeof req.body?.name === "string" ? req.body.name.trim() : undefined;

  try {
    await createOrganizationForUser(user.id, user.email, name);
    const session = await issueSessionForUserId(user.id);
    res.json(session);
  } catch (err) {
    res.status(500).json({
      error: "organization_create_failed",
      message: err instanceof Error ? err.message : "Could not create workspace",
    });
  }
});

router.post("/join", async (req, res) => {
  const user = requireAuthUser(req, res);
  if (!user) return;

  if (user.organizationId) {
    res.status(409).json({
      error: "organization_already_assigned",
      message: "You already belong to a workspace.",
    });
    return;
  }

  const organizationId = String(req.body?.organizationId ?? "").trim();
  if (!organizationId) {
    res.status(400).json({ error: "organization_id_required" });
    return;
  }

  try {
    await joinOrganizationForUser(user.id, user.email, organizationId);
    const session = await issueSessionForUserId(user.id);
    res.json(session);
  } catch (err) {
    const message = err instanceof Error ? err.message : "join_failed";
    const status =
      message === "organization_not_found"
        ? 404
        : message === "organization_domain_mismatch"
          ? 403
          : 500;
    res.status(status).json({ error: message });
  }
});

export default router;
