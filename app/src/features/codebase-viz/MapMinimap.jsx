import { useCallback, useEffect, useMemo, useRef } from "react";
import { pointInPolygon } from "./pointInPolygon";

const LAYOUT_W = 1000;
const LAYOUT_H = 700;
const MINIMAP_W = 160;
const MINIMAP_H = 112;

function nodeBounds(node) {
  if (node.polygon?.length >= 3) {
    const xs = node.polygon.map(([x]) => x);
    const ys = node.polygon.map(([, y]) => y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    };
  }
  return { x: node.x, y: node.y, w: node.width, h: node.height };
}

function boundsForNodes(nodes) {
  if (!nodes.length) return { x: 0, y: 0, w: LAYOUT_W, h: LAYOUT_H };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const b = nodeBounds(node);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export default function MapMinimap({ nodes, focusPath, onNavigate }) {
  const canvasRef = useRef(null);
  const scaleX = MINIMAP_W / LAYOUT_W;
  const scaleY = MINIMAP_H / LAYOUT_H;

  const viewportNodes = useMemo(() => {
    if (!focusPath) return nodes;
    const prefix = focusPath.endsWith("/") ? focusPath : `${focusPath}/`;
    return nodes.filter((n) => n.path === focusPath || n.path.startsWith(prefix));
  }, [nodes, focusPath]);

  const viewport = useMemo(() => {
    const pad = 8;
    const b = boundsForNodes(viewportNodes);
    return {
      x: Math.max(0, b.x - pad),
      y: Math.max(0, b.y - pad),
      w: Math.min(LAYOUT_W, b.w + pad * 2),
      h: Math.min(LAYOUT_H, b.h + pad * 2),
    };
  }, [viewportNodes]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_W * dpr;
    canvas.height = MINIMAP_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);

    ctx.fillStyle = "rgba(15, 17, 24, 0.92)";
    ctx.fillRect(0, 0, MINIMAP_W, MINIMAP_H);

    const focusPrefix = focusPath
      ? focusPath.endsWith("/")
        ? focusPath
        : `${focusPath}/`
      : null;

    for (const node of nodes) {
      const inFocus =
        !focusPrefix || node.path === focusPath || node.path.startsWith(focusPrefix);
      ctx.globalAlpha = inFocus ? 0.85 : 0.25;
      ctx.fillStyle = inFocus ? "rgba(99, 102, 241, 0.55)" : "rgba(51, 65, 85, 0.4)";

      if (node.polygon?.length >= 3) {
        ctx.beginPath();
        const [fx, fy] = [node.polygon[0][0] * scaleX, node.polygon[0][1] * scaleY];
        ctx.moveTo(fx, fy);
        for (let i = 1; i < node.polygon.length; i++) {
          ctx.lineTo(node.polygon[i][0] * scaleX, node.polygon[i][1] * scaleY);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(node.x * scaleX, node.y * scaleY, node.width * scaleX, node.height * scaleY);
      }
    }

    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(248, 250, 252, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      viewport.x * scaleX,
      viewport.y * scaleY,
      viewport.w * scaleX,
      viewport.h * scaleY
    );
  }, [nodes, focusPath, viewport, scaleX, scaleY]);

  useEffect(() => {
    paint();
  }, [paint]);

  function hitTest(clientX, clientY) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const lx = (clientX - rect.left) / scaleX;
    const ly = (clientY - rect.top) / scaleY;

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
    <div
      className="pointer-events-auto absolute bottom-3 right-3 z-20 overflow-hidden rounded-lg border border-hairline bg-canvas/90 shadow-lg"
      style={{ width: MINIMAP_W, height: MINIMAP_H }}
    >
      <canvas
        ref={(el) => {
          canvasRef.current = el;
          if (el) paint();
        }}
        width={MINIMAP_W}
        height={MINIMAP_H}
        className="block h-full w-full cursor-pointer"
        onClick={(e) => {
          const hit = hitTest(e.clientX, e.clientY);
          if (!hit) {
            onNavigate?.(null);
            return;
          }
          const parts = hit.path.split("/").filter(Boolean);
          onNavigate?.(parts[0] ?? null);
        }}
      />
    </div>
  );
}
