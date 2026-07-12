import { loadConfig } from "./config";
import { Scheduler } from "./scheduler";
import { logger } from "./logger";

async function main(): Promise<void> {
  const config = loadConfig();
  const scheduler = new Scheduler(config);

  const shutdown = async () => {
    logger.info("Shutting down...");
    await scheduler.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("uncaughtException", async (err) => {
    logger.error("Uncaught exception", err);
    await scheduler.stop();
    process.exit(1);
  });

  await scheduler.start();
}

main().catch((err) => {
  logger.error("Fatal error", err);
  process.exit(1);
});
