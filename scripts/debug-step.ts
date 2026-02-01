#!/usr/bin/env node
/**
 * Debug a single pipeline step
 *
 * Usage:
 *   npx tsx scripts/debug-step.ts --step <step_name> --input <input_file>
 *   npx tsx scripts/debug-step.ts --step step4 --input ./test/fixtures/step4-input.json
 *
 * Options:
 *   --step, -s    Step name (step1, step4, step5, step6, step7, stepE1, etc.)
 *   --input, -i   Path to JSON input file
 *   --output, -o  Path to output file (optional, defaults to stdout)
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { initializeDatabase, closeDatabase } from '../src/db/connection.js';
import { runStep } from '../src/pipeline/runner.js';

interface DebugOptions {
  step?: string;
  inputFile?: string;
  outputFile?: string;
}

function parseArgs(): DebugOptions {
  const args = process.argv.slice(2);
  const options: DebugOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--step':
      case '-s':
        options.step = next;
        i++;
        break;
      case '--input':
      case '-i':
        options.inputFile = next;
        i++;
        break;
      case '--output':
      case '-o':
        options.outputFile = next;
        i++;
        break;
    }
  }

  return options;
}

async function debugStep(options: DebugOptions): Promise<void> {
  if (!options.step || !options.inputFile) {
    console.log('Debug Pipeline Step');
    console.log('='.repeat(50));
    console.log('');
    console.log('Usage:');
    console.log('  npx tsx scripts/debug-step.ts -s <step> -i <input.json> [-o <output.json>]');
    console.log('');
    console.log('Available Steps:');
    console.log('  Scraping: step1, step2, step3, step4, step5, step6, step7, step8');
    console.log('  Enrichment: stepE1, stepE2, stepE3, stepE4');
    console.log('');
    console.log('Example:');
    console.log('  npx tsx scripts/debug-step.ts -s step4 -i ./test/fixtures/step4-input.json');
    console.log('');
    return;
  }

  console.log('Initializing database...');
  initializeDatabase();

  try {
    // Read input
    const inputPath = resolve(process.cwd(), options.inputFile);
    console.log(`Reading input from: ${inputPath}`);

    const inputContent = readFileSync(inputPath, 'utf-8');
    const input = JSON.parse(inputContent);

    console.log(`\nRunning step: ${options.step}`);
    console.log('Input preview:', JSON.stringify(input, null, 2).substring(0, 500) + '...');

    // Run step
    const startTime = Date.now();
    const output = await runStep(options.step, input);
    const duration = Date.now() - startTime;

    console.log(`\nStep completed in ${duration}ms`);

    // Output results
    const outputJson = JSON.stringify(output, null, 2);

    if (options.outputFile) {
      const outputPath = resolve(process.cwd(), options.outputFile);
      writeFileSync(outputPath, outputJson, 'utf-8');
      console.log(`Output written to: ${outputPath}`);
    } else {
      console.log('\nOutput:');
      console.log(outputJson);
    }

    // Summary
    console.log('\nSummary:');
    if ('raw_cards' in output) {
      console.log(`  Cards extracted: ${output.raw_cards.length}`);
    }
    if ('researchers' in output) {
      console.log(`  Researchers parsed: ${output.researchers.length}`);
    }
    if ('parse_errors' in output) {
      console.log(`  Parse errors: ${output.parse_errors.length}`);
    }
    if ('to_insert' in output) {
      console.log(`  To insert: ${output.to_insert.length}`);
    }
    if ('to_update' in output) {
      console.log(`  To update: ${output.to_update.length}`);
    }
    if ('duplicates' in output) {
      console.log(`  Duplicates: ${output.duplicates.length}`);
    }
  } finally {
    closeDatabase();
  }
}

// Main
debugStep(parseArgs()).catch((error) => {
  console.error('Debug step failed:', error);
  process.exit(1);
});
