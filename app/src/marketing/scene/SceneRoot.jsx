import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei/core/Stars.js";
import * as THREE from "three";
import { PIPELINE_STAGES } from "../constants/stages";
import { getStagePositions } from "../constants/pipelinePath";
import { marketingScrollStore } from "../scrollStore";
import PipelineTrack from "./PipelineTrack";
import { usePipelineCurve } from "../hooks/usePipelineCurve";
import StageNode from "./StageNode";
import TicketMesh from "./TicketMesh";
import ValidationGate from "./ValidationGate";
import LogoPlate from "./LogoPlate";

export default function SceneRoot() {
  const { size } = useThree();
  const groupRef = useRef(null);
  const curve = usePipelineCurve();

  const stagePositions = useMemo(() => getStagePositions(curve), [curve]);
  const validationPosition = useMemo(() => curve.getPointAt(0.36), [curve]);

  const isMobile = size.width < 768;
  const sceneScale = isMobile ? 0.82 : 1;

  useFrame((state) => {
    const offset = marketingScrollStore.getOffset();
    const camera = state.camera;

    const targetY = 1.1 - offset * 0.35;
    const targetZ = (isMobile ? 11.5 : 9.2) - offset * 0.4;
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.06);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.06);
    camera.lookAt(0, -0.1 + offset * 0.2, 0);

    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        (offset - 0.5) * 0.12,
        0.04,
      );
    }
  });

  const agentStages = PIPELINE_STAGES.filter(
    (stage) =>
      stage.id === "product" || stage.id === "engineering" || stage.id === "qa",
  );

  return (
    <>
      <color attach="background" args={["#080810"]} />
      <fog attach="fog" args={["#080810", 8, 22]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 8]} intensity={0.85} color="#F0EEE8" />
      <pointLight position={[-4, 2, 4]} intensity={0.55} color="#6366F1" />
      <pointLight position={[4, -1, -2]} intensity={0.35} color="#2684FF" />

      <Stars
        radius={60}
        depth={40}
        count={isMobile ? 900 : 1600}
        factor={3}
        saturation={0}
        fade
        speed={0.35}
      />

      <group ref={groupRef} scale={sceneScale} position={[0, isMobile ? -0.2 : 0, 0]}>
        <PipelineTrack curve={curve} />

        <LogoPlate
          position={[
            stagePositions[0].x,
            stagePositions[0].y + 0.85,
            stagePositions[0].z,
          ]}
          scale={0.72}
          scrollStage={PIPELINE_STAGES[0]}
        />

        <LogoPlate
          position={[
            stagePositions[4].x,
            stagePositions[4].y + 0.85,
            stagePositions[4].z,
          ]}
          scale={0.72}
          scrollStage={PIPELINE_STAGES[4]}
        />

        {agentStages.map((stage) => {
          const index =
            stage.id === "product" ? 1 : stage.id === "engineering" ? 2 : 3;
          const position = stagePositions[index];

          return (
            <StageNode
              key={stage.id}
              position={[position.x, position.y, position.z]}
              label={stage.label}
              shortLabel={stage.shortLabel}
              scrollStage={stage}
            />
          );
        })}

        <ValidationGate
          position={[
            validationPosition.x,
            validationPosition.y + 0.15,
            validationPosition.z,
          ]}
        />

        <TicketMesh curve={curve} />
      </group>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]}>
        <planeGeometry args={[30, 30, 1, 1]} />
        <meshBasicMaterial color="#0E0E18" transparent opacity={0.35} wireframe />
      </mesh>
    </>
  );
}
