import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectVerifiedRepoPaths,
  sanitizeTaskBreakdownFiles,
} from "./verifiedRepoPaths";

describe("verifiedRepoPaths", () => {
  it("collects paths from codebase analysis and impact only", () => {
    const verified = collectVerifiedRepoPaths({
      enrichedPrdDocument: {
        pmCodebaseAnalysis: {
          relevantModules: [{ path: "src/app/auth/page.tsx", reason: "auth UI", role: "primary" }],
          suggestedFirstFile: "src/lib/auth/auth.ts",
        },
        pmCodebaseImpact: {
          affectedFiles: [{ path: "src/app/api/auth/[...all]/route.ts" }],
        },
      },
    } as never);

    assert.ok(verified.has("src/app/auth/page.tsx"));
    assert.ok(verified.has("src/lib/auth/auth.ts"));
    assert.ok(verified.has("src/app/api/auth/[...all]/route.ts"));
  });

  it("strips unverified task breakdown paths", () => {
    const verified = new Set(["src/app/auth/page.tsx"]);
    const tasks = sanitizeTaskBreakdownFiles(
      [
        {
          id: "TASK-1",
          title: "Auth",
          files: ["server/auth/google/service.ts", "src/app/auth/page.tsx"],
        },
      ],
      verified
    );
    assert.deepEqual(tasks[0]?.files, ["src/app/auth/page.tsx"]);
  });

  it("clears all task files when nothing is verified", () => {
    const tasks = sanitizeTaskBreakdownFiles(
      [{ id: "TASK-1", title: "Auth", files: ["server/auth/index.ts"] }],
      new Set()
    );
    assert.deepEqual(tasks[0]?.files, []);
  });
});
