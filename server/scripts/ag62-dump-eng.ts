import "dotenv/config";
import { prisma } from "../src/db/client";

async function main() {
  const eng = await prisma.pipelineStageLog.findFirst({
    where: { stage: "ENGINEERING_AGENT", pipeline: { ticket: { jiraKey: { equals: "AG-62", mode: "insensitive" } } } },
  });
  console.log("keys", Object.keys((eng?.output as object) ?? {}));
  console.log(JSON.stringify(eng?.output, null, 2)?.slice(0, 500));
  const qa = await prisma.pipelineStageLog.findFirst({
    where: { stage: "QA_AGENT", pipeline: { ticket: { jiraKey: { equals: "AG-62", mode: "insensitive" } } } },
  });
  console.log("qa keys", Object.keys((qa?.output as object) ?? {}));
}

main().finally(() => prisma.$disconnect());
