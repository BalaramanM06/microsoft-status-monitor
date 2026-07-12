import fs from "fs";
import cron from "node-cron";
import { chromium, BrowserContext } from "playwright";
import { Config, MonitorResult, StatusChange, Application } from "./types";
import { Storage } from "./storage";
import { TelegramNotifier } from "./telegram";
import { fetchApplications, detectChanges, takeScreenshot } from "./monitor";
import { verifySession } from "./auth";
import { logger } from "./logger";

export class Scheduler {
  private config: Config;
  private storage: Storage;
  private telegram: TelegramNotifier;
  private cronJob: cron.ScheduledTask | null = null;
  private context: BrowserContext | null = null;
  private heartbeatDay: string = "";

  constructor(config: Config) {
    this.config = config;
    this.storage = new Storage(config.stateFilePath);
    this.telegram = new TelegramNotifier(config);
  }

  async start(): Promise<void> {
    logger.divider();
    logger.info("Microsoft Careers Status Monitor starting...");
    logger.divider();

    try {
      await this.initializeContext();
    } catch (err) {
      logger.error("Failed to initialize browser context", err as Error);
      await this.telegram.notifyError(
        `Failed to initialize: ${(err as Error).message}`
      );
      process.exit(1);
    }

    const interval = this.config.checkInterval;
    const cronExpression = `*/${interval} * * * *`;

    logger.info(`Scheduling checks every ${interval} minutes (${cronExpression})`);
    logger.divider();

    await this.runCheck();

    this.cronJob = cron.schedule(cronExpression, async () => {
      await this.runCheck();
    });
  }

  async runCheck(): Promise<MonitorResult> {
    const now = new Date();
    logger.divider();
    logger.info(`Checking Microsoft Careers at ${now.toISOString()}...`);
    logger.divider();

    try {
      if (!this.context) {
        await this.initializeContext();
      }

      const sessionValid = await verifySession(this.context!);
      if (!sessionValid) {
        logger.error("Session expired!");
        await this.telegram.notifySessionExpired();
        return { type: "error", message: "Session expired" };
      }

      const applications = await fetchApplications(this.context!);

      if (applications.length === 0) {
        logger.warn("No applications found");
        return { type: "no_change" };
      }

      logger.info(`Found ${applications.length} application(s)`);

      for (const app of applications) {
        logger.info(`  • ${app.jobTitle}: ${app.status}`);
      }

      const changes = detectChanges(applications, this.storage);

      if (changes.length === 0) {
        logger.info("No changes detected.");
        await this.sendHeartbeatIfDue(applications);
        return { type: "no_change" };
      }

      logger.info(`Status changed! ${changes.length} change(s) detected.`);

      for (const change of changes) {
        logger.divider();
        logger.info(`Changed: ${change.jobTitle}`);
        logger.info(`  ${change.oldStatus} → ${change.newStatus}`);
        if (change.oldInterviewStage || change.newInterviewStage) {
          logger.info(
            `  Stage: ${change.oldInterviewStage || "N/A"} → ${change.newInterviewStage || "N/A"}`
          );
        }
        logger.divider();

        await this.telegram.notifyStatusChange(change);

        const screenshotPath = await takeScreenshot(
          this.context!,
          this.config.screenshotDir,
          change.applicationId
        );
        if (screenshotPath) {
          await this.telegram.sendPhoto(
            screenshotPath,
            `Status change: ${change.oldStatus} → ${change.newStatus}`
          );
        }
      }

      this.storage.updateApplications(applications);
      logger.info("State updated.");

      return { type: "changes_detected", changes };
    } catch (err) {
      const message = (err as Error).message;
      logger.error(`Check failed: ${message}`, err as Error);

      if (
        message.includes("login") ||
        message.includes("401") ||
        message.includes("403")
      ) {
        this.context = null;
        await this.telegram.notifySessionExpired();
      } else {
        await this.telegram.notifyError(message);
      }

      return { type: "error", message };
    }
  }

  private async sendHeartbeatIfDue(applications: Application[]): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    if (this.heartbeatDay !== today) {
      this.heartbeatDay = today;
      logger.info("Sending daily heartbeat...");
      await this.telegram.sendHeartbeat(
        applications,
        new Date().toISOString()
      );
    }
  }

  private async initializeContext(): Promise<void> {
    logger.info("Launching browser...");

    const hasAuthState = fs.existsSync(this.config.authStatePath);

    if (!hasAuthState) {
      throw new Error(
        "No auth.json found. Please run `npm run login` first to authenticate."
      );
    }

    this.context = await chromium.launchPersistentContext(
      this.config.authStatePath,
      {
        headless: this.config.headless,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      }
    );

    logger.info("Browser context initialized with saved session");
  }

  async stop(): Promise<void> {
    logger.info("Stopping scheduler...");
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    logger.info("Scheduler stopped.");
  }
}
