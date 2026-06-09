import { getDb } from "../jira-intake/sqliteStore";

export interface CanaryRuntimeSettings {
  stagingBaseUrl: string;
  productionBaseUrl: string;
  authToken: string;
}

export interface CanaryRuntimeSettingsPublic {
  stagingBaseUrl: string;
  productionBaseUrl: string;
  hasAuthToken: boolean;
  configured: boolean;
  source: "database" | "environment" | "none";
}

let runtimeSettings: CanaryRuntimeSettings | null = null;

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function settingsFromEnv(): CanaryRuntimeSettings {
  return {
    stagingBaseUrl: normalizeUrl(
      process.env.CANARY_STAGING_BASE_URL?.trim() ||
        process.env.CANARY_BASE_URL?.trim() ||
        ""
    ),
    productionBaseUrl: normalizeUrl(
      process.env.CANARY_PRODUCTION_BASE_URL?.trim() || ""
    ),
    authToken: (
      process.env.CANARY_AUTH_TOKEN?.trim() ||
      process.env.CANARY_SYNTHETIC_USER_TOKEN?.trim() ||
      ""
    ),
  };
}

function settingsFromRow(row: {
  staging_base_url: string | null;
  production_base_url: string | null;
  auth_token: string | null;
}): CanaryRuntimeSettings {
  return {
    stagingBaseUrl: normalizeUrl(row.staging_base_url?.trim() || ""),
    productionBaseUrl: normalizeUrl(row.production_base_url?.trim() || ""),
    authToken: row.auth_token?.trim() || "",
  };
}

export function loadCanarySettingsFromStore(): CanaryRuntimeSettings {
  const row = getDb()
    .prepare(
      `SELECT staging_base_url, production_base_url, auth_token
       FROM canary_runtime_settings WHERE singleton_id = 1`
    )
    .get() as
    | {
        staging_base_url: string | null;
        production_base_url: string | null;
        auth_token: string | null;
      }
    | undefined;

  const fromDb = row ? settingsFromRow(row) : { stagingBaseUrl: "", productionBaseUrl: "", authToken: "" };
  const fromEnv = settingsFromEnv();

  runtimeSettings = {
    stagingBaseUrl: fromDb.stagingBaseUrl || fromEnv.stagingBaseUrl,
    productionBaseUrl: fromDb.productionBaseUrl || fromEnv.productionBaseUrl,
    authToken: fromDb.authToken || fromEnv.authToken,
  };

  return runtimeSettings;
}

export function getCanaryRuntimeSettings(): CanaryRuntimeSettings {
  if (!runtimeSettings) {
    return loadCanarySettingsFromStore();
  }
  return runtimeSettings;
}

export function getPublicCanarySettings(): CanaryRuntimeSettingsPublic {
  const settings = getCanaryRuntimeSettings();
  const row = getDb()
    .prepare(
      `SELECT staging_base_url, production_base_url, auth_token
       FROM canary_runtime_settings WHERE singleton_id = 1`
    )
    .get() as
    | {
        staging_base_url: string | null;
        production_base_url: string | null;
        auth_token: string | null;
      }
    | undefined;

  const hasDbValues = Boolean(
    row?.staging_base_url?.trim() ||
      row?.production_base_url?.trim() ||
      row?.auth_token?.trim()
  );
  const configured = Boolean(settings.stagingBaseUrl || settings.productionBaseUrl);
  let source: CanaryRuntimeSettingsPublic["source"] = "none";
  if (hasDbValues) {
    source = "database";
  } else if (settings.stagingBaseUrl || settings.productionBaseUrl || settings.authToken) {
    source = "environment";
  }

  return {
    stagingBaseUrl: settings.stagingBaseUrl,
    productionBaseUrl: settings.productionBaseUrl,
    hasAuthToken: Boolean(settings.authToken),
    configured,
    source,
  };
}

export function saveCanarySettings(input: {
  stagingBaseUrl?: string;
  productionBaseUrl?: string;
  authToken?: string;
}): CanaryRuntimeSettingsPublic {
  const current = getCanaryRuntimeSettings();
  const next: CanaryRuntimeSettings = {
    stagingBaseUrl:
      input.stagingBaseUrl !== undefined
        ? normalizeUrl(input.stagingBaseUrl.trim())
        : current.stagingBaseUrl,
    productionBaseUrl:
      input.productionBaseUrl !== undefined
        ? normalizeUrl(input.productionBaseUrl.trim())
        : current.productionBaseUrl,
    authToken:
      input.authToken !== undefined ? input.authToken.trim() : current.authToken,
  };

  getDb()
    .prepare(
      `INSERT INTO canary_runtime_settings (
        singleton_id, staging_base_url, production_base_url, auth_token, updated_at
      ) VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(singleton_id) DO UPDATE SET
        staging_base_url = excluded.staging_base_url,
        production_base_url = excluded.production_base_url,
        auth_token = excluded.auth_token,
        updated_at = excluded.updated_at`
    )
    .run(
      next.stagingBaseUrl || null,
      next.productionBaseUrl || null,
      next.authToken || null,
      new Date().toISOString()
    );

  runtimeSettings = next;
  return getPublicCanarySettings();
}
