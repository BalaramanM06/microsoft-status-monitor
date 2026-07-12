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

    const response = await page.request.get(API_URL, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok()) {
      throw new Error(`API returned status ${response.status()}`);
    }

    const text = await response.text();
    logger.debug(`API raw response (first 500 chars): ${text.substring(0, 500)}`);

    let data: ApiResponse;
    try {
      data = JSON.parse(text);
    } catch {
      logger.error(`API response is not JSON: ${text.substring(0, 200)}`);
      return [];
    }

    logger.debug(`API response keys: ${JSON.stringify(Object.keys(data))}`);
    if (data.data) {
      logger.debug(`data.applications type: ${typeof data.data.applications}, isArray: ${Array.isArray(data.data.applications)}`);
      if (Array.isArray(data.data.applications)) {
        logger.debug(`data.applications.length: ${data.data.applications.length}`);
      }
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
