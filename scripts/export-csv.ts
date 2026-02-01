#!/usr/bin/env node
/**
 * Export researchers to CSV
 *
 * Usage:
 *   npx tsx scripts/export-csv.ts [options]
 *
 * Options:
 *   --output, -o      Output file path (default: researchers.csv)
 *   --university, -u  Filter by university
 *   --department, -d  Filter by department
 *   --status, -s      Filter by enrichment status
 *   --min-h-index     Filter by minimum h-index
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { initializeDatabase, closeDatabase } from '../src/db/connection.js';
import { researchersRepository } from '../src/db/repositories/researchers.js';
import type { SearchFilters } from '../src/pipeline/types.js';

interface ExportOptions {
  output: string;
  university?: string;
  department?: string;
  status?: 'pending' | 'in_progress' | 'complete' | 'failed';
  minHIndex?: number;
}

function parseArgs(): ExportOptions {
  const args = process.argv.slice(2);
  const options: ExportOptions = {
    output: 'researchers.csv',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--output':
      case '-o':
        options.output = next;
        i++;
        break;
      case '--university':
      case '-u':
        options.university = next;
        i++;
        break;
      case '--department':
      case '-d':
        options.department = next;
        i++;
        break;
      case '--status':
      case '-s':
        options.status = next as ExportOptions['status'];
        i++;
        break;
      case '--min-h-index':
        options.minHIndex = parseInt(next, 10);
        i++;
        break;
    }
  }

  return options;
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = Array.isArray(value) ? value.join('; ') : String(value);

  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function exportToCSV(options: ExportOptions): void {
  console.log('Initializing database...');
  initializeDatabase();

  const filters: SearchFilters = {
    university: options.university,
    department: options.department,
    enrichment_status: options.status,
    min_h_index: options.minHIndex,
  };

  console.log('Fetching researchers...');
  const researchers = researchersRepository.search(undefined, filters, 10000, 0);

  console.log(`Found ${researchers.length} researchers`);

  if (researchers.length === 0) {
    console.log('No researchers to export');
    closeDatabase();
    return;
  }

  // CSV headers
  const headers = [
    'ID',
    'First Name',
    'Last Name',
    'Full Name',
    'University',
    'Department',
    'Title',
    'Email',
    'Phone',
    'Office',
    'Website',
    'Google Scholar URL',
    'DBLP URL',
    'Semantic Scholar ID',
    'ORCID',
    'H-Index',
    'Citations',
    'Research Areas',
    'Enrichment Status',
    'Last Verified',
    'Created At',
    'Updated At',
  ];

  // Build CSV rows
  const rows = researchers.map((r) => [
    r.id,
    r.first_name,
    r.last_name,
    r.full_name,
    r.university,
    r.department,
    r.title,
    r.email,
    r.phone,
    r.office,
    r.website,
    r.google_scholar_url,
    r.dblp_url,
    r.semantic_scholar_id,
    r.orcid,
    r.h_index,
    r.citations_total,
    r.research_areas,
    r.enrichment_status,
    r.last_verified,
    r.created_at,
    r.updated_at,
  ]);

  // Build CSV content
  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ].join('\n');

  // Write to file
  const outputPath = resolve(process.cwd(), options.output);
  writeFileSync(outputPath, csv, 'utf-8');

  console.log(`Exported ${researchers.length} researchers to ${outputPath}`);

  closeDatabase();
}

// Main
try {
  const options = parseArgs();
  exportToCSV(options);
} catch (error) {
  console.error('Export failed:', error);
  process.exit(1);
}
