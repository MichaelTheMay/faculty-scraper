#!/usr/bin/env node
/**
 * Run scraping pipeline
 *
 * Usage:
 *   npx tsx scripts/run-scrape.ts [options]
 *
 * Options:
 *   --directory, -d   Directory ID to scrape
 *   --all, -a         Scrape all active directories
 *   --mode, -m        Scrape mode: full | test (default: full)
 *   --parallel, -p    Parallel scrapes for --all (default: 3)
 */

import { initializeDatabase, closeDatabase, getDatabaseStats } from '../src/db/connection.js';
import { directoriesRepository } from '../src/db/repositories/directories.js';
import { runPipeline } from '../src/pipeline/runner.js';

interface ScrapeOptions {
  directoryId?: number;
  all: boolean;
  mode: 'full' | 'test';
  parallel: number;
}

function parseArgs(): ScrapeOptions {
  const args = process.argv.slice(2);
  const options: ScrapeOptions = {
    all: false,
    mode: 'full',
    parallel: 3,
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
      case '--all':
      case '-a':
        options.all = true;
        break;
      case '--mode':
      case '-m':
        options.mode = next as 'full' | 'test';
        i++;
        break;
      case '--parallel':
      case '-p':
        options.parallel = parseInt(next, 10);
        i++;
        break;
    }
  }

  return options;
}

async function runScrape(options: ScrapeOptions): Promise<void> {
  console.log('Initializing database...');
  initializeDatabase();

  try {
    if (options.directoryId) {
      // Scrape single directory
      console.log(`\nScraping directory ${options.directoryId} in ${options.mode} mode...`);

      const directory = directoriesRepository.findById(options.directoryId);
      if (!directory) {
        throw new Error(`Directory ${options.directoryId} not found`);
      }

      console.log(`University: ${directory.university}`);
      console.log(`Department: ${directory.department}`);
      console.log(`URL: ${directory.directory_url}`);
      console.log(`Method: ${directory.scrape_method}`);
      console.log('');

      const result = await runPipeline(options.directoryId, { mode: options.mode });

      console.log('\nResult:');
      console.log(`  Job ID: ${result.job_id}`);
      console.log(`  Status: ${result.status}`);
      console.log(`  Records Found: ${result.records_found}`);
      console.log(`  Records Created: ${result.records_created}`);
      console.log(`  Records Updated: ${result.records_updated}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    } else if (options.all) {
      // Scrape all active directories
      const directories = directoriesRepository.findAll(true);
      console.log(`\nScraping ${directories.length} active directories in ${options.mode} mode...`);
      console.log(`Parallel: ${options.parallel}`);
      console.log('');

      const results = [];

      // Run in batches
      for (let i = 0; i < directories.length; i += options.parallel) {
        const batch = directories.slice(i, i + options.parallel);
        console.log(`\nBatch ${Math.floor(i / options.parallel) + 1}:`);

        for (const dir of batch) {
          console.log(`  - ${dir.university} / ${dir.department}`);
        }

        const batchResults = await Promise.allSettled(
          batch.map((d) => runPipeline(d.id, { mode: options.mode }))
        );

        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          const dir = batch[j];

          results.push({
            directory_id: dir.id,
            university: dir.university,
            department: dir.department,
            status: result.status === 'fulfilled' ? result.value.status : 'failed',
            records_found: result.status === 'fulfilled' ? result.value.records_found : 0,
            error: result.status === 'rejected' ? String(result.reason) : undefined,
          });
        }
      }

      // Summary
      console.log('\n' + '='.repeat(60));
      console.log('Summary:');
      console.log('='.repeat(60));

      const successful = results.filter((r) => r.status === 'success');
      const failed = results.filter((r) => r.status === 'failed');

      console.log(`Total: ${results.length}`);
      console.log(`Successful: ${successful.length}`);
      console.log(`Failed: ${failed.length}`);
      console.log(`Total Records Found: ${results.reduce((sum, r) => sum + r.records_found, 0)}`);

      if (failed.length > 0) {
        console.log('\nFailed Directories:');
        for (const f of failed) {
          console.log(`  - ${f.university} / ${f.department}: ${f.error}`);
        }
      }
    } else {
      // Show usage
      console.log('Usage:');
      console.log('  npx tsx scripts/run-scrape.ts -d <directory_id> [-m test|full]');
      console.log('  npx tsx scripts/run-scrape.ts -a [-p <parallel>] [-m test|full]');
      console.log('');
      console.log('Options:');
      console.log('  -d, --directory  Directory ID to scrape');
      console.log('  -a, --all        Scrape all active directories');
      console.log('  -m, --mode       Scrape mode: full | test (default: full)');
      console.log('  -p, --parallel   Parallel scrapes for --all (default: 3)');
      console.log('');
      console.log('Available Directories:');

      const directories = directoriesRepository.findAll(false);
      for (const d of directories) {
        const status = d.is_active ? 'active' : 'inactive';
        console.log(`  ${d.id}: ${d.university} / ${d.department} [${status}]`);
      }
    }

    // Show stats
    console.log('\nDatabase Stats:');
    const stats = getDatabaseStats();
    console.log(`  Directories: ${stats.directories}`);
    console.log(`  Researchers: ${stats.researchers}`);
    console.log(`  Publications: ${stats.publications}`);
  } finally {
    closeDatabase();
  }
}

// Main
runScrape(parseArgs()).catch((error) => {
  console.error('Scrape failed:', error);
  process.exit(1);
});
