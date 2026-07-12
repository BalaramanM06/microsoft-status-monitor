import dotenv from "dotenv";
import path from "path";
import { Config } from "./types";

dotenv.config();

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function loadConfig(): Config {
  return {
    telegramToken: getEnv("TELEGRAM_TOKEN"),
    telegramChatId: getEnv("TELEGRAM_CHAT_ID"),
    checkInterval: parseInt(getEnv("CHECK_INTERVAL", "30"), 10),
    headless: getEnv("HEADLESS", "true") === "true",
    authStatePath: path.resolve("auth.json"),
    stateFilePath: path.resolve("state.json"),
    screenshotDir: path.resolve("screenshots"),
  };
}
