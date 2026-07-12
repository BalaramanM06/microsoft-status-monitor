import fs from "fs";
import path from "path";
import { StoredState, Application } from "./types";
import { logger } from "./logger";

export class Storage {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  load(): StoredState {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const state = JSON.parse(raw) as StoredState;
        logger.debug(`Loaded state from ${this.filePath}`);
        return state;
      }
    } catch (err) {
      logger.warn(`Failed to load state from ${this.filePath}, starting fresh`);
    }
    return { applications: {}, lastChecked: "" };
  }

  save(state: StoredState): void {
    this.ensureDirectory();
    const data = JSON.stringify(state, null, 2);
    fs.writeFileSync(this.filePath, data, "utf-8");
    logger.debug(`Saved state to ${this.filePath}`);
  }

  updateApplication(id: string, application: Application): void {
    const state = this.load();
    state.applications[id] = application;
    state.lastChecked = new Date().toISOString();
    this.save(state);
  }

  updateApplications(applications: Application[]): void {
    const state = this.load();
    for (const app of applications) {
      state.applications[app.id] = app;
    }
    state.lastChecked = new Date().toISOString();
    this.save(state);
  }

  getApplication(id: string): Application | undefined {
    const state = this.load();
    return state.applications[id];
  }

  getAllApplications(): Record<string, Application> {
    const state = this.load();
    return state.applications;
  }
}
