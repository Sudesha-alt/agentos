import { DATA_MODE, DATA_MODES } from "../../shared/config/app";
import { apiPath } from "../../shared/config/apiBase";
import { fetchJson } from "../../shared/lib/fetchJson";
import { authHeaders } from "../../shared/lib/authHeaders";
import { useResource } from "../../shared/lib/useResource";
import { PILOT_PLAN } from "../../shared/config/billingPlans";

const STORAGE_KEY = "agentos.workspaceBilling";

const DEFAULT_BILLING = {
  planId: "pilot",
  runsUsed: 4,
  runsCap: PILOT_PLAN.pipelineRunsCap,
  pilotEndsAt: null,
  billingCycle: "monthly",
};

function readLocal() {
  if (typeof window === "undefined") return DEFAULT_BILLING;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_BILLING, ...JSON.parse(raw) } : DEFAULT_BILLING;
  } catch {
    return DEFAULT_BILLING;
  }
}

const restAdapter = {
  get: () => fetchJson(apiPath("/api", "/settings/billing"), { headers: authHeaders() }),
  save: (body) =>
    fetchJson(apiPath("/api", "/settings/billing"), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    }),
};

const mockAdapter = {
  get: async () => readLocal(),
  save: async (body) => {
    const next = { ...readLocal(), ...body };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    return { billing: next };
  },
};

const adapter = DATA_MODE === DATA_MODES.REST ? restAdapter : mockAdapter;

export function useWorkspaceBilling(options = {}) {
  return useResource(() => adapter.get().then((d) => d?.billing ?? d), [], {
    pollMs: options.pollMs,
  });
}

export async function saveWorkspaceBilling(patch) {
  return adapter.save(patch);
}

export const PLAN_IDS = ["pilot", "starter", "growth", "enterprise"];
