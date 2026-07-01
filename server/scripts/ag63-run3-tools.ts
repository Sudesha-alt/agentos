import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!.trim(),
  process.env.SUPABASE_SERVICE_KEY!.trim()
);

async function countEmbeddings(repoOwner: string) {
  const { count } = await supabase
    .from("codebase_embeddings")
    .select("*", { count: "exact", head: true })
    .eq("repo_owner", repoOwner)
    .eq("branch_name", "test");
  return count ?? 0;
}

async function main() {
  for (const owner of ["Sudesha-agentos", "ZoroXRoronoa", "ZoroxRoronoa"]) {
    console.log(`embeddings ${owner}/test:`, await countEmbeddings(owner));
  }

  const { data: files } = await supabase
    .from("CodebaseFile")
    .select("repoOwner")
    .eq("branchName", "test")
    .limit(1000);
  const byOwner = new Map<string, number>();
  for (const f of files ?? []) {
    byOwner.set(f.repoOwner, (byOwner.get(f.repoOwner) ?? 0) + 1);
  }
  console.log("\nCodebaseFile counts by repoOwner (test branch, sample):", Object.fromEntries(byOwner));

  const { data: tools } = await supabase
    .from("AuditLog")
    .select("timestamp, metadata")
    .eq("pipelineId", "cmr2i0oc600if1vcdyi4mxufj")
    .eq("event", "CODING_TOOL_CALL_COMPLETED")
    .gte("timestamp", "2026-07-01T21:20:00")
    .order("timestamp", { ascending: true });

  console.log("\n=== AG-63 run @ 21:23 tool calls ===");
  for (const row of tools ?? []) {
    const m = row.metadata as Record<string, unknown>;
    console.log(
      row.timestamp,
      m.tool,
      "resultsFound=" + m.resultsFound,
      m.query ? `query="${String(m.query).slice(0, 60)}"` : "",
      m.filePath ?? ""
    );
  }
}

main();
