/**
 * Step Recorder - Records step I/O for debugging and replay
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { jobsRepository } from '../db/repositories/jobs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface StepRecording {
  stepName: string;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  input: unknown;
  output?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
  success: boolean;
}

export interface JobRecording {
  jobId: string;
  directoryId?: number;
  startTime: string;
  endTime?: string;
  steps: StepRecording[];
}

/**
 * Step Recorder class for tracking pipeline execution
 */
export class StepRecorder {
  private jobId: string;
  private debugDir: string;
  private recording: JobRecording;
  private currentStep: StepRecording | null = null;

  constructor(jobId: string, directoryId?: number) {
    this.jobId = jobId;
    this.debugDir = join(__dirname, '../../debug/jobs', jobId);

    // Ensure debug directory exists
    if (!existsSync(this.debugDir)) {
      mkdirSync(this.debugDir, { recursive: true });
    }

    // Update latest reference file (on Windows, symlinks require admin)
    try {
      writeFileSync(join(__dirname, '../../debug/latest.txt'), jobId);
    } catch {
      // Ignore file write errors
    }

    this.recording = {
      jobId,
      directoryId,
      startTime: new Date().toISOString(),
      steps: [],
    };
  }

  /**
   * Record step start
   */
  recordStepStart(stepName: string, input: unknown): void {
    this.currentStep = {
      stepName,
      startTime: new Date().toISOString(),
      input,
      success: false,
    };

    // Save input to file
    const inputPath = join(this.debugDir, `${stepName}_input.json`);
    writeFileSync(inputPath, JSON.stringify(input, null, 2));

    // Store in database
    jobsRepository.storeStepOutput(this.jobId, stepName, input, null, 0, false);
  }

  /**
   * Record step end (success)
   */
  recordStepEnd(stepName: string, output: unknown, durationMs: number): void {
    if (this.currentStep && this.currentStep.stepName === stepName) {
      this.currentStep.endTime = new Date().toISOString();
      this.currentStep.durationMs = durationMs;
      this.currentStep.output = output;
      this.currentStep.success = true;

      this.recording.steps.push(this.currentStep);

      // Save output to file
      const outputPath = join(this.debugDir, `${stepName}_output.json`);
      writeFileSync(outputPath, JSON.stringify(output, null, 2));

      // Update database
      jobsRepository.storeStepOutput(this.jobId, stepName, this.currentStep.input, output, durationMs, true);

      this.currentStep = null;
    }
  }

  /**
   * Record step error
   */
  recordStepError(stepName: string, error: Error, durationMs: number): void {
    if (this.currentStep && this.currentStep.stepName === stepName) {
      this.currentStep.endTime = new Date().toISOString();
      this.currentStep.durationMs = durationMs;
      this.currentStep.error = {
        message: error.message,
        stack: error.stack,
      };
      this.currentStep.success = false;

      this.recording.steps.push(this.currentStep);

      // Save error to file
      const errorPath = join(this.debugDir, `${stepName}_error.json`);
      writeFileSync(errorPath, JSON.stringify({
        message: error.message,
        stack: error.stack,
        input: this.currentStep.input,
      }, null, 2));

      // Update database
      jobsRepository.storeStepOutput(
        this.jobId,
        stepName,
        this.currentStep.input,
        null,
        durationMs,
        false,
        error.message
      );

      this.currentStep = null;
    }
  }

  /**
   * Save a screenshot
   */
  saveScreenshot(name: string, data: Buffer | string): string {
    const screenshotPath = join(this.debugDir, `${name}.png`);

    if (typeof data === 'string') {
      // Base64 encoded
      writeFileSync(screenshotPath, Buffer.from(data, 'base64'));
    } else {
      writeFileSync(screenshotPath, data);
    }

    return screenshotPath;
  }

  /**
   * Save HTML content
   */
  saveHtml(name: string, html: string): string {
    const htmlPath = join(this.debugDir, `${name}.html`);
    writeFileSync(htmlPath, html);
    return htmlPath;
  }

  /**
   * Save arbitrary data
   */
  saveData(name: string, data: unknown): string {
    const dataPath = join(this.debugDir, `${name}.json`);
    writeFileSync(dataPath, JSON.stringify(data, null, 2));
    return dataPath;
  }

  /**
   * Finalize and save the complete recording
   */
  finalize(): void {
    this.recording.endTime = new Date().toISOString();

    const summaryPath = join(this.debugDir, 'summary.json');
    writeFileSync(summaryPath, JSON.stringify(this.recording, null, 2));
  }

  /**
   * Get recording for a step
   */
  getRecording(stepName: string): StepRecording | undefined {
    return this.recording.steps.find(s => s.stepName === stepName);
  }

  /**
   * Get the debug directory path
   */
  getDebugDir(): string {
    return this.debugDir;
  }
}

/**
 * Load a recording from file
 */
export function loadRecording(jobId: string): JobRecording | null {
  const recordingPath = join(__dirname, '../../debug/jobs', jobId, 'summary.json');

  if (!existsSync(recordingPath)) {
    return null;
  }

  const content = readFileSync(recordingPath, 'utf-8');
  return JSON.parse(content) as JobRecording;
}

/**
 * Load step input from file
 */
export function loadStepInput(jobId: string, stepName: string): unknown | null {
  const inputPath = join(__dirname, '../../debug/jobs', jobId, `${stepName}_input.json`);

  if (!existsSync(inputPath)) {
    return null;
  }

  const content = readFileSync(inputPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Load step output from file
 */
export function loadStepOutput(jobId: string, stepName: string): unknown | null {
  const outputPath = join(__dirname, '../../debug/jobs', jobId, `${stepName}_output.json`);

  if (!existsSync(outputPath)) {
    return null;
  }

  const content = readFileSync(outputPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Create a step recorder for a job
 */
export function createStepRecorder(jobId: string, directoryId?: number): StepRecorder {
  return new StepRecorder(jobId, directoryId);
}

export default StepRecorder;
