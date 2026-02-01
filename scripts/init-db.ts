#!/usr/bin/env tsx
/**
 * Initialize Database Script
 *
 * Creates the database and runs schema.
 */

import { initializeDatabase, getDatabaseStats, checkDatabaseHealth } from '../src/db/connection.js';
import { directoriesRepository } from '../src/db/repositories/directories.js';

console.log('🗄️  Initializing Faculty Scraper Database...\n');

try {
  // Initialize schema
  initializeDatabase();
  console.log('✅ Schema created successfully\n');

  // Check health
  const health = checkDatabaseHealth();
  if (health.ok) {
    console.log(`✅ Database health check passed`);
    console.log(`   Tables: ${health.tables.join(', ')}\n`);
  } else {
    console.error(`❌ Database health check failed: ${health.error}`);
    process.exit(1);
  }

  // Seed initial directories (if empty)
  const stats = getDatabaseStats();
  if (stats.directories === 0) {
    console.log('📝 Seeding initial directories...\n');

    const directories = [
      {
        university: 'Harvard University',
        department: 'SEAS Computer Science',
        directory_url: 'https://seas.harvard.edu/computer-science/faculty-research',
        scrape_method: 'firecrawl' as const,
      },
      {
        university: 'MIT',
        department: 'CSAIL',
        directory_url: 'https://www.csail.mit.edu/people',
        scrape_method: 'playwright' as const,
        scrape_config: {
          load_more_selector: 'button.load-more',
          scroll_to_load: true,
        },
      },
      {
        university: 'Stanford University',
        department: 'Computer Science',
        directory_url: 'https://cs.stanford.edu/directory/faculty',
        scrape_method: 'firecrawl' as const,
      },
      {
        university: 'Carnegie Mellon University',
        department: 'School of Computer Science',
        directory_url: 'https://www.cs.cmu.edu/people/faculty',
        scrape_method: 'firecrawl' as const,
      },
      {
        university: 'UC Berkeley',
        department: 'EECS',
        directory_url: 'https://www2.eecs.berkeley.edu/Faculty/Lists/CS/list.html',
        scrape_method: 'firecrawl' as const,
      },
    ];

    for (const dir of directories) {
      try {
        const created = directoriesRepository.create(dir);
        console.log(`   ✅ Added: ${dir.university} - ${dir.department} (ID: ${created.id})`);
      } catch {
        console.log(`   ⚠️  Skipped (may already exist): ${dir.university} - ${dir.department}`);
      }
    }

    console.log('');
  }

  // Print stats
  const finalStats = getDatabaseStats();
  console.log('📊 Database Statistics:');
  console.log(`   Directories: ${finalStats.directories}`);
  console.log(`   Researchers: ${finalStats.researchers}`);
  console.log(`   Publications: ${finalStats.publications}`);
  console.log(`   Scrape Jobs: ${finalStats.scrape_jobs}`);
  console.log(`   Pending Enrichment: ${finalStats.pending_enrichment}`);
  console.log('');

  console.log('✅ Database initialization complete!');
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
}
