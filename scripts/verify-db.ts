#!/usr/bin/env tsx
/**
 * Verify Database Script
 *
 * Checks database health and integrity.
 */

import { checkDatabaseHealth, getDatabaseStats, getDatabase } from '../src/db/connection.js';

console.log('🔍 Verifying Faculty Scraper Database...\n');

// Check basic health
const health = checkDatabaseHealth();

if (!health.ok) {
  console.error(`❌ Database health check failed: ${health.error}`);
  process.exit(1);
}

console.log('✅ Database connection OK');
console.log(`   Tables found: ${health.tables.length}\n`);

// Expected tables
const expectedTables = [
  'directories',
  'researchers',
  'publications',
  'researcher_publications',
  'scrape_jobs',
  'scrape_logs',
  'enrichment_queue',
  'audit_log',
  'step_outputs',
];

// Check for missing tables
const missingTables = expectedTables.filter(t => !health.tables.includes(t));
if (missingTables.length > 0) {
  console.error(`❌ Missing tables: ${missingTables.join(', ')}`);
  process.exit(1);
}

console.log('✅ All expected tables present');

// Check foreign key constraints
const db = getDatabase();
const fkCheck = db.pragma('foreign_key_check') as { table: string; rowid: number; parent: string; fkid: number }[];

if (fkCheck.length > 0) {
  console.error('❌ Foreign key constraint violations found:');
  for (const violation of fkCheck) {
    console.error(`   Table: ${violation.table}, Row: ${violation.rowid}, Parent: ${violation.parent}`);
  }
  process.exit(1);
}

console.log('✅ Foreign key constraints valid');

// Check integrity
const integrityCheck = db.pragma('integrity_check') as { integrity_check: string }[];
if (integrityCheck[0]?.integrity_check !== 'ok') {
  console.error('❌ Database integrity check failed:');
  for (const issue of integrityCheck) {
    console.error(`   ${issue.integrity_check}`);
  }
  process.exit(1);
}

console.log('✅ Database integrity check passed');

// Print statistics
console.log('\n📊 Database Statistics:');
const stats = getDatabaseStats();
console.log(`   Directories: ${stats.directories}`);
console.log(`   Researchers: ${stats.researchers}`);
console.log(`   Publications: ${stats.publications}`);
console.log(`   Scrape Jobs: ${stats.scrape_jobs}`);
console.log(`   Pending Enrichment: ${stats.pending_enrichment}`);

// Check for orphaned records
console.log('\n🔗 Checking for orphaned records...');

// Researchers without valid directory
const orphanedResearchers = db.prepare(`
  SELECT COUNT(*) as count FROM researchers
  WHERE source_directory_id IS NOT NULL
    AND source_directory_id NOT IN (SELECT id FROM directories)
`).get() as { count: number };

if (orphanedResearchers.count > 0) {
  console.warn(`   ⚠️  ${orphanedResearchers.count} researchers with invalid directory reference`);
} else {
  console.log('   ✅ No orphaned researcher records');
}

// Publications without linked researchers
const orphanedPublications = db.prepare(`
  SELECT COUNT(*) as count FROM publications
  WHERE id NOT IN (SELECT publication_id FROM researcher_publications)
`).get() as { count: number };

if (orphanedPublications.count > 0) {
  console.log(`   ℹ️  ${orphanedPublications.count} publications without researcher links (may be OK)`);
} else {
  console.log('   ✅ All publications linked to researchers');
}

console.log('\n✅ Database verification complete!');
