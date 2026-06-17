import { resolveGithubAccessToken } from "../../git-integration/gitCredentialsStore";
import { logger } from "../../utils/logger";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const DEFAULT_BATCH_SIZE = 30;

export type FetchedBlob = {
  path: string;
  content: string;
  byteSize: number;
  oid: string;
};

type GraphQlBlobResult = {
  data?: {
  repository?: {
    object?: {
      oid?: string;
      byteSize?: number;
      text?: string;
    } | null;
  } | null;
  };
  errors?: Array<{ message: string }>;
};

function buildBlobQuery(paths: string[], ref: string): string {
  const fields = paths
    .map((path, i) => {
      const alias = `f${i}`;
      const escaped = path.replace(/"/g, '\\"');
      return `${alias}: object(expression: "${ref}:${escaped}") {
        ... on Blob { oid byteSize text }
      }`;
    })
    .join("\n");

  return `query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      ${fields}
    }
  }`;
}

export async function fetchFilesAtRef(input: {
  owner: string;
  repo: string;
  ref: string;
  paths: string[];
  batchSize?: number;
}): Promise<Map<string, FetchedBlob>> {
  const result = new Map<string, FetchedBlob>();
  if (!input.paths.length) return result;

  const token = await resolveGithubAccessToken();
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;
  const ref = input.ref;

  for (let i = 0; i < input.paths.length; i += batchSize) {
    const batch = input.paths.slice(i, i + batchSize);
    const query = buildBlobQuery(batch, ref);

    try {
      const res = await fetch(GITHUB_GRAPHQL_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: { owner: input.owner, repo: input.repo },
        }),
      });

      if (!res.ok) {
        logger.warn({ status: res.status, batch: batch.length }, "GitHub GraphQL blob fetch failed");
        continue;
      }

      const json = (await res.json()) as {
        data?: { repository?: Record<string, GraphQlBlobResult["data"]> };
        errors?: Array<{ message: string }>;
      };

      if (json.errors?.length) {
        logger.warn({ errors: json.errors }, "GitHub GraphQL errors");
      }

      const repo = json.data?.repository;
      if (!repo) continue;

      for (let j = 0; j < batch.length; j++) {
        const path = batch[j]!;
        const node = repo[`f${j}`] as { oid?: string; byteSize?: number; text?: string } | null;
        if (!node?.text) continue;
        result.set(path, {
          path,
          content: node.text,
          byteSize: node.byteSize ?? node.text.length,
          oid: node.oid ?? "",
        });
      }
    } catch (err) {
      logger.warn({ err, batch: batch.length }, "GitHub GraphQL request error");
    }
  }

  return result;
}

export async function fetchSingleFileAtRef(input: {
  owner: string;
  repo: string;
  ref: string;
  path: string;
}): Promise<FetchedBlob | null> {
  const map = await fetchFilesAtRef({
    owner: input.owner,
    repo: input.repo,
    ref: input.ref,
    paths: [input.path],
    batchSize: 1,
  });
  return map.get(input.path) ?? null;
}
