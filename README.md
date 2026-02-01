# Faculty Directory Scraper

A comprehensive faculty scraping system with MCP server integration for Claude Code.

## Features

- **MCP Server Integration**: Expose scraping functionality as MCP tools for Claude Code
- **Multiple Scraping Methods**: Firecrawl for static pages, Playwright for dynamic content
- **Modular Pipeline**: 8-step scraping pipeline with clear inputs/outputs
- **Enrichment Pipeline**: Deep research using DBLP, Semantic Scholar, and web sources
- **SQLite Database**: Persistent storage with deduplication and audit logging
- **Comprehensive Debugging**: Step-by-step recording and replay capabilities

## Installation

```bash
# Clone and navigate to project
cd C:\dev\faculty-scraper

# Install dependencies
npm install

# Initialize database
npm run init-db

# Build
npm run build
```

## Quick Start

### As MCP Server (Claude Code Integration)

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "faculty-scraper": {
      "command": "node",
      "args": ["C:/dev/faculty-scraper/dist/mcp-server.js"],
      "env": {
        "DATABASE_PATH": "C:/dev/faculty-scraper/database/research.db"
      }
    }
  }
}
```

Then use in Claude Code:
```
Use the faculty scraper to list all directories
Scrape the Harvard SEAS directory
Search for researchers working on machine learning
```

### As CLI

```bash
# Run a scrape
npm run scrape -- --directory=1

# Export to CSV
npm run export-csv -- --output=./researchers.csv

# Debug a pipeline step
npm run debug:step -- --step=4 --input=./test/fixtures/step4-input.json
```

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `scraper_list_directories` | List all configured directories |
| `scraper_add_directory` | Add new directory to scrape |
| `scraper_scrape_directory` | Scrape single directory |
| `scraper_scrape_all` | Scrape all active directories in parallel |
| `scraper_search_researchers` | Search researchers with filters |
| `scraper_get_job_status` | Check scraping job status |
| `scraper_debug_step` | Debug individual pipeline step |
| `scraper_get_stats` | Get database statistics |

## Pipeline Architecture

### Scraping Pipeline (Steps 1-8)

```
Step 1: Load Config → Step 2: Fetch Content → Step 3: Handle Dynamic
    ↓
Step 4: Extract Cards → Step 5: Parse/Normalize → Step 6: Deduplicate
    ↓
Step 7: Persist → Step 8: Queue Enrichment
```

### Enrichment Pipeline (Steps E1-E4)

```
E1: Fetch Batch → E2: Deep Research → E3: Merge Data → E4: Persist
```

## Database Schema

### Core Tables

- **directories**: Faculty directory configurations
- **researchers**: Researcher profiles (name, title, email, etc.)
- **publications**: Research publications with citations
- **scrape_jobs**: Job tracking and statistics
- **enrichment_queue**: Pending enrichment tasks

### Key Fields

```sql
-- Researcher enrichment tracking
researchers.enrichment_status: 'pending' | 'in_progress' | 'complete' | 'failed'

-- Directory scrape method
directories.scrape_method: 'firecrawl' | 'playwright' | 'hybrid'
```

## Debugging

### Debug Output

All pipeline runs create debug output in `debug/jobs/{job_id}/`:

```
debug/jobs/abc123/
├── step1_input.json
├── step1_output.json
├── step4_cards.json
├── step5_normalized.json
├── step6_dedup_decisions.json
└── summary.json
```

### Debug Commands

```bash
# Run pipeline with full debugging
npm run debug:pipeline -- --directory=1 --verbose

# Replay a failed step
npm run debug:replay -- --job=abc123 --step=6

# Verify database integrity
npm run verify:db
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_PATH` | SQLite database location | `./database/research.db` |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | `info` |

### Directory Configuration

Each directory can have custom scrape settings:

```json
{
  "scrape_method": "playwright",
  "scrape_config": {
    "load_more_selector": "button.load-more",
    "scroll_to_load": true,
    "selectors": {
      "card": ".faculty-card",
      "name": ".faculty-name",
      "title": ".faculty-title",
      "email": "a[href^='mailto:']"
    }
  }
}
```

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/steps/04-extract-cards.test.ts

# Run with coverage
npm run test:coverage

# Type check
npm run typecheck
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run `npm test` and `npm run typecheck`
5. Submit a pull request

## License

MIT
