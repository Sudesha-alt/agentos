import { SettingsSchema } from "../../contracts";
import { DATA_MODE, DATA_MODES } from "../../shared/config/app";
import { apiPath } from "../../shared/config/apiBase";
import { fetchJson } from "../../shared/lib/fetchJson";
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
  canaryStagingBaseUrl: "",
  canaryProductionBaseUrl: "",
  canaryAuthToken: "",
});

function readLocalSettings() {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return SettingsSchema.parse({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeLocalSettings(settings) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }
}

async function fetchServerCanarySettings() {
  if (DATA_MODE !== DATA_MODES.REST) return null;
  try {
    const data = await fetchJson(apiPath("/api/settings"));
    return data?.canary ?? null;
  } catch {
    return null;
  }
}

async function saveServerCanarySettings(settings) {
  if (DATA_MODE !== DATA_MODES.REST) return null;
  const body = {
    canaryStagingBaseUrl: settings.canaryStagingBaseUrl,
    canaryProductionBaseUrl: settings.canaryProductionBaseUrl,
  };
  if (settings.canaryAuthToken?.trim()) {
    body.canaryAuthToken = settings.canaryAuthToken;
  }
  return fetchJson(apiPath("/api/settings"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const settingsAdapter = {
  async get() {
    const local = readLocalSettings();
    const serverCanary = await fetchServerCanarySettings();
    if (!serverCanary) return local;

    return SettingsSchema.parse({
      ...local,
      canaryStagingBaseUrl: serverCanary.stagingBaseUrl ?? local.canaryStagingBaseUrl,
      canaryProductionBaseUrl:
        serverCanary.productionBaseUrl ?? local.canaryProductionBaseUrl,
      canaryAuthToken: local.canaryAuthToken,
    });
  },
  async save(settings) {
    const parsed = SettingsSchema.parse(settings);
    writeLocalSettings(parsed);
    await saveServerCanarySettings(parsed);
    return parsed;
  },
};

export { settingsAdapter };

export function useSettings() {
  return useResource(() => settingsAdapter.get(), [], {});
}
