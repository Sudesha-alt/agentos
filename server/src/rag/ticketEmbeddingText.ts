import { hashContent } from "./contentHash";
import { chunkTextByTokens, countTokens } from "./chunking";
import { recordEmbedChunksDropped } from "./embedMetrics";
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

/** ~450 tokens body budget; header repeated on overflow chunks. */
const TICKET_BODY_MAX_TOKENS = 450;
const TICKET_BODY_OVERLAP_TOKENS = 60;

function headerBudgetTokens(header: string): number {
  return countTokens(header) + 32;
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
  const descChunks = chunkTextByTokens(fields.description, {
    maxTokens: TICKET_BODY_MAX_TOKENS,
    overlapTokens: TICKET_BODY_OVERLAP_TOKENS,
  });
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

/** Max tokens per embed chunk including repeated header. */
const TICKET_CHUNK_MAX_TOKENS = 600;

function chunkTokenBudget(header: string): number {
  return Math.max(200, TICKET_CHUNK_MAX_TOKENS - headerBudgetTokens(header));
}

/** Chunk texts for embedding — header on chunk 0, body split across chunks (token-aware). */
export function buildTicketEmbedChunks(fields: TicketEmbedFields, maxChunks = 8): string[] {
  const header = buildTicketHeader(fields);
  const bodyParts = buildTicketBodyParts(fields);
  const chunks: string[] = [];
  const bodyTokenBudget = chunkTokenBudget(header);

  let current = header;
  for (const part of bodyParts) {
    const candidate = current ? `${current}\n\n${part}` : part;
    if (countTokens(candidate) > bodyTokenBudget && current !== header) {
      chunks.push(current.trim());
      current = `${header}\n\n${part}`;
    } else if (countTokens(candidate) > bodyTokenBudget) {
      const sub = chunkTextByTokens(part, {
        maxTokens: TICKET_BODY_MAX_TOKENS,
        overlapTokens: TICKET_BODY_OVERLAP_TOKENS,
      });
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

  const limited = chunks.slice(0, maxChunks);
  if (chunks.length > maxChunks) {
    recordEmbedChunksDropped();
  }
  return limited;
}

export function buildTicketEmbedHash(fields: TicketEmbedFields): string {
  return hashContent(buildTicketEmbedChunks(fields).join("\n---\n"));
}
