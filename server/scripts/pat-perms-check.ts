import "dotenv/config";
import { prisma } from "../src/db/client";
import { saveGitCredentials } from "../src/git-integration/gitCredentialsStore";

async function main() {
  const rows = (await prisma.$queryRawUnsafe(`
    SELECT workspace, "repoSlug", token, "authMethod", "defaultBranch"
    FROM "OrganizationGitConfig"
    WHERE "organizationId" = 'cmqfl5t3200012cf33bcr6g3g'
    LIMIT 1
  `)) as Array<{
    workspace: string;
    repoSlug: string;
    token: string;
    authMethod: string;
    defaultBranch: string;
  }>;

  const row = rows[0];
  if (!row?.token) {
    console.log("No PAT found for org");
    process.exit(1);
  }

  saveGitCredentials({
    provider: "github",
    workspace: row.workspace,
    repoSlug: row.repoSlug,
    token: row.token,
    authMethod: "pat",
    defaultBranch: row.defaultBranch,
    installationId: null,
  });

  const res = await fetch(
    `https://api.github.com/repos/${row.workspace}/${row.repoSlug}`,
    {
      headers: {
        Authorization: `Bearer ${row.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  const body = await res.json();
  console.log("Repo:", `${row.workspace}/${row.repoSlug}`);
  console.log("Auth method:", row.authMethod);
  console.log("API status:", res.status);
  console.log("Permissions:", body.permissions ?? body.message);

  const refRes = await fetch(
    `https://api.github.com/repos/${row.workspace}/${row.repoSlug}/git/refs`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${row.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: `refs/heads/agentos/pat-check-${Date.now()}`,
        sha: (
          await (
            await fetch(
              `https://api.github.com/repos/${row.workspace}/${row.repoSlug}/git/ref/heads/${row.defaultBranch}`,
              {
                headers: {
                  Authorization: `Bearer ${row.token}`,
                  Accept: "application/vnd.github+json",
                  "X-GitHub-Api-Version": "2022-11-28",
                },
              }
            )
          ).json()
        ).object.sha,
      }),
    }
  );
  const refBody = await refRes.json();
  console.log("Create branch test:", refRes.status, refRes.ok ? "PASS" : refBody.message);

  if (refRes.ok && refBody.ref) {
    const branch = refBody.ref.replace("refs/heads/", "");
    await fetch(
      `https://api.github.com/repos/${row.workspace}/${row.repoSlug}/git/refs/heads/${encodeURIComponent(branch)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${row.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
  }

  await prisma.$disconnect();
}

main();
