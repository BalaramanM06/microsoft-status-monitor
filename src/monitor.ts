import { BrowserContext, Route, Response } from "playwright";
import path from "path";
import fs from "fs";
import { Application, StatusChange } from "./types";
import { Storage } from "./storage";
import { logger } from "./logger";

const CAREERS_URL =
  "https://apply.careers.microsoft.com/careers/applications?hl=en&domain=microsoft.com";
const API_PATTERN = "**/api/pcsx/dashboard/applications";

interface ApiApp {
  applicationId?: string;
  positionTitle?: string;
  currentStatus?: string;
  displayJobId?: string;
  positionLocation?: string;
  appliedOn?: string;
  pid?: number;
}

interface ApiResponse {
  data?: {
    applications?: ApiApp[];
  };
}

export async function fetchApplications(
  context: BrowserContext
): Promise<Application[]> {
  const page = await context.newPage();

  try {
    logger.info("Fetching applications by intercepting API response...");

    let capturedData: ApiResponse | null = null;

    // Intercept the API response
    await page.route(API_PATTERN, async (route: Route) => {
      const response = await route.fetch();
      const body = await response.json();
      capturedData = body as ApiResponse;
      await route.fulfill({ response });
    });

    // Navigate to the page - this triggers the API call
    await page.goto(CAREERS_URL, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Remove route
    await page.unroute(API_PATTERN);

    if (!capturedData) {
      logger.warn("No API response captured");
      return [];
    }

    logger.debug(`Captured API response keys: ${Object.keys(capturedData)}`);

    return parseApplications(capturedData);
  } catch (err) {
    logger.error("Failed to fetch applications", err as Error);
    throw err;
  } finally {
    await page.close();
  }
}

function parseApplications(data: ApiResponse): Application[] {
  const apps = data.data?.applications;

  if (!apps || !Array.isArray(apps) || apps.length === 0) {
    logger.warn("No applications found in API response");
    return [];
  }

  logger.info(`Parsed ${apps.length} application(s)`);

  return apps.map((item) => ({
    id:
      item.applicationId ??
      String(item.pid ?? Math.random().toString(36).slice(2, 8)),
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
    await page.goto(CAREERS_URL, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

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
