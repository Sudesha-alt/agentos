import { useState } from "react";
import { settingsAdapter } from "../../../entities/settings";

export function useSaveSettings() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  async function save(settings) {
    setPending(true);
    setError(null);
    try {
      const next = await settingsAdapter.save(settings);
      setSavedAt(new Date());
      return next;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setPending(false);
    }
  }

  return { save, pending, error, savedAt };
}
