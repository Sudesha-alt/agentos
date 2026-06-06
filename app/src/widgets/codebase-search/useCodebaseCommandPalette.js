import { createContext, useContext } from "react";

export const CodebaseCommandPaletteContext = createContext(null);

export function useCodebaseCommandPalette() {
  const ctx = useContext(CodebaseCommandPaletteContext);
  if (!ctx) {
    throw new Error("useCodebaseCommandPalette must be used within CodebaseCommandPaletteProvider");
  }
  return ctx;
}
