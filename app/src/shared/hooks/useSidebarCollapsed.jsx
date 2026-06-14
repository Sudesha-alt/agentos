import { createContext, useCallback, useContext, useState } from "react";

const STORAGE_KEY = "agentos.sidebarCollapsed";

const SidebarContext = createContext(null);

function readStoredCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistCollapsed(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* ignore quota / private mode */
  }
}

export function SidebarProvider({ children }) {
  const [collapsed, setCollapsedState] = useState(readStoredCollapsed);

  const setCollapsed = useCallback((value) => {
    setCollapsedState(value);
    persistCollapsed(value);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      persistCollapsed(next);
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, toggleCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarCollapsed() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebarCollapsed must be used within SidebarProvider");
  }
  return ctx;
}
