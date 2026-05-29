import { useMemo } from "react";
import { createPipelineCurve } from "../constants/pipelinePath";

export function usePipelineCurve() {
  return useMemo(() => createPipelineCurve(), []);
}
