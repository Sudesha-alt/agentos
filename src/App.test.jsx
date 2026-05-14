import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

afterEach(() => {
  window.history.pushState({}, "", "/");
});

describe("application routes", () => {
  it("renders the pipelines workspace route", () => {
    window.history.pushState({}, "", "/app/pipelines");
    render(<App />);
    expect(
      screen.getByText("Every ticket the system has touched.")
    ).toBeInTheDocument();
  });

  it("renders the settings workspace route", async () => {
    window.history.pushState({}, "", "/app/settings");
    render(<App />);
    expect(
      await screen.findByText("Workspace configuration.")
    ).toBeInTheDocument();
  });
});
