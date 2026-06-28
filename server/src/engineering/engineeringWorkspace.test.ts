import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import {
  workspaceListDir,
  workspaceReadFile,
  workspaceApplyEdit,
  workspaceGrep,
  resetEngWorkspaceDir,
  sanitizeGitShellError,
} from "./engineeringWorkspace";

describe("engineeringWorkspace path guard (L4)", () => {
  let workspaceDir: string;

  it("setup temp workspace with nested file", () => {
    workspaceDir = mkdtempSync(join(tmpdir(), "eng-ws-"));
    const nested = join(workspaceDir, "src", "agents", "pm");
    mkdirSync(nested, { recursive: true });
    writeFileSync(
      join(nested, "handoffStatus.ts"),
      'export function isHandoffTransferred() { return true; }\n',
      "utf8"
    );
  });

  it("list_dir root includes src/", () => {
    const entries = workspaceListDir(workspaceDir, ".");
    assert.ok(entries.some((e) => e === "src/"), `expected src/ in ${entries.join(", ")}`);
  });

  it("list_dir subdirectory does not throw (Windows-safe guard)", () => {
    assert.doesNotThrow(() => workspaceListDir(workspaceDir, "src/agents/pm"));
  });

  it("read_file nested path returns content", () => {
    const content = workspaceReadFile(workspaceDir, "src/agents/pm/handoffStatus.ts");
    assert.match(content, /isHandoffTransferred/);
  });

  it("edit_file nested path applies change", () => {
    const result = workspaceApplyEdit(
      workspaceDir,
      "src/agents/pm/handoffStatus.ts",
      "export function isHandoffTransferred() { return true; }",
      "export function isHandoffTransferred() { return true; }\n\nexport function isTerminalHandoffStatus() { return false; }"
    );
    assert.equal(result.replaced, true);
    const updated = workspaceReadFile(workspaceDir, "src/agents/pm/handoffStatus.ts");
    assert.match(updated, /isTerminalHandoffStatus/);
  });

  it("rejects path traversal outside workspace", () => {
    assert.throws(
      () => workspaceReadFile(workspaceDir, "../../../etc/passwd"),
      /Path traversal denied/
    );
  });

  it("grep finds literal matches without shell grep", async () => {
    const matches = await workspaceGrep(workspaceDir, "isHandoffTransferred", "*.ts");
    assert.ok(matches.length >= 1);
  });

  it("edit_file matches across CRLF line endings", () => {
    const crlfDir = join(workspaceDir, "crlf");
    mkdirSync(crlfDir, { recursive: true });
    writeFileSync(join(crlfDir, "sample.ts"), "export const A = 1;\r\n", "utf8");
    const result = workspaceApplyEdit(
      workspaceDir,
      "crlf/sample.ts",
      "export const A = 1;\n",
      "export const A = 1;\nexport const B = 2;\n"
    );
    assert.equal(result.replaced, true);
    const content = readFileSync(join(crlfDir, "sample.ts"), "utf8");
    assert.match(content, /export const B = 2/);
    assert.ok(content.includes("\r\n"));
  });

  it("cleanup", () => {
    rmSync(workspaceDir, { recursive: true, force: true });
  });
});

describe("engineering workspace lifecycle", () => {
  it("resetEngWorkspaceDir removes a non-empty stale directory", () => {
    const staleDir = mkdtempSync(join(tmpdir(), "eng-stale-"));
    writeFileSync(join(staleDir, "leftover.txt"), "stale", "utf8");
    resetEngWorkspaceDir("pipeline-test", staleDir);
    assert.equal(existsSync(staleDir), false);
  });

  it("sanitizeGitShellError redacts embedded git credentials", () => {
    const raw =
      "Command failed: git clone https://x-access-token:github_pat_SECRET@github.com/org/repo.git .";
    const sanitized = sanitizeGitShellError(new Error(raw));
    assert.doesNotMatch(sanitized, /github_pat_SECRET/);
    assert.doesNotMatch(sanitized, /x-access-token:github_pat/);
  });
});
