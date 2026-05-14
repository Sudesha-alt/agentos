import { afterEach, describe, expect, it } from "vitest";
import { AUTH_SESSION_STORAGE_KEY, authAdapter } from "./index";

afterEach(() => {
  window.localStorage.clear();
});

describe("auth adapter", () => {
  it("starts without a session", async () => {
    expect(await authAdapter.getSession()).toBeNull();
  });

  it("persists a mock session after login", async () => {
    const session = await authAdapter.login({
      email: "customer@agentos.ai",
      password: "password123",
    });

    expect(session.user.email).toBe("customer@agentos.ai");
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toContain(
      "customer@agentos.ai"
    );

    const restored = await authAdapter.getSession();
    expect(restored?.user.name).toBe("Customer");
  });
});
