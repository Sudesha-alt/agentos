import "dotenv/config";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "../src/db/client";
import { saveGitCredentials } from "../src/git-integration/gitCredentialsStore";
import { gitClient } from "../src/integrations/gitProvider";

async function main() {
  const rows = (await prisma.$queryRawUnsafe(`
    SELECT token, workspace, "repoSlug", "defaultBranch"
    FROM "OrganizationGitConfig"
    WHERE "organizationId" = 'cmqfl5t3200012cf33bcr6g3g'
    LIMIT 1
  `)) as Array<{
    token: string;
    workspace: string;
    repoSlug: string;
    defaultBranch: string;
  }>;

  const r = rows[0];
  if (!r?.token) {
    console.log("No PAT");
    process.exit(1);
  }

  saveGitCredentials({
    provider: "github",
    workspace: r.workspace,
    repoSlug: r.repoSlug,
    token: r.token,
    authMethod: "pat",
    defaultBranch: r.defaultBranch,
    installationId: null,
  });

  const url = await gitClient.cloneUrl();
  const branch = `agentos/pat-git-test-${Date.now()}`;
  const dir = mkdtempSync(join(tmpdir(), "pat-push-"));

  try {
    execSync(`git clone --depth 1 --branch ${r.defaultBranch} "${url}" .`, {
      cwd: dir,
      stdio: "pipe",
    });
    execSync('git config user.email "pat-test@agentos.ai"', { cwd: dir, stdio: "pipe" });
    execSync('git config user.name "PATTest"', { cwd: dir, stdio: "pipe" });
    execSync(`git checkout -b ${branch}`, { cwd: dir, stdio: "pipe" });
    execSync(`echo pat-test > .pat-git-test.txt`, { cwd: dir, shell: true, stdio: "pipe" });
    execSync("git add . && git commit -m \"pat git push test\"", {
      cwd: dir,
      shell: true,
      stdio: "pipe",
    });
    execSync(`git push --set-upstream origin ${branch}`, { cwd: dir, stdio: "pipe" });
    console.log("GIT PUSH: PASS");
    console.log(`Branch: ${branch}`);
  } catch (err: unknown) {
    const e = err as { stderr?: Buffer; message?: string };
    console.log("GIT PUSH: FAIL");
    console.log(String(e.stderr?.toString() || e.message || err).slice(0, 600));
  } finally {
    rmSync(dir, { recursive: true, force: true });
    await prisma.$disconnect();
  }
}

main();
