import { useEffect, useRef, useCallback } from "react";
import {
  activityColor,
  LAYERS,
  qualityStyle,
  structureColor,
  understandingColor,
} from "./layerColors";
import { activityColorAtDate } from "./activityAtDate";
import { pointInPolygon } from "./pointInPolygon";

const LAYOUT_W = 1000;
const LAYOUT_H = 700;

function drawCell(ctx, node, style, sx, sy, isHighlight, isDimmed, layer) {
  const scalePolygon = (poly) =>
    poly.map(([px, py]) => [px * sx, py * sy]);

  ctx.globalAlpha = isDimmed ? 0.12 : isHighlight ? 1 : 0.92;
  ctx.fillStyle = style.fill;
  ctx.strokeStyle = isHighlight ? "#f8fafc" : style.stroke;
  ctx.lineWidth = isHighlight ? 2 : style.border ?? 1;

  if (node.polygon?.length >= 3) {
    const poly = scalePolygon(node.polygon);
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i][0], poly[i][1]);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    const x = node.x * sx;
    const y = node.y * sy;
    const nw = node.width * sx;
    const nh = node.height * sy;
    ctx.fillRect(x, y, nw, nh);
    ctx.strokeRect(x + 0.5, y + 0.5, nw - 1, nh - 1);
  }

  if (style.pulse && !isDimmed) {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    const x = node.x * sx;
    const y = node.y * sy;
    ctx.strokeRect(x + 2, y + 2, node.width * sx - 4, node.height * sy - 4);
  }

  const nw = node.width * sx;
  const nh = node.height * sy;
  if (nw > 56 && nh > 22 && !isDimmed) {
    ctx.fillStyle = "rgba(248, 250, 252, 0.92)";
    ctx.font = `${Math.min(11, nh / 3)}px ui-monospace, monospace`;
    const label =
      layer === LAYERS.understanding && style.tag
        ? style.tag
        : node.name.length > 18
          ? `${node.name.slice(0, 16)}…`
          : node.name;
    ctx.fillText(label, node.x * sx + 4, node.y * sy + 14, nw - 8);
  }
}

export default function TreemapCanvas({
  nodes,
  layer,
  agentOverlay,
  activityAsOfMs,
  highlightPaths,
  dimmed,
  onHover,
  onSelect,
  className = "",
}) {
  const canvasRef = useRef(null);
  const scaleRef = useRef({ sx: 1, sy: 1 });

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !nodes?.length) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const sx = w / LAYOUT_W;
    const sy = h / LAYOUT_H;
    scaleRef.current = { sx, sy };

    ctx.fillStyle = "rgba(15, 17, 24, 0.95)";
    ctx.fillRect(0, 0, w, h);

    const highlights = highlightPaths ?? new Set();

    for (const node of nodes) {
      if (node.width < 2 && !node.polygon?.length) continue;

      const isHighlight = highlights.has(node.path);
      const isDimmed = dimmed && highlights.size > 0 && !isHighlight;

      let style;
      if (layer === LAYERS.activity) {
        style =
          typeof activityAsOfMs === "number"
            ? activityColorAtDate(
                node.lastModified,
                activityAsOfMs,
                agentOverlay,
                node.lastModifiedBy
              )
            : activityColor(node.lastModified, agentOverlay, node.lastModifiedBy);
      } else if (layer === LAYERS.quality) {
        style = qualityStyle(node.coverage, node.complexity);
      } else if (layer === LAYERS.understanding) {
        style = understandingColor(node.patterns);
      } else {
        style = structureColor(node.depth);
      }

      drawCell(ctx, node, style, sx, sy, isHighlight, isDimmed, layer);
    }

    ctx.globalAlpha = 1;
  }, [nodes, layer, agentOverlay, activityAsOfMs, highlightPaths, dimmed]);

  useEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  function hitTest(clientX, clientY) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { sx, sy } = scaleRef.current;
    const lx = (clientX - rect.left) / sx;
    const ly = (clientY - rect.top) / sy;

    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (n.polygon?.length >= 3) {
        if (pointInPolygon(lx, ly, n.polygon)) return n;
      } else if (
        lx >= n.x &&
        lx <= n.x + n.width &&
        ly >= n.y &&
        ly <= n.y + n.height
      ) {
        return n;
      }
    }
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={`h-full w-full cursor-crosshair ${className}`}
      onMouseMove={(e) => onHover?.(hitTest(e.clientX, e.clientY))}
      onMouseLeave={() => onHover?.(null)}
      onClick={(e) => {
        const hit = hitTest(e.clientX, e.clientY);
        if (hit) onSelect?.(hit);
      }}
    />
  );
}
