import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  pickCompileCommand,
  resolveCompileCwd,
  resolveCompileSubdir,
} from "./workspaceCompile";

describe("workspaceCompile", () => {
  it("resolves server/ in monorepo layout", () => {
    const root = mkdtempSync(join(tmpdir(), "compile-mono-"));
    mkdirSync(join(root, "server"), { recursive: true });
    writeFileSync(join(root, "server", "package.json"), '{"name":"server"}', "utf8");
    assert.equal(resolveCompileCwd(root), join(root, "server"));
    assert.equal(resolveCompileSubdir(root), "server");
    rmSync(root, { recursive: true, force: true });
  });

  it("resolves workspace root for single-package repos", () => {
    const root = mkdtempSync(join(tmpdir(), "compile-single-"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ scripts: { lint: "eslint ." } }),
      "utf8"
    );
    assert.equal(resolveCompileCwd(root), root);
    assert.equal(resolveCompileSubdir(root), undefined);
    rmSync(root, { recursive: true, force: true });
  });

  it("prefers typecheck over build for safety priority", () => {
    const root = mkdtempSync(join(tmpdir(), "compile-scripts-"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        scripts: { build: "next build", typecheck: "tsc --noEmit", lint: "eslint ." },
      }),
      "utf8"
    );
    assert.equal(pickCompileCommand(root, "safety"), "npm run typecheck");
    rmSync(root, { recursive: true, force: true });
  });

  it("falls back to lint for Next.js-style repos", () => {
    const root = mkdtempSync(join(tmpdir(), "compile-next-"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ scripts: { lint: "eslint", build: "next build" } }),
      "utf8"
    );
    writeFileSync(join(root, "tsconfig.json"), "{}", "utf8");
    assert.equal(pickCompileCommand(root, "safety"), "npm run lint");
    rmSync(root, { recursive: true, force: true });
  });
});
