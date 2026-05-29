import { hierarchy } from "d3-hierarchy";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { voronoiTreemap } = require("d3-voronoi-treemap") as {
  voronoiTreemap: () => VoronoiTreemap;
};

type VoronoiTreemap = {
  (root: HierarchyRoot): void;
  clip(points: number[][]): VoronoiTreemap;
  maxIterationCount(n: number): VoronoiTreemap;
  convergenceRatio(n: number): VoronoiTreemap;
};

interface HierarchyRoot {
  descendants(): VoronoiNode[];
  sum(fn: (d: TreeDatum) => number): HierarchyRoot;
}

interface VoronoiNode {
  data: TreeDatum;
  depth: number;
  value?: number;
  polygon?: number[][];
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
}

interface TreeDatum {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  file?: unknown;
  children?: TreeDatum[];
}

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;
const MAX_VORONOI_FILES = 280;

export interface PolygonLayout {
  path: string;
  polygon: number[][];
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeVoronoiPolygons(
  root: TreeDatum,
  fileCount: number
): Map<string, PolygonLayout> {
  const map = new Map<string, PolygonLayout>();

  if (fileCount > MAX_VORONOI_FILES) {
    return map;
  }

  try {
    const h = hierarchy(root).sum((d) => {
      if (d.type === "file") return Math.max(d.size ?? 1, 1);
      return 0;
    }) as HierarchyRoot;

    const vt = voronoiTreemap()
      .clip([
        [0, 0],
        [0, CANVAS_HEIGHT],
        [CANVAS_WIDTH, CANVAS_HEIGHT],
        [CANVAS_WIDTH, 0],
      ])
      .maxIterationCount(40)
      .convergenceRatio(0.02);

    vt(h);

    for (const node of h.descendants()) {
      if (node.data.type !== "file" || !node.polygon?.length) continue;
      const polygon = node.polygon.map((p) => [p[0], p[1]] as [number, number]);
      const xs = polygon.map((p) => p[0]);
      const ys = polygon.map((p) => p[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const width = Math.max(1, Math.max(...xs) - x);
      const height = Math.max(1, Math.max(...ys) - y);
      map.set(node.data.path, { path: node.data.path, polygon, x, y, width, height });
    }
  } catch {
    /* fall back to rectangular treemap cells */
  }

  return map;
}
