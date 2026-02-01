#!/usr/bin/env node
/**
 * Faculty Scraper MCP Server
 *
 * Exposes faculty directory scraping functionality as MCP tools
 * for Claude Code integration.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { initializeDatabase, closeDatabase, getDatabaseStats } from './db/connection.js';
import { directoriesRepository } from './db/repositories/directories.js';
import { researchersRepository } from './db/repositories/researchers.js';
import { jobsRepository } from './db/repositories/jobs.js';
import { runPipeline, runStep } from './pipeline/runner.js';
import { globalLogger } from './debug/logger.js';
import type { Directory, Researcher, SearchFilters } from './pipeline/types.js';

// Tool input schemas
const ListDirectoriesSchema = z.object({
  active_only: z.boolean().optional().default(true),
});

const AddDirectorySchema = z.object({
  university: z.string().min(1),
  department: z.string().min(1),
  url: z.string().url(),
  method: z.enum(['firecrawl', 'playwright', 'hybrid']).optional().default('firecrawl'),
});

const ScrapeDirectorySchema = z.object({
  directory_id: z.number().int().positive(),
  mode: z.enum(['full', 'test']).optional().default('full'),
});

const ScrapeAllSchema = z.object({
  parallel: z.number().int().positive().max(10).optional().default(3),
});

// EnrichResearchersSchema - will be used when enrichment handler is implemented
// const EnrichResearchersSchema = z.object({
//   batch_size: z.number().int().positive().max(50).optional().default(10),
//   parallel: z.number().int().positive().max(5).optional().default(3),
// });

const SearchResearchersSchema = z.object({
  query: z.string().optional(),
  university: z.string().optional(),
  department: z.string().optional(),
  title: z.string().optional(),
  research_area: z.string().optional(),
  enrichment_status: z.enum(['pending', 'in_progress', 'complete', 'failed']).optional(),
  min_h_index: z.number().int().optional(),
  min_citations: z.number().int().optional(),
  limit: z.number().int().positive().max(1000).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
});

// ExportCsvSchema - will be used when export handler is implemented
// const ExportCsvSchema = z.object({
//   output_path: z.string(),
//   university: z.string().optional(),
//   department: z.string().optional(),
//   enrichment_status: z.enum(['pending', 'in_progress', 'complete', 'failed']).optional(),
// });

const GetJobStatusSchema = z.object({
  job_id: z.string(),
});

const DebugStepSchema = z.object({
  step: z.string(),
  input: z.record(z.unknown()),
});

const GetStatsSchema = z.object({});

// Create server
const server = new Server(
  {
    name: 'faculty-scraper',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'scraper_list_directories',
        description: 'List all configured faculty directories. Returns ID, university, department, URL, and scrape settings.',
        inputSchema: {
          type: 'object',
          properties: {
            active_only: {
              type: 'boolean',
              description: 'Only return active directories (default: true)',
            },
          },
        },
      },
      {
        name: 'scraper_add_directory',
        description: 'Add a new faculty directory to scrape. Requires university name, department, and directory URL.',
        inputSchema: {
          type: 'object',
          properties: {
            university: { type: 'string', description: 'University name' },
            department: { type: 'string', description: 'Department name' },
            url: { type: 'string', description: 'Directory URL to scrape' },
            method: {
              type: 'string',
              enum: ['firecrawl', 'playwright', 'hybrid'],
              description: 'Scraping method (default: firecrawl)',
            },
          },
          required: ['university', 'department', 'url'],
        },
      },
      {
        name: 'scraper_scrape_directory',
        description: 'Scrape a single faculty directory. Returns job status and record counts.',
        inputSchema: {
          type: 'object',
          properties: {
            directory_id: { type: 'number', description: 'Directory ID to scrape' },
            mode: {
              type: 'string',
              enum: ['full', 'test'],
              description: 'Scrape mode (default: full)',
            },
          },
          required: ['directory_id'],
        },
      },
      {
        name: 'scraper_scrape_all',
        description: 'Scrape all active directories. Returns summary of all jobs.',
        inputSchema: {
          type: 'object',
          properties: {
            parallel: {
              type: 'number',
              description: 'Number of parallel scrapes (default: 3, max: 10)',
            },
          },
        },
      },
      {
        name: 'scraper_search_researchers',
        description: 'Search researchers in the database with filters.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query (name, email, research areas)' },
            university: { type: 'string', description: 'Filter by university' },
            department: { type: 'string', description: 'Filter by department' },
            title: { type: 'string', description: 'Filter by title' },
            research_area: { type: 'string', description: 'Filter by research area' },
            enrichment_status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'complete', 'failed'],
            },
            min_h_index: { type: 'number', description: 'Minimum h-index' },
            min_citations: { type: 'number', description: 'Minimum citation count' },
            limit: { type: 'number', description: 'Max results (default: 100)' },
            offset: { type: 'number', description: 'Results offset (default: 0)' },
          },
        },
      },
      {
        name: 'scraper_get_job_status',
        description: 'Get the status of a scraping job.',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: { type: 'string', description: 'Job ID to check' },
          },
          required: ['job_id'],
        },
      },
      {
        name: 'scraper_debug_step',
        description: 'Run a single pipeline step with provided input for debugging.',
        inputSchema: {
          type: 'object',
          properties: {
            step: { type: 'string', description: 'Step name (step4, step5, step6, step7, step8)' },
            input: { type: 'object', description: 'Step input data' },
          },
          required: ['step', 'input'],
        },
      },
      {
        name: 'scraper_get_stats',
        description: 'Get database statistics (counts of directories, researchers, publications, etc.)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'scraper_list_directories': {
        const input = ListDirectoriesSchema.parse(args);
        const directories = directoriesRepository.findAll(input.active_only);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(directories.map(formatDirectory), null, 2),
            },
          ],
        };
      }

      case 'scraper_add_directory': {
        const input = AddDirectorySchema.parse(args);
        const directory = directoriesRepository.create({
          university: input.university,
          department: input.department,
          directory_url: input.url,
          scrape_method: input.method,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ id: directory.id, success: true }, null, 2),
            },
          ],
        };
      }

      case 'scraper_scrape_directory': {
        const input = ScrapeDirectorySchema.parse(args);
        const result = await runPipeline(input.directory_id, { mode: input.mode });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'scraper_scrape_all': {
        const input = ScrapeAllSchema.parse(args);
        const directories = directoriesRepository.findAll(true);
        const results = [];

        // Run in batches
        for (let i = 0; i < directories.length; i += input.parallel) {
          const batch = directories.slice(i, i + input.parallel);
          const batchResults = await Promise.allSettled(
            batch.map(d => runPipeline(d.id, { mode: 'full' }))
          );

          for (let j = 0; j < batchResults.length; j++) {
            const result = batchResults[j];
            results.push({
              directory_id: batch[j].id,
              job_id: result.status === 'fulfilled' ? result.value.job_id : undefined,
              status: result.status === 'fulfilled' ? result.value.status : 'failed',
              error: result.status === 'rejected' ? String(result.reason) : undefined,
            });
          }
        }

        const summary = {
          total_directories: directories.length,
          successful: results.filter(r => r.status === 'success').length,
          failed: results.filter(r => r.status === 'failed').length,
          jobs: results,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      }

      case 'scraper_search_researchers': {
        const input = SearchResearchersSchema.parse(args);
        const filters: SearchFilters = {
          university: input.university,
          department: input.department,
          title: input.title,
          research_area: input.research_area,
          enrichment_status: input.enrichment_status,
          min_h_index: input.min_h_index,
          min_citations: input.min_citations,
        };
        const researchers = researchersRepository.search(input.query, filters, input.limit, input.offset);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(researchers.map(formatResearcher), null, 2),
            },
          ],
        };
      }

      case 'scraper_get_job_status': {
        const input = GetJobStatusSchema.parse(args);
        const status = jobsRepository.getStatus(input.job_id);
        if (!status) {
          return {
            content: [{ type: 'text', text: 'Job not found' }],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      }

      case 'scraper_debug_step': {
        const input = DebugStepSchema.parse(args);
        const output = await runStep(input.step, input.input);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(output, null, 2),
            },
          ],
        };
      }

      case 'scraper_get_stats': {
        GetStatsSchema.parse(args);
        const stats = getDatabaseStats();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    globalLogger.error(`Tool ${name} failed`, { error: String(error) });
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Format directory for output
function formatDirectory(d: Directory) {
  return {
    id: d.id,
    university: d.university,
    department: d.department,
    url: d.directory_url,
    method: d.scrape_method,
    is_active: d.is_active,
    last_scraped: d.last_scraped,
    records_last_scrape: d.records_last_scrape,
  };
}

// Format researcher for output
function formatResearcher(r: Researcher) {
  return {
    id: r.id,
    name: r.full_name,
    university: r.university,
    department: r.department,
    title: r.title,
    email: r.email,
    website: r.website,
    h_index: r.h_index,
    citations: r.citations_total,
    research_areas: r.research_areas,
    enrichment_status: r.enrichment_status,
  };
}

// Main entry point
async function main() {
  // Initialize database
  try {
    initializeDatabase();
    globalLogger.info('Database initialized');
  } catch (error) {
    globalLogger.error('Failed to initialize database', { error: String(error) });
    process.exit(1);
  }

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  globalLogger.info('Faculty Scraper MCP Server started');

  // Graceful shutdown
  process.on('SIGINT', () => {
    globalLogger.info('Shutting down...');
    closeDatabase();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    globalLogger.info('Shutting down...');
    closeDatabase();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
