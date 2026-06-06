import { SettingsSchema } from "../../contracts";
import { useResource } from "../../shared/lib/useResource";

const STORAGE_KEY = "agentos.settings";

export const DEFAULT_SETTINGS = SettingsSchema.parse({
  jiraBaseUrl: "",
  jiraEmail: "",
  jiraApiToken: "",
  webhookSecret: "",
  model: "gpt-5.1",
  prdConfidenceThreshold: 0.7,
  implementationConfidenceThreshold: 0.7,
  qaCoverageThreshold: 95,
});

const localSettingsAdapter = {
  async get() {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    try {
      return SettingsSchema.parse({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
  async save(settings) {
    const parsed = SettingsSchema.parse(settings);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  },
};

export const settingsAdapter = localSettingsAdapter;

export function useSettings() {
  return useResource(() => settingsAdapter.get(), [], {});
}
