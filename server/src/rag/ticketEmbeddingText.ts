import { chunkTextByParagraphs, hashContent } from "./contentHash";
import type { NormalizedTicket } from "../types/ticket";
import type { FetchedJiraIssue } from "../jira-sync/issueFetcher";

export interface TicketEmbedFields {
  jiraKey: string;
  summary: string;
  description: string;
  issueType: string;
  status?: string;
  priority?: string | null;
  components: string[];
  labels?: string[];
  resolution?: string | null;
  commentsText?: string;
  gitContext?: string;
}

export function ticketFieldsFromFetched(issue: FetchedJiraIssue, gitContext?: string): TicketEmbedFields {
  return {
    jiraKey: issue.jiraKey,
    summary: issue.summary,
    description: issue.description,
    issueType: issue.issueType,
    status: issue.status,
    priority: issue.priority,
    components: issue.components,
    labels: issue.labels,
    resolution: issue.resolution,
    commentsText: issue.commentsText,
    gitContext,
  };
}

export function ticketFieldsFromNormalized(ticket: Pick<
  NormalizedTicket,
  "jiraKey" | "summary" | "description" | "issueType" | "priority" | "components" | "labels"
>): TicketEmbedFields {
  return {
    jiraKey: ticket.jiraKey,
    summary: ticket.summary,
    description: ticket.description,
    issueType: ticket.issueType,
    priority: ticket.priority,
    components: ticket.components,
    labels: ticket.labels ?? [],
  };
}

export function buildTicketHeader(fields: TicketEmbedFields): string {
  return [
    `TICKET: ${fields.summary}`,
    `KEY: ${fields.jiraKey}`,
    `TYPE: ${fields.issueType}`,
    fields.status ? `STATUS: ${fields.status}` : "",
    fields.priority ? `PRIORITY: ${fields.priority}` : "",
    fields.components.length ? `COMPONENTS: ${fields.components.join(", ")}` : "",
    fields.labels?.length ? `LABELS: ${fields.labels.join(", ")}` : "",
    fields.resolution ? `RESOLUTION: ${fields.resolution}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildTicketBodyParts(fields: TicketEmbedFields): string[] {
  const parts: string[] = [];
  const descChunks = chunkTextByParagraphs(fields.description, 2200);
  if (descChunks.length <= 1) {
    parts.push(`DESCRIPTION: ${fields.description}`);
  } else {
    for (const [i, chunk] of descChunks.entries()) {
      parts.push(`DESCRIPTION [${i + 1}/${descChunks.length}]:\n${chunk}`);
    }
  }
  if (fields.commentsText?.trim()) {
    parts.push(`COMMENTS / FIX NOTES:\n${fields.commentsText}`);
  }
  if (fields.gitContext?.trim()) {
    parts.push(fields.gitContext);
  }
  return parts;
}

/** Chunk texts for embedding — header on chunk 0, body split across chunks. */
export function buildTicketEmbedChunks(fields: TicketEmbedFields, maxChunks = 8): string[] {
  const header = buildTicketHeader(fields);
  const bodyParts = buildTicketBodyParts(fields);
  const chunks: string[] = [];

  let current = header;
  for (const part of bodyParts) {
    const candidate = current ? `${current}\n\n${part}` : part;
    if (candidate.length > 7500 && current !== header) {
      chunks.push(current.trim());
      current = `${header}\n\n${part}`;
    } else if (candidate.length > 7500) {
      const sub = chunkTextByParagraphs(part, 2200);
      for (const s of sub) {
        chunks.push(`${header}\n\n${s}`.trim());
      }
      current = header;
    } else {
      current = candidate;
    }
  }
  if (current.trim() && current !== header) {
    chunks.push(current.trim());
  } else if (chunks.length === 0) {
    chunks.push(header);
  }

  return chunks.slice(0, maxChunks);
}

export function buildTicketEmbedHash(fields: TicketEmbedFields): string {
  return hashContent(buildTicketEmbedChunks(fields).join("\n---\n"));
}
