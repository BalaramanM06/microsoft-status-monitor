import { chromium, BrowserContext } from "playwright";
import fs from "fs";
import { logger } from "./logger";

const CAREERS_URL =
  "https://apply.careers.microsoft.com/careers/applications?hl=en&domain=microsoft.com";

export async function createAuthenticatedContext(
  authStatePath: string,
  headless: boolean
): Promise<{ context: BrowserContext; needsLogin: boolean }> {
  const hasAuthState = fs.existsSync(authStatePath);

  if (hasAuthState) {
    logger.info("Found existing auth state, attempting to reuse...");
    const context = await chromium.launchPersistentContext(authStatePath, {
      headless,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    return { context, needsLogin: false };
  }

  logger.info("No auth state found, will need manual login");
  const context = await chromium.launchPersistentContext(authStatePath, {
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  return { context, needsLogin: true };
}

export async function performLogin(context: BrowserContext): Promise<boolean> {
  const page = await context.newPage();

  try {
    logger.info("Navigating to Microsoft Careers portal...");
    await page.goto(CAREERS_URL, { waitUntil: "networkidle", timeout: 60000 });

    logger.info("╔══════════════════════════════════════════════════╗");
    logger.info("║   Please log in manually in the browser window  ║");
    logger.info("║   Press ENTER in the terminal when done.        ║");
    logger.info("╚══════════════════════════════════════════════════╝");

    await waitForUserInput();

    const url = page.url();
    if (url.includes("apply.careers.microsoft.com")) {
      logger.info("Login appears successful. Saving session...");
      return true;
    }

    logger.warn("Page URL does not indicate successful login. Continuing anyway...");
    return true;
  } catch (err) {
    logger.error("Login failed", err as Error);
    return false;
  } finally {
    await page.close();
  }
}

export async function verifySession(context: BrowserContext): Promise<boolean> {
  const page = await context.newPage();

  try {
    logger.info("Verifying authentication session...");
    await page.goto(CAREERS_URL, { waitUntil: "networkidle", timeout: 30000 });

    const url = page.url();

    if (
      url.includes("login.microsoftonline.com") ||
      url.includes("login.live.com") ||
      url.includes("/common/oauth2/authorize")
    ) {
      logger.warn("Session expired - redirected to login page");
      return false;
    }

    if (url.includes("apply.careers.microsoft.com")) {
      logger.info("Session is valid");
      return true;
    }

    logger.warn(`Unexpected URL after navigation: ${url}`);
    return false;
  } catch (err) {
    logger.error("Session verification failed", err as Error);
    return false;
  } finally {
    await page.close();
  }
}

function waitForUserInput(): Promise<void> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode?.(false);
      process.stdin.resume();
      process.stdin.once("data", () => {
        process.stdin.pause();
        resolve();
      });
    } else {
      setTimeout(resolve, 5000);
    }
  });
}

async function main() {
  const authStatePath = "auth.json";

  if (fs.existsSync(authStatePath)) {
    logger.info("auth.json already exists. Delete it to re-login.");
    process.exit(0);
  }

  logger.info("Launching browser for manual login...");
  const context = await chromium.launchPersistentContext(authStatePath, {
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await context.newPage();
  logger.info("Navigating to Microsoft Careers...");
  await page.goto(CAREERS_URL, { waitUntil: "networkidle", timeout: 60000 });

  logger.info("");
  logger.info("================================================");
  logger.info("  Log in to your Microsoft account in the browser");
  logger.info("  Press ENTER here when you see your applications page");
  logger.info("================================================");
  logger.info("");

  await waitForUserInput();

  await page.close();
  await context.close();

  logger.info("Session saved to auth.json");
  logger.info("Run 'npm start' to begin monitoring");
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("Login failed", err);
    process.exit(1);
  });
}
