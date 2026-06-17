import { describe, expect, it } from "vitest";
import {
  frontendBaseUrl,
  frontendIntegrationUrl,
} from "./frontendUrls";

describe("frontendIntegrationUrl", () => {
  it("builds org-scoped integration paths", () => {
    const prev = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = "https://app.example.com/app";
    try {
      expect(frontendIntegrationUrl("acme", "github")).toBe(
        "https://app.example.com/acme/settings/integrations/github"
      );
      expect(frontendIntegrationUrl("acme", "jira")).toBe(
        "https://app.example.com/acme/settings/integrations/jira"
      );
      expect(frontendBaseUrl()).toBe("https://app.example.com");
    } finally {
      if (prev === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = prev;
    }
  });
});
