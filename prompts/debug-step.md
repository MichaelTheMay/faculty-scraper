# Debug Pipeline Step

Run a single pipeline step with provided input for debugging.

## Available Steps

### Scraping Pipeline
- `step1` - Load directory config
- `step2` - Fetch page content
- `step3` - Handle dynamic content
- `step4` - Extract researcher cards
- `step5` - Parse and normalize
- `step6` - Deduplicate
- `step7` - Persist to database
- `step8` - Queue for enrichment

### Enrichment Pipeline
- `stepE1` - Fetch enrichment batch
- `stepE2` - Deep research
- `stepE3` - Merge enrichment data
- `stepE4` - Persist enriched data

## Usage

```javascript
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
```

## Step Input/Output Reference

### Step 1: Load Config
```typescript
// Input
{ directory_id: number }

// Output
{
  directory: Directory,
  url: string,
  scrape_method: string,
  selectors: { card, name, title, email, ... },
  load_more_config?: { selector, max_clicks, wait_between_clicks_ms }
}
```

### Step 4: Extract Cards
```typescript
// Input
{
  html: string,
  selectors: {
    card: string,
    name: string,
    title?: string,
    email?: string,
    phone?: string,
    office?: string,
    website?: string,
    photo?: string,
    research_areas?: string
  }
}

// Output
{
  raw_cards: RawCard[],
  extraction_stats: {
    total_cards: number,
    with_name: number,
    with_email: number,
    ...
  }
}
```

### Step 5: Parse and Normalize
```typescript
// Input
{ raw_cards: RawCard[] }

// Output
{
  researchers: ParsedResearcher[],
  parse_errors: { card_index, field, error }[]
}
```

### Step 6: Deduplicate
```typescript
// Input
{
  researchers: ParsedResearcher[],
  directory_id: number
}

// Output
{
  to_insert: ParsedResearcher[],
  to_update: { id, data }[],
  duplicates: { researcher, existing_id, confidence }[],
  stats: { new, updated, skipped }
}
```

## Debug Output Location

All debug data saved to `debug/jobs/{job_id}/`:
- `step{N}_input.json` - Input received
- `step{N}_output.json` - Output produced
- `step{N}_error.json` - Any errors

Latest job ID in `debug/latest.txt`

## Example: Debugging Selector Issues

```javascript
// 1. Fetch HTML from a page
const html = await mcp__firecrawl__firecrawl_scrape({
  url: 'https://example.edu/faculty',
  formats: ['html']
})

// 2. Test extraction with different selectors
scraper_debug_step({
  step: 'step4',
  input: {
    html: html.html,
    selectors: {
      card: '.profile-card',      // Try different selectors
      name: 'h3.name',
      title: '.position',
      email: '.email a'
    }
  }
})

// 3. Check output for matches
// Adjust selectors until extraction_stats.total_cards matches expected
```

## Example: Debugging Parse Errors

```javascript
// 1. Run step 4 to get raw cards
const step4Output = scraper_debug_step({
  step: 'step4',
  input: { html, selectors }
})

// 2. Run step 5 to see parse errors
scraper_debug_step({
  step: 'step5',
  input: { raw_cards: step4Output.raw_cards }
})

// 3. Check parse_errors in output
// Common issues: malformed emails, unusual name formats
```
