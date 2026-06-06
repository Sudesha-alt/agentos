import { createClient } from "@supabase/supabase-js";
import { prisma } from "../db/client";
import { getOpenAIClient } from "../llm/openaiClient";
import { requireRepoScope } from "./repoScope";

const supabase = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_KEY ?? ""
);

const prismaAny = prisma as any;

export const codebaseQueryService = {
  async searchCodebaseSemantically(input: {
    query: string;
    branchName: string;
    topK?: number;
    similarityThreshold?: number;
  }) {
    const { repoOwner, repoName } = requireRepoScope();
    const embedding = await getOpenAIClient().embeddings.create({
      model: "text-embedding-3-small",
      input: input.query,
    });

    const { data, error } = await supabase.rpc("search_codebase", {
      query_embedding: JSON.stringify(embedding.data[0].embedding),
      p_repo_owner: repoOwner,
      p_repo_name: repoName,
      p_branch_name: input.branchName,
      top_k: input.topK ?? 8,
      similarity_threshold: input.similarityThreshold ?? 0.7,
    });

    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async getFileWithContext(branchName: string, filePath: string) {
    const { repoOwner, repoName } = requireRepoScope();
    return prismaAny.codebaseFile.findUnique({
      where: {
        repoOwner_repoName_filePath_branchName: {
          repoOwner,
          repoName,
          filePath,
          branchName,
        },
      },
    });
  },

  async getFileIntelligence(
    branchName: string,
    filePath: string,
    includeContent = false
  ) {
    const { repoOwner, repoName } = requireRepoScope();
    const select: Record<string, boolean> = {
      id: true,
      filePath: true,
      branchName: true,
      size: true,
      language: true,
      summary: true,
      exports: true,
      imports: true,
      patterns: true,
      lastCommitSha: true,
      lastCommitMsg: true,
      lastCommitAt: true,
      lastAuthor: true,
      indexedAt: true,
      updatedAt: true,
      isDeleted: true,
    };
    if (includeContent) select.content = true;

    return prismaAny.codebaseFile.findUnique({
      where: {
        repoOwner_repoName_filePath_branchName: {
          repoOwner,
          repoName,
          filePath,
          branchName,
        },
      },
      select,
    });
  },

  async getRecentChanges(branchName: string, limit = 20) {
    const { repoOwner, repoName } = requireRepoScope();
    return prismaAny.commitHistory.findMany({
      where: { repoOwner, repoName, branchName },
      orderBy: { authoredAt: "desc" },
      take: limit,
    });
  },

  async getBranchHistory(limit = 20) {
    const { repoOwner, repoName } = requireRepoScope();
    return prismaAny.branchState.findMany({
      where: { repoOwner, repoName },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
  },

  async getFilesTouchingFeature(pattern: string, branchName: string) {
    const { repoOwner, repoName } = requireRepoScope();
    return prismaAny.codebaseFile.findMany({
      where: {
        repoOwner,
        repoName,
        branchName,
        isDeleted: false,
        OR: [
          { filePath: { contains: pattern, mode: "insensitive" } },
          { summary: { contains: pattern, mode: "insensitive" } },
        ],
      },
      select: {
        filePath: true,
        summary: true,
        patterns: true,
        lastCommitSha: true,
      },
      take: 50,
    });
  },
};
