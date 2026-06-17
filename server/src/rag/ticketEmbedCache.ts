import { hashContent, chunkTextByParagraphs } from "./contentHash";

export { hashContent, chunkTextByParagraphs };

import { vectorStore } from "./vectorStore";

/** Skip re-embed when ticket content hash unchanged. */
export async function shouldSkipTicketEmbed(
  jiraKey: string,
  contentHash: string
): Promise<boolean> {
  try {
    const existing = await vectorStore.getByJiraKey(jiraKey);
    const ticketRows = existing.filter((r) => r.contentType === "ticket");
    if (!ticketRows.length) return false;
    return ticketRows.every((r) => r.metadata.contentHash === contentHash);
  } catch {
    return false;
  }
}
