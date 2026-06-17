import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AppCompatRedirect from "./AppCompatRedirect";

vi.mock("../providers/useAuth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../providers/useAuth";

describe("AppCompatRedirect", () => {
  it("sends unauthenticated users to login", () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      loading: false,
      hasOrganization: false,
      organization: null,
    });

    render(
      <MemoryRouter initialEntries={["/app/pipelines"]}>
        <Routes>
          <Route path="/app/*" element={<AppCompatRedirect />} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("rewrites legacy /app paths to the session org slug", () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      hasOrganization: true,
      organization: { slug: "acme" },
    });

    render(
      <MemoryRouter initialEntries={["/app/settings"]}>
        <Routes>
          <Route path="/app/*" element={<AppCompatRedirect />} />
          <Route path="/acme/settings" element={<div>Org settings</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Org settings")).toBeInTheDocument();
  });
});
