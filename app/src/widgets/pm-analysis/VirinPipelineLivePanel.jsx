import { usePipelineLive } from "../../entities/pipeline";
import { pipelineMatchesAgentStage } from "../../shared/lib/agentPipelineStages";
import { VirinThoughtProcessContent } from "./VirinThoughtProcessPanel";

/**
 * Polls live pipeline status for a Jira key and renders Virin thought process.
 */
export default function VirinPipelineLivePanel({ jiraKey, className = "" }) {
  const normalizedKey = jiraKey?.trim().toUpperCase() || undefined;
  const { active } = usePipelineLive({
    pollMs: normalizedKey ? 3000 : undefined,
    jiraKey: normalizedKey,
    skip: !normalizedKey,
  });

  if (!active || !pipelineMatchesAgentStage(active.currentStage, "virin")) {
    return null;
  }

  return <VirinThoughtProcessContent live={active} className={className} />;
}
