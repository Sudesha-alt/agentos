import "dotenv/config";
import { withOrganizationContext } from "../src/api/orgRequestContext";
import { searchWorkFiles } from "../src/codebaseIntelligence/fileRanker";

async function main() {
  const orgId = "cmqfl5t3200012cf33bcr6g3g";
  await withOrganizationContext(orgId, async () => {
    const queries = [
      "Google OAuth authentication",
      "auth login signup",
      "Better Auth social provider",
      "where is authentication handled",
    ];
    for (const query of queries) {
      const hits = await searchWorkFiles({ query, branchName: "test", topN: 10 });
      console.log(`\nquery: "${query}"`);
      console.log(" workFiles:", hits.length);
      for (const h of hits.slice(0, 3)) {
        console.log(`  ${h.path} score=${h.score.toFixed(3)} scope=${h.changeScope}`);
      }
    }
  });
}

main().catch(console.error);
