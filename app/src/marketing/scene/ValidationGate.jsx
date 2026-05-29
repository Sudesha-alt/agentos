import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei/core/Text.js";
import { marketingScrollStore } from "../scrollStore";
import * as THREE from "three";
import { VALIDATION_SCROLL } from "../constants/stages";

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export default function ValidationGate({ position }) {
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const beamRef = useRef(null);
  const labelRef = useRef(null);

  const beamMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#F59E0B",
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame(() => {
    const openness = smoothstep(
      VALIDATION_SCROLL.start,
      VALIDATION_SCROLL.end,
      marketingScrollStore.getOffset(),
    );
    const spread = openness * 1.1;

    if (leftRef.current) leftRef.current.rotation.y = spread;
    if (rightRef.current) rightRef.current.rotation.y = -spread;
    if (beamRef.current) {
      beamRef.current.material.opacity = 0.08 + openness * 0.35;
    }
    if (labelRef.current) {
      labelRef.current.fillOpacity = 0.35 + openness * 0.65;
    }
  });

  return (
    <group position={position}>
      <mesh ref={beamRef} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.4, 2.4]} />
        <primitive attach="material" object={beamMaterial} />
      </mesh>

      <group ref={leftRef} position={[-0.55, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.08, 1.6, 0.12]} />
          <meshStandardMaterial
            color="#1E1E2E"
            emissive="#F59E0B"
            emissiveIntensity={0.35}
            metalness={0.4}
            roughness={0.5}
          />
        </mesh>
      </group>

      <group ref={rightRef} position={[0.55, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.08, 1.6, 0.12]} />
          <meshStandardMaterial
            color="#1E1E2E"
            emissive="#F59E0B"
            emissiveIntensity={0.35}
            metalness={0.4}
            roughness={0.5}
          />
        </mesh>
      </group>

      <Text
        ref={labelRef}
        position={[0, 1.05, 0]}
        fontSize={0.16}
        color="#F59E0B"
        anchorX="center"
        anchorY="bottom"
        fillOpacity={0.35}
        letterSpacing={0.12}
      >
        PRD GATE
      </Text>
    </group>
  );
}
