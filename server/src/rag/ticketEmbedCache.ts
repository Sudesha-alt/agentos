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
    const ticketRow = existing.find((r) => r.contentType === "ticket");
    if (!ticketRow) return false;
    return ticketRow.metadata.contentHash === contentHash;
  } catch {
    return false;
  }
}
