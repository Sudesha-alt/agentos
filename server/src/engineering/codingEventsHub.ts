import type { Response } from "express";
import { EventEmitter } from "node:events";

export type EngineeringCodingEvent =
  | {
      type: "tool_started";
      pipelineId: string;
      tool: string;
      /** Human-readable description shown live, e.g. "Reading src/foo.ts" */
      displayLabel: string;
      input?: Record<string, unknown>;
      timestamp: string;
    }
  | {
      type: "tool_completed";
      pipelineId: string;
      tool: string;
      durationMs: number;
      displayLabel: string;
      filePath?: string;
      timestamp: string;
    }
  | {
      type: "file_staged";
      pipelineId: string;
      filePath: string;
      action: "create" | "modify" | "delete";
      summary: string;
      contentLength: number;
      timestamp: string;
    }
  | {
      type: "coding_started" | "coding_completed";
      pipelineId: string;
      jiraKey?: string;
      timestamp: string;
    }
  | {
      type: "canary_phase";
      pipelineId: string;
      phase: "reconnaissance" | "hypotheses" | "exploration" | "synthesis" | "completed" | "failed";
      findingCount?: number;
      jiraKey?: string;
      timestamp: string;
    };

const hub = new EventEmitter();
hub.setMaxListeners(100);

const sseClients = new Map<string, Set<Response>>();

export function emitEngineeringCodingEvent(event: EngineeringCodingEvent): void {
  hub.emit("event", event);
  const clients = sseClients.get(event.pipelineId);
  if (!clients?.size) return;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

export function subscribeEngineeringCodingEvents(
  pipelineId: string,
  res: Response
): () => void {
  let set = sseClients.get(pipelineId);
  if (!set) {
    set = new Set();
    sseClients.set(pipelineId, set);
  }
  set.add(res);

  return () => {
    set?.delete(res);
    if (set && set.size === 0) sseClients.delete(pipelineId);
  };
}

export function onEngineeringCodingEvent(
  listener: (event: EngineeringCodingEvent) => void
): () => void {
  hub.on("event", listener);
  return () => hub.off("event", listener);
}
