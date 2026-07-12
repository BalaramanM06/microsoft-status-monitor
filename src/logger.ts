export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const CURRENT_LEVEL = LogLevel.DEBUG;

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").replace(/\.\d+Z/, "");
}

export const logger = {
  debug(message: string): void {
    if (CURRENT_LEVEL <= LogLevel.DEBUG) {
      console.log(`[${timestamp()}] [DEBUG] ${message}`);
    }
  },

  info(message: string): void {
    if (CURRENT_LEVEL <= LogLevel.INFO) {
      console.log(`[${timestamp()}] ${message}`);
    }
  },

  warn(message: string): void {
    if (CURRENT_LEVEL <= LogLevel.WARN) {
      console.warn(`[${timestamp()}] [WARN] ${message}`);
    }
  },

  error(message: string, error?: Error): void {
    if (CURRENT_LEVEL <= LogLevel.ERROR) {
      console.error(`[${timestamp()}] [ERROR] ${message}`);
      if (error) {
        console.error(`  ${error.message}`);
        if (error.stack) {
          console.error(`  ${error.stack.split("\n").slice(1).join("\n  ")}`);
        }
      }
    }
  },

  divider(): void {
    console.log(`[${timestamp()}] ${"─".repeat(50)}`);
  },
};
