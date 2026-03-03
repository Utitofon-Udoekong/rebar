import chalk from "chalk";
import { getConfig } from "../config/index.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  const config = getConfig();
  return LOG_LEVELS[level] >= LOG_LEVELS[config.logLevel];
}

function timestamp(): string {
  return new Date().toISOString().substring(11, 19);
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog("debug")) {
      console.log(chalk.dim(`  ${message}`), ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.log(chalk.dim(`  ${message}`), ...args);
    }
  },

  success(message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.log(chalk.yellow(`✓ ${message}`), ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog("warn")) {
      console.log(chalk.yellow(`⚠ ${message}`), ...args);
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog("error")) {
      console.error(chalk.red(`✗ ${message}`), ...args);
    }
  },

  // Special formatting for agent events
  // Special formatting for agent events
  job(action: string, jobId: string, details?: string): void {
    if (shouldLog("info")) {
      if (action === "Found" || action === "Processing") {
        console.log(chalk.dim(`\n──────────────────────────────────────────────────\n`));
        console.log(chalk.dim(`JOB ${action.toUpperCase()} · ${details || jobId}`));
        console.log(chalk.dim(`──────────────────────────────────────────────────\n`));
      } else {
        console.log(chalk.yellow(`✓ ${action} ${details ? `· ${details}` : ""}`));
      }
    }
  },

  tool(name: string, status: "start" | "success" | "error", details?: string): void {
    if (shouldLog("debug")) {
      if (status === "start") {
        console.log(chalk.dim(`→ tool: `) + chalk.yellow(name));
      } else if (status === "error") {
        console.log(chalk.red(`✗ tool error: `) + chalk.dim(name) + (details ? chalk.dim(` · ${details}`) : ""));
      } else {
        console.log(chalk.yellow(`✓ tool success: `) + chalk.dim(name));
      }
    }
  },
};

export default logger;
