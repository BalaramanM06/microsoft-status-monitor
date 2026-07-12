export interface Application {
  id: string;
  jobTitle: string;
  status: string;
  interviewStage?: string;
  lastUpdated?: string;
  jobId?: string;
  location?: string;
  dateApplied?: string;
}

export interface StoredState {
  applications: Record<string, Application>;
  lastChecked: string;
}

export interface Config {
  telegramToken: string;
  telegramChatId: string;
  checkInterval: number;
  headless: boolean;
  authStatePath: string;
  stateFilePath: string;
  screenshotDir: string;
}

export interface StatusChange {
  applicationId: string;
  jobTitle: string;
  oldStatus: string;
  newStatus: string;
  oldInterviewStage?: string;
  newInterviewStage?: string;
  changedAt: string;
}

export type MonitorResult =
  | { type: "no_change" }
  | { type: "changes_detected"; changes: StatusChange[] }
  | { type: "error"; message: string };
