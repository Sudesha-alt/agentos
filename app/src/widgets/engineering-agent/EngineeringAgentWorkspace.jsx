import AnantaTicketWorkspace from "../ananta/AnantaTicketWorkspace";

/** @deprecated Use AnantaTicketWorkspace — /app/engineering redirects to /app/ananta */
export default function EngineeringAgentWorkspace({ pipelineId, onSelectPipeline }) {
  return (
    <AnantaTicketWorkspace
      pipelineId={pipelineId}
      onClearSelection={() => onSelectPipeline?.(null)}
    />
  );
}
