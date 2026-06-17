import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

afterEach(() => {
  window.history.pushState({}, "", "/");
  window.localStorage.clear();
});

describe("application routes", () => {
  it("redirects unauthenticated org URLs to login", async () => {
    window.history.pushState({}, "", "/agentos/pipelines");
    render(<App />);
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
  });

  it("redirects unauthenticated legacy /app URLs to login", async () => {
    window.history.pushState({}, "", "/app/pipelines");
    render(<App />);
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
  });
});
