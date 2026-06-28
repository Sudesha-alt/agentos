import "dotenv/config";
import { prisma } from "../src/db/client";
import { loadOrganizationGitConfig } from "../src/organization/gitConfigStore";

async function main() {
  let orgConfigs: unknown[] = [];
  try {
    orgConfigs = await prisma.$queryRawUnsafe(`
      SELECT "organizationId", workspace, "repoSlug", "authMethod", "defaultBranch",
             (token <> '') AS has_token, "installationId", "updatedAt"
      FROM "OrganizationGitConfig"
      ORDER BY "updatedAt" DESC
      LIMIT 10
    `);
  } catch (err) {
    console.log("OrganizationGitConfig query failed:", err instanceof Error ? err.message : err);
  }

  console.log(JSON.stringify(orgConfigs, null, 2));

  const installs = await prisma.githubInstallation.findMany({
    orderBy: { updatedAt: "desc" },
    take: 3,
    select: {
      installationId: true,
      accountLogin: true,
      selectedRepoOwner: true,
      selectedRepoName: true,
      updatedAt: true,
    },
  });
  console.log("\nRecent GitHub App installations:");
  console.log(JSON.stringify(installs, null, 2));

  if (orgConfigs.length > 0) {
    const first = orgConfigs[0] as { organizationId: string };
    const loaded = await loadOrganizationGitConfig(first.organizationId);
    console.log("\nloadOrganizationGitConfig sample:", {
      authMethod: loaded?.authMethod,
      repo: loaded ? `${loaded.workspace}/${loaded.repoSlug}` : null,
      hasToken: Boolean(loaded?.token),
    });
  }

  await prisma.$disconnect();
}

main();
