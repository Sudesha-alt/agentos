export type AtlassianAccessibleResource = {
  id: string;
  url: string;
  name: string;
  scopes: string[];
  avatarUrl?: string;
};

export async function fetchAtlassianAccessibleResources(
  accessToken: string
): Promise<AtlassianAccessibleResource[]> {
  const res = await fetch(
    "https://api.atlassian.com/oauth/token/accessible-resources",
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    throw new Error(`Atlassian accessible-resources parse error: ${text}`);
  }

  if (!res.ok) {
    const obj = data as { message?: string } | null;
    throw new Error(
      `Atlassian accessible-resources ${res.status}: ${obj?.message || text}`
    );
  }

  if (!Array.isArray(data)) return [];

  return data
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id ?? ""),
        url: String(item.url ?? "").replace(/\/+$/, ""),
        name: String(item.name ?? ""),
        scopes: Array.isArray(item.scopes) ? item.scopes.map(String) : [],
        avatarUrl: item.avatarUrl ? String(item.avatarUrl) : undefined,
      };
    })
    .filter((r) => r.id && r.url);
}

export function pickJiraCloudResource(
  resources: AtlassianAccessibleResource[]
): AtlassianAccessibleResource | null {
  const withJiraScopes = resources.filter((r) =>
    r.scopes.some((s) => s.startsWith("read:jira") || s.startsWith("write:jira"))
  );
  if (withJiraScopes.length === 1) return withJiraScopes[0];
  if (withJiraScopes.length > 1) return withJiraScopes[0];

  const atlassianNet = resources.filter((r) =>
    r.url.includes(".atlassian.net")
  );
  return atlassianNet[0] ?? resources[0] ?? null;
}
