import TelegramBot from "node-telegram-bot-api";
import { StatusChange, Application, Config } from "./types";
import { logger } from "./logger";

export class TelegramNotifier {
  private bot: TelegramBot;
  private chatId: string;

  constructor(config: Config) {
    this.bot = new TelegramBot(config.telegramToken, { polling: false });
    this.chatId = config.telegramChatId;
  }

  async sendMessage(text: string): Promise<boolean> {
    try {
      await this.bot.sendMessage(this.chatId, text, { parse_mode: "Markdown" });
      logger.info("Telegram notification sent successfully");
      return true;
    } catch (err) {
      logger.error("Failed to send Telegram notification", err as Error);
      try {
        await this.bot.sendMessage(this.chatId, text);
        logger.info("Telegram notification sent (without markdown)");
        return true;
      } catch (fallbackErr) {
        logger.error("Telegram fallback also failed", fallbackErr as Error);
        return false;
      }
    }
  }

  async sendPhoto(photoPath: string, caption?: string): Promise<boolean> {
    try {
      await this.bot.sendPhoto(this.chatId, photoPath, { caption });
      logger.info("Telegram photo sent successfully");
      return true;
    } catch (err) {
      logger.error("Failed to send Telegram photo", err as Error);
      return false;
    }
  }

  async notifyStatusChange(change: StatusChange): Promise<boolean> {
    const stageInfo =
      change.oldInterviewStage || change.newInterviewStage
        ? `\n*Interview Stage:* ${change.oldInterviewStage || "N/A"} → ${change.newInterviewStage || "N/A"}`
        : "";

    const message = [
      "🚀 *Microsoft Careers Update*",
      "",
      `*Job:* ${change.jobTitle}`,
      `*Application ID:* ${change.applicationId}`,
      "",
      `*Old Status:* ${change.oldStatus}`,
      `*New Status:* ${change.newStatus}`,
      stageInfo,
      "",
      `*Time:* ${this.formatIST(change.changedAt)}`,
    ]
      .filter(Boolean)
      .join("\n");

    return this.sendMessage(message);
  }

  async notifySessionExpired(): Promise<boolean> {
    const message = [
      "⚠️ *Microsoft Careers Monitor*",
      "",
      "Microsoft login session has expired.",
      "Please log in again by running:",
      "```npm run login```",
      "",
      `Time: ${this.formatIST(new Date().toISOString())}`,
    ].join("\n");

    return this.sendMessage(message);
  }

  async notifyError(error: string): Promise<boolean> {
    const message = [
      "❌ *Microsoft Careers Monitor - Error*",
      "",
      error,
      "",
      `Time: ${this.formatIST(new Date().toISOString())}`,
    ].join("\n");

    return this.sendMessage(message);
  }

  async sendHeartbeat(
    applications: Application[],
    lastChecked: string
  ): Promise<boolean> {
    const appLines = Object.values(applications).map(
      (app) => `• *${app.jobTitle}*: ${app.status}`
    );

    const message = [
      "💚 *Microsoft Careers Monitor*",
      "",
      "Running successfully.",
      "",
      `*Applications (${Object.keys(applications).length}):*`,
      ...appLines,
      "",
      `*Last Checked:* ${this.formatIST(lastChecked)}`,
    ].join("\n");

    return this.sendMessage(message);
  }

  private formatIST(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }
}
