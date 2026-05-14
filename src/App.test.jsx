import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";
import { AUTH_SESSION_STORAGE_KEY } from "./entities/auth";

afterEach(() => {
  window.history.pushState({}, "", "/");
  window.localStorage.clear();
});

describe("application routes", () => {
  it("redirects unauthenticated users to login", async () => {
    window.history.pushState({}, "", "/app/pipelines");
    render(<App />);
    expect(
      await screen.findByText("Sign in to your dashboard.")
    ).toBeInTheDocument();
  });

  it("takes the user to the dashboard after login", async () => {
    window.history.pushState({}, "", "/login");
    render(<App />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "customer@agentos.ai" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText(/Workspace overview/i)
    ).toBeInTheDocument();
  });

  it("opens protected routes when a session already exists", async () => {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        token: "mock_token",
        issuedAt: new Date().toISOString(),
        user: {
          id: "usr_customer",
          email: "customer@agentos.ai",
          name: "Customer",
        },
      })
    );

    window.history.pushState({}, "", "/app/settings");
    render(<App />);

    expect(
      await screen.findByText("Workspace configuration.")
    ).toBeInTheDocument();
  });
});
