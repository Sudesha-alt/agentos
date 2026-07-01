import "dotenv/config";
import { prisma } from "../src/db/client";
import { saveGitCredentials } from "../src/git-integration/gitCredentialsStore";
import { gitClient } from "../src/integrations/gitProvider";
import { TEST_REPO_BRANCH, TEST_REPO_NAME, TEST_REPO_OWNER } from "./testRepoConfig";

const BRANCH = process.argv[2]?.trim() || "agentos/ag-61";
const FILE = "docs/curriculum/foundation-12-weeks.md";

async function main() {
  const rows = (await prisma.$queryRawUnsafe(`
    SELECT workspace, "repoSlug", token, "defaultBranch"
    FROM "OrganizationGitConfig"
    WHERE token <> '' AND "authMethod" = 'pat'
    ORDER BY "updatedAt" DESC LIMIT 1
  `)) as Array<{ workspace: string; repoSlug: string; token: string; defaultBranch: string }>;
  const row = rows[0];
  if (!row) throw new Error("No PAT");
  saveGitCredentials({
    provider: "github",
    workspace: row.workspace,
    repoSlug: row.repoSlug,
    token: row.token,
    authMethod: "pat",
    defaultBranch: row.defaultBranch || TEST_REPO_BRANCH,
    installationId: null,
  });
  console.log(`Configured: ${row.workspace}/${row.repoSlug} (default=${row.defaultBranch})`);

  for (const branch of [BRANCH, "agentos/ag-61", TEST_REPO_BRANCH, "main"]) {
    try {
      const file = await gitClient.getFileContent(FILE, branch);
      console.log(`${branch}: FILE OK (${file.content.length} chars)`);
    } catch (e) {
      console.log(`${branch}: FILE MISSING — ${(e as Error).message.slice(0, 100)}`);
    }
    try {
      const tree = await gitClient.getRepoTree(branch);
      console.log(`${branch}: tree entries=${tree.length}`);
      if (branch.includes("ag-61")) {
        const docs = tree
          .filter((t) => t.path.startsWith("docs/"))
          .map((t) => t.path);
        const curriculum = tree
          .filter((t) => t.path.includes("curriculum") || t.path.includes("foundation"))
          .map((t) => t.path);
        console.log(`  docs/* (${docs.length}):`, docs.slice(0, 15).join(", ") || "(none)");
        console.log(`  curriculum/foundation:`, curriculum.join(", ") || "(none)");
      }
    } catch (e) {
      console.log(`${branch}: tree FAIL — ${(e as Error).message.slice(0, 100)}`);
    }
  }
}

main()
  .finally(() => prisma.$disconnect());
