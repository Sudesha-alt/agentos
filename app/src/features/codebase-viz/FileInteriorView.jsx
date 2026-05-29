import { useCodebaseFileInterior } from "../../entities/codebase";
import Spinner from "../../app/components/Spinner";

export default function FileInteriorView({ filePath, branch = "main" }) {
  const { data, loading } = useCodebaseFileInterior(filePath, branch);

  if (loading && !data) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner label="Loading file structure" />
      </div>
    );
  }

  return (
    <div className="relative h-[min(420px,50vh)] w-full overflow-hidden rounded-xl border border-hairline bg-canvas/80">
      <canvas
        ref={(canvas) => {
          if (!canvas || !data?.blocks?.length) return;
          const ctx = canvas.getContext("2d");
          const rect = canvas.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, rect.width, rect.height);

          const sx = rect.width / 1000;
          const sy = rect.height / 600;

          for (const block of data.blocks) {
            const x = block.x * sx;
            const y = block.y * sy;
            const w = block.w * sx;
            const h = block.h * sy;
            ctx.fillStyle = "rgba(99, 102, 241, 0.35)";
            ctx.strokeStyle = "rgba(129, 140, 248, 0.8)";
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
            if (h > 16) {
              ctx.fillStyle = "#f8fafc";
              ctx.font = `${Math.min(11, h / 2)}px monospace`;
              ctx.fillText(block.name, x + 4, y + 14, w - 8);
            }
          }
        }}
        className="h-full w-full"
      />
      {data?.summary ? (
        <p className="absolute bottom-0 left-0 right-0 border-t border-hairline bg-canvas/90 px-4 py-2 text-[12px] text-ink-dim">
          {data.summary}
        </p>
      ) : null}
    </div>
  );
}
