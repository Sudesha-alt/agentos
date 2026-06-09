import type { CanaryEnvironment } from "./types";
import { getCanaryRuntimeSettings } from "./settingsStore";

export function isCanaryEnabled(): boolean {
  return process.env.CANARY_ENABLED !== "false";
}

export function resolveCanaryTargetUrl(environment: CanaryEnvironment): string | null {
  const settings = getCanaryRuntimeSettings();

  if (environment === "production") {
    return settings.productionBaseUrl || null;
  }
  if (environment === "preview" || environment === "feature_branch") {
    const template = process.env.CANARY_PREVIEW_URL_TEMPLATE?.trim();
    const branch = process.env.CANARY_DEFAULT_BRANCH?.trim() || "main";
    if (template) {
      return template.replace("{branch}", branch);
    }
  }
  return settings.stagingBaseUrl || null;
}

export function resolveCanaryAuthHeader(): Record<string, string> {
  const token = getCanaryRuntimeSettings().authToken;
  if (!token) return {};
  if (token.toLowerCase().startsWith("bearer ")) {
    return { Authorization: token };
  }
  return { Authorization: `Bearer ${token}` };
}

export function getCanaryLightIntervalMs(): number {
  const raw = Number(process.env.CANARY_LIGHT_INTERVAL_MS ?? 2 * 60 * 60 * 1000);
  return raw > 0 ? raw : 0;
}

export function getCanaryDeepCronHour(): number {
  const raw = Number(process.env.CANARY_DEEP_CRON_HOUR ?? 2);
  return Number.isFinite(raw) && raw >= 0 && raw <= 23 ? raw : 2;
}

export function getCanaryProductionIntervalMs(): number {
  const raw = Number(process.env.CANARY_PRODUCTION_INTERVAL_MS ?? 12 * 60 * 60 * 1000);
  return raw > 0 ? raw : 0;
}

export const MAX_CANARY_HYPOTHESES = Number(process.env.CANARY_MAX_HYPOTHESES ?? 12);
export const MAX_CANARY_TOOL_CALLS = Number(process.env.CANARY_MAX_TOOL_CALLS ?? 35);
