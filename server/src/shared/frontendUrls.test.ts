import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  frontendBaseUrl,
  frontendIntegrationUrl,
} from "./frontendUrls";

describe("frontendIntegrationUrl", () => {
  it("builds org-scoped integration paths", () => {
    const prev = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = "https://app.example.com/app";
    try {
      assert.equal(
        frontendIntegrationUrl("acme", "github"),
        "https://app.example.com/acme/settings/integrations/github"
      );
      assert.equal(
        frontendIntegrationUrl("acme", "jira"),
        "https://app.example.com/acme/settings/integrations/jira"
      );
      assert.equal(frontendBaseUrl(), "https://app.example.com");
    } finally {
      if (prev === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = prev;
    }
  });
});
