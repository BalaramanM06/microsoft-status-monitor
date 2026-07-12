import { BrowserContext } from "playwright";
import path from "path";
import fs from "fs";
import { Application, StatusChange, MonitorResult } from "./types";
import { Storage } from "./storage";
import { logger } from "./logger";

const API_URL =
  "https://apply.careers.microsoft.com/api/pcsx/dashboard/applications";

interface ApiResponse {
  status?: number;
  data?: {
    applications?: Array<{
      applicationId?: string;
      positionTitle?: string;
      currentStatus?: string;
      displayJobId?: string;
      positionLocation?: string;
      appliedOn?: string;
      pid?: number;
      isReferral?: boolean;
      allowWithdraw?: boolean;
      [key: string]: unknown;
    }>;
  };
  [key: string]: unknown;
}

export async function fetchApplications(
  context: BrowserContext
): Promise<Application[]> {
  const page = await context.newPage();

  try {
    logger.info("Fetching applications from API...");

    // Navigate to careers page first to establish cookies
    await page.goto(
      "https://apply.careers.microsoft.com/careers/applications?hl=en&domain=microsoft.com",
      { waitUntil: "networkidle", timeout: 30000 }
    );

    // Now fetch API from same origin (cookies included automatically)
    const data = (await page.evaluate(async (url) => {
      const res = await fetch(url, { credentials: "same-origin" });
      return res.json();
    }, API_URL)) as ApiResponse;

    logger.debug(`API response keys: ${Object.keys(data)}`);

    if (data.data) {
      logger.debug(`data.applications length: ${Array.isArray(data.data.applications) ? data.data.applications.length : "not array"}`);
    }

    return parseApplications(data);
  } catch (err) {
    logger.error("Failed to fetch applications", err as Error);
    throw err;
  } finally {
    await page.close();
  }
}

function parseApplications(data: ApiResponse): Application[] {
  const apps = data.data?.applications;

  if (!apps || !Array.isArray(apps)) {
    const dataStr = data.data ? JSON.stringify(data.data).substring(0, 200) : "undefined";
    logger.warn(`No applications found. data.data: ${dataStr}`);
    return [];
  }

  return apps.map((item) => ({
    id: item.applicationId ?? String(item.pid ?? Math.random().toString(36).slice(2, 8)),
    jobTitle: item.positionTitle ?? "Unknown Position",
    status: item.currentStatus ?? "Unknown",
    interviewStage: undefined,
    lastUpdated: item.appliedOn,
    jobId: item.displayJobId,
    location: item.positionLocation,
    dateApplied: item.appliedOn,
  }));
}

export function detectChanges(
  currentApps: Application[],
  storage: Storage
): StatusChange[] {
  const changes: StatusChange[] = [];
  const now = new Date().toISOString();

  for (const app of currentApps) {
    const stored = storage.getApplication(app.id);

    if (!stored) {
      changes.push({
        applicationId: app.id,
        jobTitle: app.jobTitle,
        oldStatus: "New (first seen)",
        newStatus: app.status,
        oldInterviewStage: undefined,
        newInterviewStage: app.interviewStage,
        changedAt: now,
      });
    } else if (
      stored.status !== app.status ||
      stored.interviewStage !== app.interviewStage
    ) {
      changes.push({
        applicationId: app.id,
        jobTitle: app.jobTitle,
        oldStatus: stored.status,
        newStatus: app.status,
        oldInterviewStage: stored.interviewStage,
        newInterviewStage: app.interviewStage,
        changedAt: now,
      });
    }
  }

  return changes;
}

export async function takeScreenshot(
  context: BrowserContext,
  screenshotDir: string,
  applicationId: string
): Promise<string | null> {
  try {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const page = await context.newPage();
    await page.goto(
      "https://apply.careers.microsoft.com/careers/applications?hl=en&domain=microsoft.com",
      { waitUntil: "networkidle", timeout: 30000 }
    );

    const filename = `status-change-${applicationId}-${Date.now()}.png`;
    const filePath = path.join(screenshotDir, filename);
    await page.screenshot({ path: filePath, fullPage: true });
    await page.close();

    logger.info(`Screenshot saved: ${filePath}`);
    return filePath;
  } catch (err) {
    logger.error("Failed to take screenshot", err as Error);
    return null;
  }
}
