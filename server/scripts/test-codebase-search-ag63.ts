import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { getOpenAIClient } from "../src/llm/openaiClient";

const supabase = createClient(
  process.env.SUPABASE_URL!.trim(),
  process.env.SUPABASE_SERVICE_KEY!.trim()
);

async function main() {
  const { data: gitConfig } = await supabase
    .from("OrganizationGitConfig")
    .select("organizationId, workspace, repoSlug")
    .eq("workspace", "Sudesha-agentos")
    .eq("repoSlug", "sudesh_anna_test")
    .maybeSingle();

  console.log("git config:", gitConfig);
  const orgId = gitConfig?.organizationId;
  if (!orgId) return;

  const query = "Google OAuth authentication login Better Auth";
  const embedding = await getOpenAIClient().embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });

  for (const [name, args] of [
    [
      "hybrid_search_codebase",
      {
        query_embedding: JSON.stringify(embedding.data[0].embedding),
        query_text: query,
        p_repo_owner: "Sudesha-agentos",
        p_repo_name: "sudesh_anna_test",
        p_branch_name: "test",
        top_k: 10,
        similarity_threshold: 0.55,
        p_organization_id: orgId,
      },
    ],
    [
      "search_codebase",
      {
        query_embedding: JSON.stringify(embedding.data[0].embedding),
        p_repo_owner: "Sudesha-agentos",
        p_repo_name: "sudesh_anna_test",
        p_branch_name: "test",
        top_k: 10,
        similarity_threshold: 0.55,
        p_organization_id: orgId,
      },
    ],
  ] as const) {
    const { data, error } = await supabase.rpc(name, args);
    console.log(`\n${name}:`, error?.message ?? `rows=${(data ?? []).length}`);
    for (const row of (data ?? []).slice(0, 5)) {
      console.log(
        " ",
        row.file_path ?? row.path,
        "sim=" + (row.similarity?.toFixed?.(3) ?? row.similarity)
      );
    }
  }

  const { count: withOrg } = await supabase
    .from("codebase_embeddings")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("repo_owner", "Sudesha-agentos")
    .eq("branch_name", "test");

  const { count: nullOrg } = await supabase
    .from("codebase_embeddings")
    .select("*", { count: "exact", head: true })
    .is("organization_id", null)
    .eq("repo_owner", "Sudesha-agentos")
    .eq("branch_name", "test");

  console.log("\nembeddings with org_id:", withOrg);
  console.log("embeddings null org_id:", nullOrg);
}

main().catch(console.error);
