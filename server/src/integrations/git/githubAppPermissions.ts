/** Canonical GitHub App repository permissions AgentOS requires. */
export const GITHUB_APP_REPOSITORY_PERMISSIONS = {
  contents: "write",
  metadata: "read",
  pull_requests: "write",
  actions: "read",
  workflows: "write",
  repository_hooks: "write",
} as const;

export const GITHUB_APP_EVENTS = ["push", "pull_request"] as const;

export type GithubPermissionLevel = "read" | "write" | "admin";

export type GithubAppPermissionCheck = {
  ok: boolean;
  missing: string[];
  current: Record<string, string>;
  required: Record<string, string>;
  fixUrl?: string;
};

const PERMISSION_LABELS: Record<string, string> = {
  contents: "Contents (Code)",
  metadata: "Metadata",
  pull_requests: "Pull requests",
  actions: "Actions",
  workflows: "Workflows",
  repository_hooks: "Repository hooks",
};

export function githubAppPermissionLabels(): Array<{
  key: string;
  label: string;
  required: string;
}> {
  return Object.entries(GITHUB_APP_REPOSITORY_PERMISSIONS).map(([key, required]) => ({
    key,
    label: PERMISSION_LABELS[key] ?? key,
    required,
  }));
}

export function githubAppPermissionsSummary(): string[] {
  return githubAppPermissionLabels().map(
    ({ label, required }) =>
      `${label} (${required === "write" ? "read & write" : "read"})`
  );
}

function levelRank(level: string | undefined): number {
  if (level === "write" || level === "admin") return 2;
  if (level === "read") return 1;
  return 0;
}

/** Returns false when installation lacks permissions needed for Ananta push + PR flow. */
export function evaluateGithubAppPermissions(
  permissions: Record<string, string> | null | undefined,
  appSlug?: string | null
): GithubAppPermissionCheck {
  const current = permissions ?? {};
  const required = { ...GITHUB_APP_REPOSITORY_PERMISSIONS };
  const missing: string[] = [];

  for (const [key, need] of Object.entries(required)) {
    const have = current[key];
    if (levelRank(have) < levelRank(need)) {
      missing.push(`${key} (${need})`);
    }
  }

  const fixUrl = appSlug
    ? `https://github.com/settings/apps/${encodeURIComponent(appSlug)}/permissions`
    : undefined;

  return {
    ok: missing.length === 0,
    missing,
    current,
    required,
    fixUrl,
  };
}

/** Manifest payload for GitHub App creation (manifest flow). */
export function buildGithubAppManifest(input: {
  name: string;
  url: string;
  webhookUrl: string;
  setupUrl: string;
  callbackUrl: string;
  description?: string;
}): Record<string, unknown> {
  return {
    name: input.name,
    url: input.url,
    description:
      input.description ??
      "AgentOS — codebase intelligence, engineering agent push, and QA.",
    hook_attributes: { url: input.webhookUrl, active: true },
    redirect_url: input.setupUrl,
    callback_urls: [input.callbackUrl],
    public: false,
    default_permissions: { ...GITHUB_APP_REPOSITORY_PERMISSIONS },
    default_events: [...GITHUB_APP_EVENTS],
  };
}
