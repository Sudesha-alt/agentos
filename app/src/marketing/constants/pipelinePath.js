import * as THREE from "three";

/** Catmull-Rom path for the ticket journey (responsive scale applied in scene). */
export function createPipelineCurve() {
  const points = [
    new THREE.Vector3(-5.2, -0.8, 0.4),
    new THREE.Vector3(-3.2, 0.6, 1.2),
    new THREE.Vector3(-1.2, -0.2, 0.2),
    new THREE.Vector3(0.8, 0.8, -0.6),
    new THREE.Vector3(2.8, -0.1, 0.4),
    new THREE.Vector3(4.6, 0.5, -0.8),
    new THREE.Vector3(5.4, -0.6, 0.2),
  ];

  return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.42);
}

export function getStagePositions(curve) {
  return [0, 0.22, 0.48, 0.74, 1].map((t) => curve.getPointAt(t));
}
