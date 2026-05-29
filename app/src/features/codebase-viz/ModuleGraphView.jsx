import { useEffect, useRef } from "react";
import { forceCenter, forceLink, forceManyBody, forceSimulation } from "d3";

/**
 * Module-level relationship graph — collapsed clusters, not a file hairball.
 */
export default function ModuleGraphView({ nodes, edges, highlightPaths, onSelectModule }) {
  const svgRef = useRef(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !nodes?.length) return;

    const width = svg.clientWidth || 800;
    const height = svg.clientHeight || 480;

    const modules = buildModules(nodes);
    const moduleEdges = buildModuleEdges(edges);

    const simNodes = modules.map((m) => ({ ...m, x: width / 2, y: height / 2 }));
    const simLinks = moduleEdges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));

    const simulation = forceSimulation(simNodes)
      .force("charge", forceManyBody().strength(-120))
      .force("center", forceCenter(width / 2, height / 2))
      .force(
        "link",
        forceLink(simLinks)
          .id((d) => d.id)
          .distance(90)
          .strength(0.4)
      );

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.appendChild(g);

    const linkEls = simLinks.map((link) => {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("stroke", "rgba(148, 163, 184, 0.45)");
      line.setAttribute("stroke-width", String(Math.min(6, 1 + link.weight)));
      g.appendChild(line);
      return { line, link };
    });

    const nodeEls = simNodes.map((node) => {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.style.cursor = "pointer";
      const r = 14 + Math.min(30, node.fileCount * 0.8);
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      const inbound = moduleEdges.filter((e) => e.target === node.id).length;
      circle.setAttribute("r", String(r));
      circle.setAttribute(
        "fill",
        inbound >= 3 ? "rgba(245, 158, 11, 0.75)" : "rgba(99, 102, 241, 0.7)"
      );
      circle.setAttribute("stroke", highlightPaths?.has(node.id) ? "#fff" : "#818cf8");
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dy", "0.35em");
      label.setAttribute("fill", "#f8fafc");
      label.setAttribute("font-size", "11");
      label.textContent = node.id;
      group.appendChild(circle);
      group.appendChild(label);
      group.addEventListener("click", () => onSelectModule?.(node.id));
      g.appendChild(group);
      return { group, circle, label, node, r };
    });

    simulation.on("tick", () => {
      for (const { line, link } of linkEls) {
        line.setAttribute("x1", String(link.source.x));
        line.setAttribute("y1", String(link.source.y));
        line.setAttribute("x2", String(link.target.x));
        line.setAttribute("y2", String(link.target.y));
      }
      for (const { group, node } of nodeEls) {
        group.setAttribute("transform", `translate(${node.x}, ${node.y})`);
      }
    });

    return () => simulation.stop();
  }, [nodes, edges, highlightPaths, onSelectModule]);

  return <svg ref={svgRef} className="h-full w-full" />;
}

function buildModules(fileNodes) {
  const map = new Map();
  for (const node of fileNodes) {
    const mod = node.path.split("/")[0] ?? "root";
    if (!map.has(mod)) map.set(mod, { id: mod, fileCount: 0, importCount: 0 });
    const entry = map.get(mod);
    entry.fileCount += 1;
    entry.importCount += node.importCount ?? 0;
  }
  return [...map.values()];
}

function buildModuleEdges(fileEdges) {
  const modOf = (path) => path.split("/")[0];
  const counts = new Map();
  for (const edge of fileEdges ?? []) {
    const s = modOf(edge.source);
    const t = modOf(edge.target);
    if (s === t) continue;
    const key = `${s}->${t}`;
    counts.set(key, (counts.get(key) ?? 0) + (edge.weight ?? 1));
  }
  return [...counts.entries()].map(([key, weight]) => {
    const [source, target] = key.split("->");
    return { source, target, weight };
  });
}
