import type { GitPushFile } from "./types";

function readPathCandidate(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return "";
}

/** Normalize repo-relative paths from tool/agent payloads. */
export function resolveToolFilePath(input: Record<string, unknown>): string {
  for (const key of ["file_path", "path", "filePath", "target_path"] as const) {
    const candidate = readPathCandidate(input[key]);
    if (candidate) {
      return candidate.replace(/\\/g, "/").replace(/^\/+/, "");
    }
  }
  return "";
}

export function normalizePushFiles(files: GitPushFile[]): GitPushFile[] {
  const byPath = new Map<string, GitPushFile>();
  const rejected: string[] = [];

  for (const file of files) {
    const filePath = resolveToolFilePath({ file_path: file.filePath });
    if (!filePath) {
      rejected.push(JSON.stringify(file.filePath ?? ""));
      continue;
    }
    byPath.set(filePath, { filePath, content: file.content });
  }

  if (rejected.length > 0) {
    throw new Error(
      `Cannot push files with blank paths: ${rejected.join(", ")}. ` +
        "Each file must have a repo-relative path (e.g. docs/guide.md)."
    );
  }

  if (byPath.size === 0) {
    throw new Error("Cannot push — no valid files with non-empty paths.");
  }

  return [...byPath.values()];
}
