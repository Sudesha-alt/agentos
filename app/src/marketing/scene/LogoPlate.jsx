import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useLoader } from "@react-three/fiber";
import { marketingScrollStore } from "../scrollStore";
import { TextureLoader } from "three";
import * as THREE from "three";

function stageActivity(scrollOffset, stage) {
  const center = (stage.scrollStart + stage.scrollEnd) / 2;
  const span = (stage.scrollEnd - stage.scrollStart) / 2 + 0.06;
  const distance = Math.abs(scrollOffset - center);
  return THREE.MathUtils.clamp(1 - distance / span, 0, 1);
}

export default function LogoPlate({ position, scale = 1, scrollStage }) {
  const texture = useLoader(TextureLoader, "/marketing/jira-logo.svg");
  const materialRef = useRef(null);
  const glowRef = useRef(null);

  useFrame(() => {
    const active = stageActivity(marketingScrollStore.getOffset(), scrollStage);
    if (materialRef.current) {
      materialRef.current.opacity = 0.55 + active * 0.45;
    }
    if (glowRef.current) {
      glowRef.current.opacity = 0.08 + active * 0.12;
    }
  });

  return (
    <group position={position} scale={scale}>
      <mesh>
        <planeGeometry args={[1.1, 1.1]} />
        <meshBasicMaterial
          ref={materialRef}
          map={texture}
          transparent
          opacity={0.7}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[1.25, 1.25]} />
        <meshBasicMaterial ref={glowRef} color="#6366F1" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}
