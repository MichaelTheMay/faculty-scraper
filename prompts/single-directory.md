# Single Directory Scrape

Scrape faculty from a specific university directory.

## Quick Start

```javascript
// 1. Find directory ID
scraper_list_directories({ active_only: true })

// 2. Scrape in test mode first
scraper_scrape_directory({ directory_id: 1, mode: 'test' })

// 3. Check job status
scraper_get_job_status({ job_id: 'xxx' })

// 4. If good, run full scrape
scraper_scrape_directory({ directory_id: 1, mode: 'full' })

// 5. Verify results
scraper_search_researchers({ university: 'Harvard' })
```

## Test Mode vs Full Mode

### Test Mode (`mode: 'test'`)
- Limits extraction to first 5 researchers
- Validates selectors work
- Shows sample parsed data
- Does NOT persist to database

### Full Mode (`mode: 'full'`)
- Extracts all researchers
- Deduplicates against existing
- Persists to database
- Queues for enrichment

## Pipeline Execution

When you call `scraper_scrape_directory`, these steps run:

1. **Load Config** - Get directory settings from database
2. **Fetch Content** - Get page HTML via Firecrawl or Playwright
3. **Handle Dynamic** - Click load more, scroll if needed
4. **Extract Cards** - Find researcher elements
5. **Parse/Normalize** - Extract name, email, title, etc.
6. **Deduplicate** - Check for existing records
7. **Persist** - Save new/updated researchers
8. **Queue Enrichment** - Add to enrichment queue

## Debugging Failed Scrapes

If a scrape fails:

```javascript
// 1. Check job status for error
scraper_get_job_status({ job_id: 'xxx' })

// 2. Run individual step for debugging
scraper_debug_step({
  step: 'step4',
  input: {
    html: '<html>...</html>',
    selectors: {
      card: '.faculty-card',
      name: '.name',
      title: '.title',
      email: 'a[href^="mailto:"]'
    }
  }
})

// 3. Check debug output
// Location: debug/jobs/{job_id}/
```

## Common Issues

### No Researchers Found
- Check selectors match the page structure
- Site may require JavaScript (use `playwright` method)
- Content may be behind "Load More" button

### Duplicate Detection
- Matches by email (primary)
- Matches by name + university + department (secondary)
- Check `records_updated` count in job status

### Selector Problems
- Use browser dev tools to find correct selectors
- Test with `scraper_debug_step` on step4
- Update directory `scrape_config` in database

## Adding New Directory

Before scraping a new directory:

1. **Analyze the site** (see analyze-directory.md)
2. **Add to database**:
```javascript
scraper_add_directory({
  university: 'Cornell',
  department: 'Computer Science',
  url: 'https://www.cs.cornell.edu/people/faculty',
  method: 'playwright'
})
```

3. **Update selectors** in database if needed
4. **Test scrape** in test mode
5. **Full scrape** when validated
