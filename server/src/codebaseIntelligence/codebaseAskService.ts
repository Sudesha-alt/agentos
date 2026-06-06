import { chatCompletionText } from "../llm/openaiCompletion";
import { logger } from "../utils/logger";
import { codebaseQueryService } from "./queryService";

export interface CodebaseAskResult {
  answer: string;
  highlightPaths: string[];
  relatedSnippets: Array<{ path: string; snippet: string; score?: number }>;
}

export async function askCodebaseQuestion(input: {
  question: string;
  branchName: string;
}): Promise<CodebaseAskResult> {
  const question = input.question.trim();
  if (!question) {
    return { answer: "Please provide a question.", highlightPaths: [], relatedSnippets: [] };
  }

  let searchResults: Array<{
    file_path?: string;
    path?: string;
    similarity?: number;
    chunk_content?: string;
    summary?: string;
  }> = [];

  try {
    searchResults = await codebaseQueryService.searchCodebaseSemantically({
      query: question,
      branchName: input.branchName,
      topK: 10,
      similarityThreshold: 0.65,
    });
  } catch (err) {
    logger.warn({ err }, "codebase ask semantic search failed");
  }

  const relatedSnippets = searchResults.slice(0, 8).map((hit) => ({
    path: hit.file_path ?? hit.path ?? "unknown",
    snippet: (hit.chunk_content ?? hit.summary ?? "").slice(0, 500),
    score: hit.similarity,
  }));

  const highlightPaths = relatedSnippets.map((s) => s.path).filter((p) => p !== "unknown");

  const contextBlock = relatedSnippets.length
    ? relatedSnippets
        .map((s, i) => `[${i + 1}] ${s.path}\n${s.snippet}`)
        .join("\n\n")
    : "No indexed snippets matched. Answer from general software engineering knowledge and note that the codebase index may be empty.";

  try {
    const { text } = await chatCompletionText({
      maxTokens: 1200,
      system: `You are a codebase tour guide. Answer using the provided indexed snippets.
Reference files inline using bracket notation, e.g. [server/src/api/routes/auth.ts].
Mention specific file paths. If highlighting a flow, list files in order.
Return JSON only: {"answer":string,"highlightPaths":string[]}`,
      user: `Branch: ${input.branchName}\nQuestion: ${question}\n\nIndexed context:\n${contextBlock}`,
    });

    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      answer?: string;
      highlightPaths?: string[];
    };

    const paths = [
      ...new Set([
        ...(parsed.highlightPaths ?? []),
        ...highlightPaths,
      ]),
    ].filter(Boolean);

    return {
      answer: parsed.answer ?? text,
      highlightPaths: paths,
      relatedSnippets,
    };
  } catch (err) {
    logger.warn({ err }, "codebase ask LLM failed");
    return {
      answer:
        relatedSnippets.length > 0
          ? `Based on indexed files, start with: ${highlightPaths.slice(0, 5).join(", ")}.`
          : "I could not reach the language model. Try again after indexing completes.",
      highlightPaths,
      relatedSnippets,
    };
  }
}
