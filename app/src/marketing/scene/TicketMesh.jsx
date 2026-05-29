import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei/core/Text.js";
import { marketingScrollStore } from "../scrollStore";
import * as THREE from "three";

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export default function TicketMesh({ curve }) {
  const groupRef = useRef(null);
  const glowRef = useRef(null);

  const ticketMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#12121C",
        emissive: "#6366F1",
        emissiveIntensity: 0.35,
        metalness: 0.5,
        roughness: 0.35,
      }),
    [],
  );

  useFrame(() => {
    if (!groupRef.current || !curve) return;

    const progress = smoothstep(0.04, 0.94, marketingScrollStore.getOffset());
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).normalize();

    groupRef.current.position.copy(point);
    groupRef.current.lookAt(point.clone().add(tangent));

    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + progress * 0.15);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={glowRef}>
        <boxGeometry args={[0.72, 0.48, 0.08]} />
        <primitive attach="material" object={ticketMaterial} />
      </mesh>

      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[0.58, 0.34]} />
        <meshBasicMaterial color="#6366F1" transparent opacity={0.18} />
      </mesh>

      <Text
        position={[0, 0.06, 0.06]}
        fontSize={0.07}
        color="#F0EEE8"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.06}
      >
        JIRA-1287
      </Text>

      <Text
        position={[0, -0.08, 0.06]}
        fontSize={0.045}
        color="#9CA3AF"
        anchorX="center"
        anchorY="middle"
        maxWidth={0.5}
        textAlign="center"
      >
        Usage billing controls
      </Text>
    </group>
  );
}
