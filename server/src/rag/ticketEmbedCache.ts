import { hashContent, chunkTextByParagraphs } from "./contentHash";

export { hashContent, chunkTextByParagraphs };

import { requireActiveOrganizationId } from "../organization/orgScope";
import { vectorStore } from "./vectorStore";

/** Skip re-embed when ticket content hash unchanged (org-scoped). */
export async function shouldSkipTicketEmbed(
  jiraKey: string,
  contentHash: string,
  organizationId?: string
): Promise<boolean> {
  try {
    const orgId = organizationId ?? requireActiveOrganizationId();
    const existing = await vectorStore.getByJiraKey(jiraKey, orgId);
    const ticketRows = existing.filter((r) => r.contentType === "ticket");
    if (!ticketRows.length) return false;
    return ticketRows.every((r) => r.metadata.contentHash === contentHash);
  } catch {
    return false;
  }
}
