import { runCanaryCycle } from "./index";
import { getCanaryDeepCronHour, getCanaryLightIntervalMs, getCanaryProductionIntervalMs } from "./config";
import { canaryRunRepo } from "../db/repositories/canaryRunRepo";
import { logger } from "../utils/logger";

let lightRunning = false;
let deepRunning = false;
let productionRunning = false;
let lastDeepDay = -1;

export async function runScheduledCanaryLight(): Promise<{ started: boolean }> {
  if (lightRunning) return { started: false };
  lightRunning = true;
  try {
    await runCanaryCycle({
      trigger: "scheduled_light",
      environment: "staging",
      scope: "critical_paths",
    });
    return { started: true };
  } catch (err) {
    logger.error({ err }, "scheduled light canary failed");
    return { started: false };
  } finally {
    lightRunning = false;
  }
}

export async function runScheduledCanaryDeep(): Promise<{ started: boolean }> {
  if (deepRunning) return { started: false };
  deepRunning = true;
  try {
    await runCanaryCycle({
      trigger: "scheduled_deep",
      environment: "staging",
      scope: "full",
    });
    return { started: true };
  } catch (err) {
    logger.error({ err }, "scheduled deep canary failed");
    return { started: false };
  } finally {
    deepRunning = false;
  }
}

export async function runScheduledCanaryProduction(): Promise<{ started: boolean }> {
  if (productionRunning) return { started: false };
  productionRunning = true;
  try {
    await runCanaryCycle({
      trigger: "scheduled_light",
      environment: "production",
      scope: "critical_paths",
    });
    return { started: true };
  } catch (err) {
    logger.error({ err }, "scheduled production canary failed");
    return { started: false };
  } finally {
    productionRunning = false;
  }
}

export function startCanaryScheduler(): void {
  const lightMs = getCanaryLightIntervalMs();
  if (lightMs > 0) {
    setInterval(() => {
      void runScheduledCanaryLight();
    }, lightMs).unref();
    logger.info({ lightMs }, "canary light scheduler started");
  }

  const prodMs = getCanaryProductionIntervalMs();
  if (prodMs > 0) {
    setInterval(() => {
      void runScheduledCanaryProduction();
    }, prodMs).unref();
    logger.info({ prodMs }, "canary production scheduler started");
  }

  const deepHour = getCanaryDeepCronHour();
  setInterval(() => {
    const now = new Date();
    if (now.getHours() !== deepHour) return;
    const day = now.getDate();
    if (day === lastDeepDay) return;
    lastDeepDay = day;
    void runScheduledCanaryDeep();
    void publishNightlySynthesis();
  }, 60_000).unref();

  logger.info({ deepHour }, "canary deep scheduler started");
}

async function publishNightlySynthesis(): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const summary = await canaryRunRepo.nightlySummary(since);
  logger.info(summary, "canary nightly synthesis");
}
