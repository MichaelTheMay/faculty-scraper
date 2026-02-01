# Full Faculty Directory Scrape

You are running a scheduled scraping job. Follow these steps exactly:

## Prerequisites
- Firecrawl MCP connected
- Playwright (claude-in-chrome) MCP connected
- Database at: C:\dev\faculty-scraper\database\research.db

## Execution Steps

1. **Read active directories from database**
   - Use MCP tool: `scraper_list_directories({ active_only: true })`

2. **For each directory, scrape based on method:**
   - Use MCP tool: `scraper_scrape_directory({ directory_id: N, mode: 'full' })`
   - This will run the full pipeline automatically

3. **Monitor progress**
   - Use: `scraper_get_job_status({ job_id: 'xxx' })`
   - Check status, records_found, records_created

4. **Or scrape all at once:**
   - Use: `scraper_scrape_all({ parallel: 3 })`
   - Returns summary of all jobs

## Pipeline Steps (Automatic)

When `scraper_scrape_directory` is called:
1. Step 1: Load directory config from database
2. Step 2: Fetch page content (Firecrawl or Playwright)
3. Step 3: Handle dynamic content (load more, scroll)
4. Step 4: Extract researcher cards from HTML
5. Step 5: Parse and normalize data
6. Step 6: Deduplicate against existing records
7. Step 7: Persist to database
8. Step 8: Queue for enrichment

## Error Handling

- If a directory fails, it's logged and the job continues
- Check `scraper_get_job_status` for error details
- Failed jobs have `status: 'failed'` and `error_message`

## Verification

After scraping, verify results:
```
scraper_get_stats({})
```

This shows:
- Total researchers in database
- By enrichment status
- Recent job summaries

## Example Session

```
# List directories
scraper_list_directories({ active_only: true })

# Scrape one directory (test mode first)
scraper_scrape_directory({ directory_id: 1, mode: 'test' })

# If looks good, full scrape
scraper_scrape_directory({ directory_id: 1, mode: 'full' })

# Check results
scraper_get_stats({})
scraper_search_researchers({ university: 'Harvard' })
```
