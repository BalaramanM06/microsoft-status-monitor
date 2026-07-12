import { chromium, Browser, BrowserContext } from "playwright";
import fs from "fs";
import { logger } from "./logger";

const CAREERS_URL =
  "https://apply.careers.microsoft.com/careers/applications?hl=en&domain=microsoft.com";

export async function createAuthenticatedContext(
  authStatePath: string,
  headless: boolean
): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({
    headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  if (fs.existsSync(authStatePath)) {
    logger.info("Found existing auth state, attempting to reuse...");
    const context = await browser.newContext({ storageState: authStatePath });
    return { browser, context };
  }

  logger.info("No auth state found. Run 'npm run login' first.");
  await browser.close();
  throw new Error("No auth.json found. Run 'npm run login' first to authenticate.");
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

  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext();
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

  await context.storageState({ path: authStatePath });
  logger.info("Session saved to auth.json");

  await page.close();
  await context.close();
  await browser.close();

  logger.info("Run 'npm start' to begin monitoring");
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("Login failed", err);
    process.exit(1);
  });
}
