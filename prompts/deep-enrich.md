# Deep Researcher Enrichment (Phase 2)

Enrich researchers with detailed publication and citation data using parallel agents.

## Prerequisites

- Database has researchers with `enrichment_status = 'pending'`
- Firecrawl MCP connected
- Task tool available for parallel agents

## Execution Steps

### 1. Find Pending Researchers

```javascript
scraper_search_researchers({
  enrichment_status: 'pending',
  limit: 50
})
```

### 2. Launch Parallel Enrichment Agents

For each batch of 5-10 researchers, use Task tool:

```javascript
Task({
  subagent_type: 'web-research-specialist',
  prompt: `Research ${researcher_name} at ${university}. Find:
    - Publications from DBLP, Semantic Scholar
    - h-index and citation counts
    - Research areas and keywords
    - Lab name, notable projects
    - Recent news/awards`
})
```

### 3. Research Sources (Priority Order)

1. **DBLP** (https://dblp.org/search?q={name})
   - Publication list
   - Venue information
   - Co-authors

2. **Semantic Scholar** (https://api.semanticscholar.org/)
   - h-index
   - Citation counts
   - Research areas

3. **Personal Website** (if available)
   - Scrape using Firecrawl
   - Extract: publications list, research descriptions, CV links

4. **University Profile Page**
   - Additional research areas
   - Lab affiliations

### 4. Use Firecrawl for Websites

```javascript
mcp__firecrawl__firecrawl_scrape({
  url: researcher.website,
  formats: ['markdown', 'links']
})
```

### 5. Update Database

After enrichment, the pipeline automatically:
- Merges new data with existing record
- Handles conflicts (takes higher h-index, merges research areas)
- Adds publications to database
- Sets `enrichment_status = 'complete'`

## Data to Extract

### From DBLP
- Publication titles
- Venue names (conference/journal)
- Publication years
- Co-author names

### From Semantic Scholar
- h-index
- Total citations
- Fields of study
- Highly influential papers

### From Personal Website
- Bio/About text
- Research interests
- Lab name
- Current projects
- CV/resume link

## Enrichment Pipeline Steps

The enrichment pipeline (E1-E4) handles:

1. **E1: Fetch Batch** - Get pending researchers
2. **E2: Deep Research** - Query external sources
3. **E3: Merge Data** - Combine with existing record
4. **E4: Persist** - Save to database

## Example Session

```javascript
// Check pending researchers
scraper_search_researchers({ enrichment_status: 'pending', limit: 10 })

// For each researcher, launch research agent
// (This would be done in parallel)

// After enrichment completes
scraper_search_researchers({ enrichment_status: 'complete', min_h_index: 10 })
```

## Notes

- Skip Google Scholar to avoid CAPTCHA issues
- Rate limit external API calls
- Cache results to avoid duplicate requests
- Log all enrichment attempts for debugging
