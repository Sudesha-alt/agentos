import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_KEY?.trim();
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  console.log("=== Latest CodebaseIndexRun (test branch) ===\n");
  const { data: runs, error } = await supabase
    .from("CodebaseIndexRun")
    .select("*")
    .eq("branchName", "test")
    .order("startedAt", { ascending: false })
    .limit(8);

  if (error) {
    console.error("Query error:", error.message);
    return;
  }

  for (const run of runs ?? []) {
    console.log(`--- ${run.id} ---`);
    console.log("status:", run.status);
    console.log("repo:", `${run.repoOwner}/${run.repoName}`);
    console.log("started:", run.startedAt);
    console.log("completed:", run.completedAt);
    console.log(
      "progress:",
      `${run.filesProcessed}/${run.filesTotal} processed, ${run.filesIndexed} indexed`
    );
    console.log("error:", run.error ?? "(none recorded)");
    console.log("");
  }

  const { count: embedCount, error: embedErr } = await supabase
    .from("codebase_embeddings")
    .select("*", { count: "exact", head: true })
    .eq("branch_name", "test");

  console.log("=== Embeddings on test branch ===");
  console.log(embedCount ?? 0, embedErr?.message ?? "");

  console.log("\n=== AG-63 pipeline (latest) ===");
  const { data: ticket } = await supabase
    .from("Ticket")
    .select("id,jiraKey,status")
    .ilike("jiraKey", "AG-63")
    .maybeSingle();

  if (!ticket) {
    console.log("AG-63 not found");
    return;
  }

  const { data: pipeline } = await supabase
    .from("Pipeline")
    .select("id,status,currentStage,completedAt")
    .eq("ticketId", ticket.id)
    .maybeSingle();

  console.log("ticket:", ticket.status);
  console.log("pipeline:", pipeline);

  if (pipeline?.id) {
    const { data: failures } = await supabase
      .from("AuditLog")
      .select("timestamp,metadata")
      .eq("pipelineId", pipeline.id)
      .eq("event", "PIPELINE_FAILED")
      .order("timestamp", { ascending: false })
      .limit(3);

    console.log("\nRecent PIPELINE_FAILED:");
    for (const f of failures ?? []) {
      console.log(f.timestamp, JSON.stringify(f.metadata));
    }

    const { data: lastEng } = await supabase
      .from("AuditLog")
      .select("timestamp,event,metadata")
      .eq("pipelineId", pipeline.id)
      .in("event", [
        "ENGINEERING_CODING_STARTED",
        "ENGINEERING_CODING_COMPLETED",
        "CODING_TOOL_CALL_COMPLETED",
        "AGENTIC_LOOP_COMPLETED",
      ])
      .order("timestamp", { ascending: false })
      .limit(15);

    console.log("\nRecent engineering events:");
    for (const e of (lastEng ?? []).reverse()) {
      const m = e.metadata as Record<string, unknown>;
      if (e.event === "CODING_TOOL_CALL_COMPLETED") {
        console.log(e.timestamp, m.tool, m.filePath ?? m.error ?? "");
      } else {
        console.log(e.timestamp, e.event, JSON.stringify(m).slice(0, 200));
      }
    }
  }
}

main();
