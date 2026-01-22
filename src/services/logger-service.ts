import { join } from "node:path";
import fse from "fs-extra";
import pc from "picocolors";
import { getLogsDir } from "../utils/paths";

function getTimestampPrefix(): string {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = now.toTimeString().split(" ")[0].replace(/:/g, "-");
  return `${date}-${time}`;
}

function getLogFilePath(name: string): string {
  return join(getLogsDir(), `${getTimestampPrefix()}-${name}.log`);
}

export interface LoggerServiceOptions {
  verbose?: boolean;
}

export class LoggerService {
  private stream: fse.WriteStream | null = null;
  private currentLogFile: string | null = null;
  private readonly verbose: boolean;

  constructor(options: LoggerServiceOptions = {}) {
    this.verbose = options.verbose ?? false;
  }

  get logFile(): string | null {
    return this.currentLogFile;
  }

  startSessionLog(sessionId: string): void {
    this.close();
    fse.ensureDirSync(getLogsDir());
    this.currentLogFile = getLogFilePath(`plan-${sessionId.slice(0, 8)}`);
    this.stream = fse.createWriteStream(this.currentLogFile, { flags: "a" });
  }

  startTaskLog(taskId: string): void {
    this.close();
    fse.ensureDirSync(getLogsDir());
    this.currentLogFile = getLogFilePath(taskId);
    this.stream = fse.createWriteStream(this.currentLogFile, { flags: "a" });
  }

  log(msg: string): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] ${msg}\n`;
    this.stream?.write(formatted);
    if (this.verbose) {
      console.log(pc.gray(`[${timestamp}]`), msg);
    }
  }

  close(): void {
    if (this.stream) {
      this.stream.close();
      this.stream = null;
    }
  }
}
