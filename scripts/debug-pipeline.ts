#!/usr/bin/env node
/**
 * Debug full pipeline with verbose logging
 *
 * Usage:
 *   npx tsx scripts/debug-pipeline.ts --directory <id> [--until <step>] [--verbose]
 *
 * Options:
 *   --directory, -d   Directory ID to debug
 *   --until, -u       Stop after this step (e.g., step5)
 *   --verbose, -v     Show detailed output for each step
 */

import { initializeDatabase, closeDatabase } from '../src/db/connection.js';
import { directoriesRepository } from '../src/db/repositories/directories.js';
import { runPipeline } from '../src/pipeline/runner.js';
import { StepRecorder } from '../src/debug/step-recorder.js';
import { globalLogger } from '../src/debug/logger.js';

interface DebugOptions {
  directoryId?: number;
  untilStep?: string;
  verbose: boolean;
}

function parseArgs(): DebugOptions {
  const args = process.argv.slice(2);
  const options: DebugOptions = {
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--directory':
      case '-d':
        options.directoryId = parseInt(next, 10);
        i++;
        break;
      case '--until':
      case '-u':
        options.untilStep = next;
        i++;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
    }
  }

  return options;
}

async function debugPipeline(options: DebugOptions): Promise<void> {
  if (!options.directoryId) {
    console.log('Debug Full Pipeline');
    console.log('='.repeat(50));
    console.log('');
    console.log('Usage:');
    console.log('  npx tsx scripts/debug-pipeline.ts -d <directory_id> [-u <step>] [-v]');
    console.log('');
    console.log('Options:');
    console.log('  -d, --directory  Directory ID to debug');
    console.log('  -u, --until      Stop after this step (e.g., step5)');
    console.log('  -v, --verbose    Show detailed output');
    console.log('');
    console.log('Example:');
    console.log('  npx tsx scripts/debug-pipeline.ts -d 1 -u step5 -v');
    console.log('');
    return;
  }

  console.log('Initializing database...');
  initializeDatabase();

  try {
    const directory = directoriesRepository.findById(options.directoryId);
    if (!directory) {
      throw new Error(`Directory ${options.directoryId} not found`);
    }

    console.log('\nDirectory Info:');
    console.log(`  ID: ${directory.id}`);
    console.log(`  University: ${directory.university}`);
    console.log(`  Department: ${directory.department}`);
    console.log(`  URL: ${directory.directory_url}`);
    console.log(`  Method: ${directory.scrape_method}`);

    // Create step recorder for this debug session
    const recorder = new StepRecorder(`debug-${Date.now()}`);

    console.log('\n' + '='.repeat(50));
    console.log('Starting Pipeline');
    console.log('='.repeat(50));

    const pipelineOptions: { mode: 'test' | 'full'; untilStep?: string } = {
      mode: 'test', // Use test mode for debugging
    };

    if (options.untilStep) {
      pipelineOptions.untilStep = options.untilStep;
      console.log(`Will stop after: ${options.untilStep}`);
    }

    const startTime = Date.now();
    const result = await runPipeline(options.directoryId, pipelineOptions);
    const duration = Date.now() - startTime;

    console.log('\n' + '='.repeat(50));
    console.log('Pipeline Complete');
    console.log('='.repeat(50));

    console.log(`\nDuration: ${duration}ms`);
    console.log(`Job ID: ${result.job_id}`);
    console.log(`Status: ${result.status}`);
    console.log(`Records Found: ${result.records_found}`);
    console.log(`Records Created: ${result.records_created}`);
    console.log(`Records Updated: ${result.records_updated}`);

    if (result.error) {
      console.log(`\nError: ${result.error}`);
    }

    // Show debug output location
    const debugDir = recorder.getDebugDir();
    console.log(`\nDebug output saved to: ${debugDir}`);

    if (options.verbose) {
      console.log('\nStep Details:');
      const summary = recorder.getSummary();
      for (const step of summary.steps) {
        console.log(`\n  ${step.step}:`);
        console.log(`    Status: ${step.success ? 'success' : 'failed'}`);
        console.log(`    Duration: ${step.duration_ms}ms`);
        if (!step.success && step.error) {
          console.log(`    Error: ${step.error}`);
        }
      }
    }

    globalLogger.info('Debug pipeline completed', {
      directory_id: options.directoryId,
      job_id: result.job_id,
      status: result.status,
      duration_ms: duration,
    });
  } finally {
    closeDatabase();
  }
}

// Main
debugPipeline(parseArgs()).catch((error) => {
  console.error('Debug pipeline failed:', error);
  process.exit(1);
});
