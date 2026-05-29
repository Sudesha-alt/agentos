import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei/core/Text.js";
import { marketingScrollStore } from "../scrollStore";
import * as THREE from "three";

function stageActivity(scrollOffset, stage) {
  const center = (stage.scrollStart + stage.scrollEnd) / 2;
  const span = (stage.scrollEnd - stage.scrollStart) / 2 + 0.06;
  const distance = Math.abs(scrollOffset - center);
  return THREE.MathUtils.clamp(1 - distance / span, 0, 1);
}

export default function StageNode({
  position,
  label,
  shortLabel,
  scrollStage,
  isGate = false,
}) {
  const ringRef = useRef(null);
  const coreRef = useRef(null);
  const labelRef = useRef(null);
  const shortRef = useRef(null);

  const color = useMemo(() => {
    if (isGate) return new THREE.Color("#F59E0B");
    return new THREE.Color("#6366F1");
  }, [isGate]);

  useFrame((_, delta) => {
    const active = stageActivity(marketingScrollStore.getOffset(), scrollStage);

    if (ringRef.current) {
      ringRef.current.rotation.z += delta * (0.25 + active * 0.6);
      ringRef.current.material.opacity = 0.25 + active * 0.55;
    }
    if (coreRef.current) {
      const pulse = 1 + active * 0.08 * Math.sin(performance.now() * 0.004);
      coreRef.current.scale.setScalar(pulse);
      coreRef.current.material.emissiveIntensity = 0.15 + active * 0.65;
    }
    if (labelRef.current) {
      labelRef.current.fillOpacity = 0.55 + active * 0.45;
    }
    if (shortRef.current) {
      shortRef.current.fillOpacity = 0.4 + active * 0.5;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ringRef}>
        <torusGeometry args={[0.55, 0.02, 12, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>

      <mesh ref={coreRef}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial
          color="#0E0E18"
          emissive={color}
          emissiveIntensity={0.15}
          metalness={0.35}
          roughness={0.45}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>

      <Text
        ref={labelRef}
        position={[0, -0.95, 0]}
        fontSize={0.18}
        color="#F0EEE8"
        anchorX="center"
        anchorY="top"
        maxWidth={2.4}
        textAlign="center"
        fillOpacity={0.55}
      >
        {label}
      </Text>

      <Text
        ref={shortRef}
        position={[0, -1.18, 0]}
        fontSize={0.11}
        color="#6366F1"
        anchorX="center"
        anchorY="top"
        letterSpacing={0.08}
        fillOpacity={0.4}
      >
        {shortLabel.toUpperCase()}
      </Text>
    </group>
  );
}
