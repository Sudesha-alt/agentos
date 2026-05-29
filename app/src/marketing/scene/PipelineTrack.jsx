import { useMemo } from "react";
import * as THREE from "three";

export default function PipelineTrack({ curve }) {
  const geometry = useMemo(() => {
    const tube = new THREE.TubeGeometry(curve, 200, 0.035, 8, false);
    return tube;
  }, [curve]);

  const glowGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 200, 0.06, 8, false);
  }, [curve]);

  return (
    <group>
      <mesh geometry={glowGeometry}>
        <meshBasicMaterial color="#6366F1" transparent opacity={0.08} />
      </mesh>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color="#2A2A3D"
          emissive="#6366F1"
          emissiveIntensity={0.25}
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

