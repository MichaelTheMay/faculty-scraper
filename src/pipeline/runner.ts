/**
 * Pipeline Runner - Orchestrates pipeline step execution
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Directory,
  Step1Output,
  Step2Output,
  Step3Output,
  Step7Output,
  Step8Output,
  ScrapeResult,
} from './types.js';
import { directoriesRepository } from '../db/repositories/directories.js';
import { jobsRepository } from '../db/repositories/jobs.js';
import { createJobLogger, JobLogger } from '../debug/logger.js';
import { createStepRecorder, StepRecorder } from '../debug/step-recorder.js';

// Import pipeline steps
import { runStep4 } from './steps/04-extract-cards.js';
import { runStep5 } from './steps/05-parse-normalize.js';
import { runStep6 } from './steps/06-deduplicate.js';
import { runStep7 } from './steps/07-persist.js';
import { runStep8 } from './steps/08-queue-enrich.js';

export interface PipelineOptions {
  mode: 'full' | 'test';
  debug?: boolean;
  stopAfterStep?: string;
  dryRun?: boolean;
}

export interface PipelineContext {
  jobId: string;
  directoryId: number;
  directory: Directory;
  logger: JobLogger;
  recorder: StepRecorder;
  options: PipelineOptions;
}

/**
 * Run the complete scraping pipeline for a directory
 */
export async function runPipeline(
  directoryId: number,
  options: PipelineOptions = { mode: 'full' }
): Promise<ScrapeResult> {
  // Load directory
  const directory = directoriesRepository.findById(directoryId);
  if (!directory) {
    throw new Error(`Directory not found: ${directoryId}`);
  }

  // Create job
  const jobId = uuidv4();
  jobsRepository.create({
    directory_id: directoryId,
    scrape_type: options.mode === 'test' ? 'test' : 'full',
  });

  // Create context
  const logger = createJobLogger(jobId);
  const recorder = createStepRecorder(jobId, directoryId);

  const context: PipelineContext = {
    jobId,
    directoryId,
    directory,
    logger,
    recorder,
    options,
  };

  logger.info(`Starting pipeline for ${directory.university} - ${directory.department}`);
  jobsRepository.updateStatus(jobId, 'running');

  const startTime = Date.now();
  const errors: string[] = [];

  try {
    // Step 1: Load Config
    const step1Output = await runStepWithTracking(context, 'step1', async () => {
      return {
        directory,
        url: directory.directory_url,
        scrape_method: directory.scrape_method,
        selectors: directory.scrape_config?.selectors || {},
        load_more_config: directory.scrape_config?.load_more_selector
          ? {
              selector: directory.scrape_config.load_more_selector,
              max_clicks: 50,
              wait_between_clicks_ms: 1000,
            }
          : undefined,
        scroll_config: directory.scrape_config?.scroll_config,
        use_step0_html: false,
      } as Step1Output;
    });

    if (options.stopAfterStep === 'step1') {
      return createResult(context, startTime, errors, 0, 0, 0);
    }

    // Step 2: Fetch Content
    // For now, we'll use a placeholder - actual implementation would use scrapers
    const step2Output = await runStepWithTracking(context, 'step2', async () => {
      // In a real implementation, this would call the appropriate scraper
      // For now, return placeholder
      logger.warn('Step 2 (Fetch Content) using placeholder - implement scraper integration');
      return {
        html: '<html><body>Placeholder content</body></html>',
        links: [],
        fetch_time_ms: 0,
        from_cache: false,
      } as Step2Output;
    });

    if (options.stopAfterStep === 'step2') {
      return createResult(context, startTime, errors, 0, 0, 0);
    }

    // Step 3: Handle Dynamic Content
    const step3Output = await runStepWithTracking(context, 'step3', async () => {
      // Dynamic content already handled or not needed
      return {
        final_html: step2Output.html,
        clicks_performed: 0,
        scroll_distance: 0,
        screenshots: [],
        dynamic_content_found: false,
      } as Step3Output;
    });

    if (options.stopAfterStep === 'step3') {
      return createResult(context, startTime, errors, 0, 0, 0);
    }

    // Step 4: Extract Cards
    const step4Output = await runStepWithTracking(context, 'step4', async () => {
      return runStep4({
        html: step3Output.final_html,
        selectors: step1Output.selectors,
      });
    });

    logger.info(`Extracted ${step4Output.raw_cards.length} researcher cards`);

    if (options.stopAfterStep === 'step4') {
      return createResult(context, startTime, errors, step4Output.raw_cards.length, 0, 0);
    }

    // Step 5: Parse and Normalize
    const step5Output = await runStepWithTracking(context, 'step5', async () => {
      return runStep5({
        raw_cards: step4Output.raw_cards,
        university: directory.university,
        department: directory.department,
      });
    });

    logger.info(`Parsed ${step5Output.researchers.length} researchers, ${step5Output.parse_errors.length} errors`);

    if (step5Output.parse_errors.length > 0) {
      errors.push(`${step5Output.parse_errors.length} parse errors`);
    }

    if (options.stopAfterStep === 'step5') {
      return createResult(context, startTime, errors, step5Output.researchers.length, 0, 0);
    }

    // Step 6: Deduplicate
    const step6Output = await runStepWithTracking(context, 'step6', async () => {
      return runStep6({
        researchers: step5Output.researchers,
        directory_id: directoryId,
      });
    });

    logger.info(`Dedup: ${step6Output.stats.to_insert} new, ${step6Output.stats.to_update} updates, ${step6Output.stats.duplicates} duplicates`);

    if (options.stopAfterStep === 'step6') {
      return createResult(
        context,
        startTime,
        errors,
        step5Output.researchers.length,
        step6Output.stats.to_insert,
        step6Output.stats.to_update
      );
    }

    // Step 7: Persist (skip in dry run)
    let step7Output: Step7Output;
    if (options.dryRun) {
      logger.info('Dry run - skipping database persist');
      step7Output = {
        inserted_ids: [],
        updated_ids: [],
        job_stats: {
          records_created: 0,
          records_updated: 0,
          records_skipped: step6Output.stats.duplicates,
        },
      };
    } else {
      step7Output = await runStepWithTracking(context, 'step7', async () => {
        return runStep7({
          to_insert: step6Output.to_insert,
          to_update: step6Output.to_update,
          job_id: jobId,
          directory_id: directoryId,
        });
      });
    }

    logger.info(`Persisted: ${step7Output.job_stats.records_created} created, ${step7Output.job_stats.records_updated} updated`);

    if (options.stopAfterStep === 'step7') {
      return createResult(
        context,
        startTime,
        errors,
        step5Output.researchers.length,
        step7Output.job_stats.records_created,
        step7Output.job_stats.records_updated
      );
    }

    // Step 8: Queue for Enrichment
    const allIds = [...step7Output.inserted_ids, ...step7Output.updated_ids];
    let step8Output: Step8Output;

    if (allIds.length > 0 && !options.dryRun) {
      step8Output = await runStepWithTracking(context, 'step8', async () => {
        return runStep8({
          researcher_ids: allIds,
          priority: 5,
        });
      });

      logger.info(`Queued ${step8Output.queued_count} researchers for enrichment`);
    } else {
      step8Output = {
        queued_count: 0,
        already_queued: 0,
        queue_positions: [],
      };
    }

    // Update directory last scraped
    if (!options.dryRun) {
      directoriesRepository.updateLastScraped(directoryId, step5Output.researchers.length);
    }

    // Finalize job
    jobsRepository.updateStatus(jobId, 'success');
    recorder.finalize();

    return createResult(
      context,
      startTime,
      errors,
      step5Output.researchers.length,
      step7Output.job_stats.records_created,
      step7Output.job_stats.records_updated
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Pipeline failed: ${errorMessage}`);
    jobsRepository.updateStatus(jobId, 'failed', errorMessage);
    recorder.finalize();

    return {
      job_id: jobId,
      status: 'failed',
      records_found: 0,
      records_created: 0,
      records_updated: 0,
      duration_seconds: Math.floor((Date.now() - startTime) / 1000),
      errors: [errorMessage, ...errors],
    };
  }
}

/**
 * Run a step with timing and recording
 */
async function runStepWithTracking<T>(
  context: PipelineContext,
  stepName: string,
  stepFn: () => Promise<T>
): Promise<T> {
  const { logger, recorder } = context;

  logger.stepStart(stepName);
  jobsRepository.updateCurrentStep(context.jobId, stepName);

  const startTime = Date.now();

  try {
    recorder.recordStepStart(stepName, {});
    const result = await stepFn();
    const durationMs = Date.now() - startTime;

    recorder.recordStepEnd(stepName, result, durationMs);
    logger.stepComplete(stepName, durationMs);

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    recorder.recordStepError(stepName, error as Error, durationMs);
    logger.stepFailed(stepName, error as Error, durationMs);
    throw error;
  }
}

/**
 * Create a scrape result object
 */
function createResult(
  context: PipelineContext,
  startTime: number,
  errors: string[],
  recordsFound: number,
  recordsCreated: number,
  recordsUpdated: number
): ScrapeResult {
  return {
    job_id: context.jobId,
    status: errors.length > 0 && recordsFound === 0 ? 'failed' : 'success',
    records_found: recordsFound,
    records_created: recordsCreated,
    records_updated: recordsUpdated,
    duration_seconds: Math.floor((Date.now() - startTime) / 1000),
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Run a single step with provided input
 */
export async function runStep(stepName: string, input: unknown): Promise<unknown> {
  switch (stepName) {
    case 'step4':
      return runStep4(input as Parameters<typeof runStep4>[0]);
    case 'step5':
      return runStep5(input as Parameters<typeof runStep5>[0]);
    case 'step6':
      return runStep6(input as Parameters<typeof runStep6>[0]);
    case 'step7':
      return runStep7(input as Parameters<typeof runStep7>[0]);
    case 'step8':
      return runStep8(input as Parameters<typeof runStep8>[0]);
    default:
      throw new Error(`Unknown step: ${stepName}`);
  }
}

/**
 * Run pipeline up to a specific step
 */
export async function runPipelineUntil(
  directoryId: number,
  stopAfterStep: string
): Promise<ScrapeResult> {
  return runPipeline(directoryId, { mode: 'full', stopAfterStep });
}

export default runPipeline;
