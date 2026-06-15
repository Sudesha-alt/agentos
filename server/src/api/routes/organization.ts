import { Router } from "express";
import { resolveUserFromAuthHeader } from "./authSession";
import { getOrganizationForUser } from "../../organization/service";
import { getPublicOrganizationJiraConfig } from "../../organization/jiraConfigStore";
import { getCompanyProfile } from "../../companyIntelligence/store";

const router = Router();

router.get("/", async (req, res) => {
  const user = resolveUserFromAuthHeader(req);
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
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

export default router;
