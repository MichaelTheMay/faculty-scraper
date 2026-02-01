#!/usr/bin/env node
/**
 * Seed directories from config file
 *
 * Usage:
 *   npx tsx scripts/seed-directories.ts [--config <path>]
 *
 * Options:
 *   --config, -c  Path to directories.json (default: ./configs/directories.json)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeDatabase, closeDatabase } from '../src/db/connection.js';
import { directoriesRepository } from '../src/db/repositories/directories.js';

interface DirectoryConfig {
  university: string;
  department: string;
  url: string;
  scrape_method?: 'firecrawl' | 'playwright' | 'hybrid';
  load_more_selector?: string;
  scroll_to_load?: boolean;
  selectors?: Record<string, string>;
}

interface ConfigFile {
  directories: DirectoryConfig[];
}

function parseArgs(): { configPath: string } {
  const args = process.argv.slice(2);
  let configPath = './configs/directories.json';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--config':
      case '-c':
        configPath = next;
        i++;
        break;
    }
  }

  return { configPath };
}

function seedDirectories(configPath: string): void {
  console.log('Initializing database...');
  initializeDatabase();

  try {
    const fullPath = resolve(process.cwd(), configPath);
    console.log(`Reading config from: ${fullPath}`);

    const content = readFileSync(fullPath, 'utf-8');
    const config: ConfigFile = JSON.parse(content);

    console.log(`Found ${config.directories.length} directories to seed\n`);

    let created = 0;
    let skipped = 0;

    for (const dir of config.directories) {
      // Check if already exists
      const existing = directoriesRepository.findByUrl(dir.url);
      if (existing) {
        console.log(`  [SKIP] ${dir.university} / ${dir.department} (already exists)`);
        skipped++;
        continue;
      }

      // Build scrape_config
      const scrapeConfig: Record<string, unknown> = {};
      if (dir.selectors) {
        scrapeConfig.selectors = dir.selectors;
      }
      if (dir.load_more_selector) {
        scrapeConfig.load_more_selector = dir.load_more_selector;
      }
      if (dir.scroll_to_load) {
        scrapeConfig.scroll_config = { enabled: true };
      }

      // Create directory
      directoriesRepository.create({
        university: dir.university,
        department: dir.department,
        directory_url: dir.url,
        scrape_method: dir.scrape_method || 'firecrawl',
        scrape_config: Object.keys(scrapeConfig).length > 0 ? scrapeConfig : undefined,
      });

      console.log(`  [NEW] ${dir.university} / ${dir.department}`);
      created++;
    }

    console.log('\n' + '='.repeat(50));
    console.log('Summary:');
    console.log(`  Created: ${created}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Total: ${created + skipped}`);

    // List all directories
    console.log('\nCurrent Directories:');
    const all = directoriesRepository.findAll(false);
    for (const d of all) {
      const status = d.is_active ? 'active' : 'inactive';
      console.log(`  ${d.id}: ${d.university} / ${d.department} [${status}]`);
    }
  } finally {
    closeDatabase();
  }
}

// Main
try {
  const { configPath } = parseArgs();
  seedDirectories(configPath);
} catch (error) {
  console.error('Seeding failed:', error);
  process.exit(1);
}
