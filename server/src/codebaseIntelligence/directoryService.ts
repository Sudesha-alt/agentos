import { prisma } from "../db/client";
import { requireRepoScope } from "./repoScope";

const prismaAny = prisma as any;

export type DirectoryEntry = {
  name: string;
  path: string;
  fileCount: number;
};

export type FileEntry = {
  name: string;
  path: string;
  language: string | null;
  size: number;
  hasSummary: boolean;
};

export type DirectoryListing = {
  path: string;
  branch: string;
  directories: DirectoryEntry[];
  files: FileEntry[];
};

export type ImportConnection = {
  path: string;
  items: string[];
};

export type FileConnections = {
  path: string;
  branch: string;
  outgoing: ImportConnection[];
  incoming: ImportConnection[];
};

type ImportRecord = { from: string; items: string[] };

export function resolveImportPath(
  from: string,
  target: string,
  paths: Set<string>
): string | null {
  if (paths.has(target)) return target;
  const base = from.split("/").slice(0, -1);
  const candidate = [...base, target.replace(/^\.\//, "")].join("/");
  if (paths.has(candidate)) return candidate;
  return null;
}

export function parseImports(raw: unknown): ImportRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      if (typeof record.from !== "string") return null;
      const items = Array.isArray(record.items)
        ? record.items.filter((i): i is string => typeof i === "string")
        : [];
      return { from: record.from, items };
    })
    .filter((r): r is ImportRecord => r !== null);
}

function normalizeDirPath(dirPath: string): string {
  const trimmed = dirPath.trim().replace(/\/+$/, "");
  return trimmed;
}

export async function getDirectoryListing(
  branchName: string,
  dirPath = ""
): Promise<DirectoryListing> {
  const { repoOwner, repoName } = requireRepoScope();
  const normalized = normalizeDirPath(dirPath);
  const prefix = normalized ? `${normalized}/` : "";

  const rows = await prismaAny.codebaseFile.findMany({
    where: {
      repoOwner,
      repoName,
      branchName,
      isDeleted: false,
      ...(normalized
        ? { filePath: { startsWith: prefix } }
        : {}),
    },
    select: {
      filePath: true,
      language: true,
      size: true,
      summary: true,
    },
    orderBy: { filePath: "asc" },
  });

  const dirCounts = new Map<string, number>();
  const dirNames = new Map<string, string>();
  const files: FileEntry[] = [];

  for (const row of rows) {
    const relative = normalized ? row.filePath.slice(prefix.length) : row.filePath;
    if (!relative) continue;

    const slash = relative.indexOf("/");
    if (slash === -1) {
      files.push({
        name: relative,
        path: row.filePath,
        language: row.language ?? null,
        size: row.size,
        hasSummary: Boolean(row.summary),
      });
    } else {
      const name = relative.slice(0, slash);
      const childPath = normalized ? `${normalized}/${name}` : name;
      dirNames.set(name, childPath);
      dirCounts.set(name, (dirCounts.get(name) ?? 0) + 1);
    }
  }

  const directories: DirectoryEntry[] = [...dirNames.entries()]
    .map(([name, path]) => ({
      name,
      path,
      fileCount: dirCounts.get(name) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  files.sort((a, b) => a.name.localeCompare(b.name));

  return {
    path: normalized,
    branch: branchName,
    directories,
    files,
  };
}

export async function getFileConnections(
  branchName: string,
  filePath: string
): Promise<FileConnections> {
  const { repoOwner, repoName } = requireRepoScope();

  const [targetFile, allFiles] = await Promise.all([
    prismaAny.codebaseFile.findUnique({
      where: {
        repoOwner_repoName_filePath_branchName: {
          repoOwner,
          repoName,
          filePath,
          branchName,
        },
      },
      select: { imports: true },
    }),
    prismaAny.codebaseFile.findMany({
      where: { repoOwner, repoName, branchName, isDeleted: false },
      select: { filePath: true, imports: true },
    }),
  ]);

  const paths = new Set<string>(allFiles.map((f: { filePath: string }) => f.filePath));

  const outgoing: ImportConnection[] = [];
  if (targetFile) {
    for (const imp of parseImports(targetFile.imports)) {
      const resolved = resolveImportPath(filePath, imp.from, paths);
      if (resolved) {
        outgoing.push({ path: resolved, items: imp.items });
      }
    }
  }

  const incoming: ImportConnection[] = [];
  for (const file of allFiles) {
    if (file.filePath === filePath) continue;
    for (const imp of parseImports(file.imports)) {
      const resolved = resolveImportPath(file.filePath, imp.from, paths);
      if (resolved === filePath) {
        incoming.push({ path: file.filePath, items: imp.items });
      }
    }
  }

  outgoing.sort((a, b) => a.path.localeCompare(b.path));
  incoming.sort((a, b) => a.path.localeCompare(b.path));

  return {
    path: filePath,
    branch: branchName,
    outgoing,
    incoming,
  };
}
