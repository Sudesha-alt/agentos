import { describe, expect, it } from "vitest";
import {
  appRelativePath,
  isReservedSlug,
  orgPath,
  sessionHomePath,
} from "./orgPaths";

describe("orgPaths", () => {
  it("builds org-scoped paths", () => {
    expect(orgPath("acme", "pipelines")).toBe("/acme/pipelines");
    expect(orgPath("acme")).toBe("/acme");
  });

  it("rejects reserved slugs", () => {
    expect(isReservedSlug("login")).toBe(true);
    expect(isReservedSlug("acme")).toBe(false);
  });

  it("strips org slug for nav matching", () => {
    expect(appRelativePath("/acme/pipelines")).toBe("/pipelines");
    expect(appRelativePath("/app/settings")).toBe("/settings");
  });

  it("resolves session home path", () => {
    expect(
      sessionHomePath({
        organization: { slug: "acme" },
      })
    ).toBe("/acme");
    expect(sessionHomePath(null)).toBe("/onboarding");
  });
});
