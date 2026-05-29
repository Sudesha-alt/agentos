import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import MarketingDocumentScroll from "./MarketingDocumentScroll";
import MarketingScrollContent from "./MarketingScrollContent";
import SceneRoot from "./scene/SceneRoot";

function SceneLoader() {
  return (
    <mesh>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshBasicMaterial color="#6366F1" wireframe />
    </mesh>
  );
}

export default function MarketingExperience() {
  const dpr = useMemo(() => {
    if (typeof window === "undefined") return [1, 1.5];
    const ratio = window.devicePixelRatio || 1;
    return [1, Math.min(2, ratio)];
  }, []);

  return (
    <div className="marketing-root relative bg-canvas text-ink">
      <div className="pointer-events-none fixed inset-0 z-0">
        <Canvas
          className="!absolute inset-0"
          dpr={dpr}
          camera={{ position: [0, 1.1, 9.2], fov: 42, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        >
          <Suspense fallback={<SceneLoader />}>
            <SceneRoot />
          </Suspense>
        </Canvas>
      </div>

      <div className="editorial-noise pointer-events-none fixed inset-0 z-[1] opacity-[0.2]" />

      <div className="relative z-10">
        <MarketingDocumentScroll />
        <MarketingScrollContent />
      </div>
    </div>
  );
}
