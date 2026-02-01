/**
 * Structured Debug Logger - Winston-based logging with job context
 */

import winston from 'winston';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure log directory exists
const logDir = join(__dirname, '../../debug/logs');
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

// Custom format for structured logs
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf((info) => {
    const { timestamp, level, message, jobId, step, ...meta } = info;
    let prefix = '';
    if (jobId && typeof jobId === 'string') prefix += `[${jobId.substring(0, 8)}]`;
    if (step) prefix += `[${step}]`;
    if (prefix) prefix += ' ';

    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${prefix}${message}${metaStr}`;
  })
);

// Create the main logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  defaultMeta: { service: 'faculty-scraper' },
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: join(logDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: join(logDir, 'combined.log'),
    }),
  ],
});

// Add console transport in non-production
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

/**
 * Job-scoped logger that adds job context to all messages
 */
export class JobLogger {
  private jobId: string;
  private currentStep: string | null = null;

  constructor(jobId: string) {
    this.jobId = jobId;
  }

  setStep(step: string): void {
    this.currentStep = step;
  }

  private log(level: string, message: string, meta?: Record<string, unknown>): void {
    logger.log({
      level,
      message,
      jobId: this.jobId,
      step: this.currentStep,
      ...meta,
    });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  /**
   * Log step start with input summary
   */
  stepStart(stepName: string, inputSummary?: Record<string, unknown>): void {
    this.setStep(stepName);
    this.info(`Starting step: ${stepName}`, { inputSummary });
  }

  /**
   * Log step completion with output summary
   */
  stepComplete(stepName: string, durationMs: number, outputSummary?: Record<string, unknown>): void {
    this.info(`Completed step: ${stepName} in ${durationMs}ms`, { durationMs, outputSummary });
    this.currentStep = null;
  }

  /**
   * Log step failure
   */
  stepFailed(stepName: string, error: Error, durationMs: number): void {
    this.error(`Failed step: ${stepName} after ${durationMs}ms`, {
      durationMs,
      error: error.message,
      stack: error.stack,
    });
    this.currentStep = null;
  }

  /**
   * Log extraction progress
   */
  extractionProgress(current: number, total: number, details?: Record<string, unknown>): void {
    this.debug(`Extraction progress: ${current}/${total}`, { current, total, ...details });
  }

  /**
   * Log database operation
   */
  dbOperation(operation: string, table: string, count: number): void {
    this.debug(`DB ${operation}: ${count} records in ${table}`, { operation, table, count });
  }
}

/**
 * Create a job-scoped logger
 */
export function createJobLogger(jobId: string): JobLogger {
  return new JobLogger(jobId);
}

/**
 * Global logger for non-job-specific logging
 */
export const globalLogger = {
  debug: (message: string, meta?: Record<string, unknown>) => logger.debug(message, meta),
  info: (message: string, meta?: Record<string, unknown>) => logger.info(message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => logger.warn(message, meta),
  error: (message: string, meta?: Record<string, unknown>) => logger.error(message, meta),
};

export default logger;
