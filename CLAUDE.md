# Faculty Directory Scraper - Claude Code Project

## Overview

A comprehensive faculty scraping system that:
- **Exposes as MCP Server** for Claude Code integration
- Uses **Playwright** for dynamic content (load more buttons, infinite scroll)
- Uses **Firecrawl** for structured data extraction
- Stores data in **SQLite** with deduplication and timestamping
- **Modular pipeline** with clear inputs/outputs per step
- **TypeScript/Node.js** codebase with comprehensive tests

## Project Structure

```
C:\dev\faculty-scraper\
├── src/
│   ├── mcp-server.ts              # MCP Server entry point
│   ├── mcp/handlers/              # MCP tool handlers
│   ├── pipeline/
│   │   ├── types.ts               # All step I/O types
│   │   ├── runner.ts              # Pipeline orchestrator
│   │   └── steps/                 # Individual pipeline steps
│   ├── db/
│   │   ├── connection.ts          # SQLite connection
│   │   └── repositories/          # Data access layer
│   ├── scrapers/                  # Playwright/Firecrawl wrappers
│   ├── parsers/                   # Name, publication parsers
│   └── debug/                     # Logging, step recording
├── database/
│   ├── schema.sql                 # Complete SQLite schema
│   └── research.db                # Database file
├── scripts/                       # CLI scripts
├── test/                          # Test suite
├── debug/jobs/                    # Debug output per job
└── prompts/                       # Claude Code prompts
```

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `scraper_list_directories` | List all configured directories |
| `scraper_add_directory` | Add new directory to scrape |
| `scraper_scrape_directory` | Scrape single directory |
| `scraper_scrape_all` | Scrape all active directories |
| `scraper_search_researchers` | Search researcher database |
| `scraper_get_job_status` | Get scrape job status |
| `scraper_debug_step` | Run single pipeline step |
| `scraper_get_stats` | Get database statistics |

## Pipeline Steps

### Scraping Pipeline
1. **Step 1**: Load directory config from database
2. **Step 2**: Fetch page content (Firecrawl or Playwright)
3. **Step 3**: Handle dynamic content (load more, scroll)
4. **Step 4**: Extract researcher cards from HTML
5. **Step 5**: Parse and normalize data
6. **Step 6**: Deduplicate against existing records
7. **Step 7**: Persist to database
8. **Step 8**: Queue for enrichment

### Enrichment Pipeline
1. **Step E1**: Fetch batch of pending researchers
2. **Step E2**: Deep research (DBLP, Semantic Scholar, websites)
3. **Step E3**: Merge enrichment data
4. **Step E4**: Persist enriched data

## Common Commands

```bash
# Initialize database
npm run init-db

# Verify database health
npm run verify:db

# Run tests
npm test

# Type check
npm run typecheck

# Build
npm run build

# Start MCP server
npm start

# Debug a single step
npm run debug:step -- --step=4 --input=./test/fixtures/step4-input.json

# Debug full pipeline
npm run debug:pipeline -- --directory=1 --verbose
```

## Database Schema

### Key Tables
- **directories**: Faculty directory configurations
- **researchers**: Researcher profiles with enrichment status
- **publications**: Research publications
- **scrape_jobs**: Job tracking and statistics
- **enrichment_queue**: Pending enrichment tasks

### Key Fields
- `researchers.enrichment_status`: 'pending' | 'in_progress' | 'complete' | 'failed'
- `directories.scrape_method`: 'firecrawl' | 'playwright' | 'hybrid'

## Debugging

### Debug Output Location
All debug output saved to `debug/jobs/{job_id}/`:
- `step{N}_input.json` - Step input
- `step{N}_output.json` - Step output
- `step{N}_error.json` - Step errors
- `summary.json` - Complete job recording

### Latest Job
`debug/latest.txt` contains the most recent job ID.

## MCP Server Configuration

Add to Claude Code settings:
```json
{
  "mcpServers": {
    "faculty-scraper": {
      "command": "node",
      "args": ["C:/dev/faculty-scraper/dist/mcp-server.js"],
      "env": {
        "DATABASE_PATH": "C:/dev/faculty-scraper/database/research.db",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Testing Notes

- Unit tests in `test/steps/` for each pipeline step
- Integration tests in `test/integration/`
- Use test fixtures in `test/fixtures/`
- Run with: `npm test`

## Key Patterns

### Researcher Deduplication
1. Match by email (strongest)
2. Match by name + university + department
3. Calculate confidence score
4. Decide: insert, update, or skip

### Error Handling
- Parse errors collected but don't stop pipeline
- Job status updated on failure
- All errors logged to database and files

### Data Normalization
- Names parsed into first/last
- Emails lowercased
- Phone numbers formatted
- Titles standardized (Professor, Associate Professor, etc.)
