# Autonomous Directory Analysis (Phase 0)

Analyze a faculty directory site to ensure 100% researcher capture.

## Objective

Navigate to a directory URL using Playwright MCP and autonomously:
1. Detect all dynamic content loading mechanisms
2. Click load more / paginate until ALL researchers are visible
3. Extract CSS selectors for future scraping
4. Verify complete capture (no researchers missed)

## Execution with claude-in-chrome MCP

### Step 1: Navigate and Initial Analysis

```javascript
// Get tab context
tabs_context_mcp({ createIfEmpty: true })

// Create new tab
tabs_create_mcp()

// Navigate to directory
navigate({ url: '{DIRECTORY_URL}', tabId })

// Wait for load
computer({ action: 'wait', duration: 2, tabId })

// Take initial screenshot
computer({ action: 'screenshot', tabId })
```

### Step 2: Detect Dynamic Loading

```javascript
// Read page structure
read_page({ tabId, filter: 'interactive' })

// Find dynamic elements
find({ query: 'load more button or show all', tabId })
find({ query: 'page numbers or next button', tabId })
find({ query: 'showing X of Y', tabId })
```

### Step 3: Load All Content

```javascript
// If load_more found, click until gone
while (loadMoreExists && count < expected) {
  computer({ action: 'left_click', ref: buttonRef, tabId })
  computer({ action: 'wait', duration: 1, tabId })
  computer({ action: 'screenshot', tabId })
}

// Scroll to trigger lazy loading
computer({ action: 'scroll', scroll_direction: 'down', tabId })
computer({ action: 'wait', duration: 2, tabId })
```

### Step 4: Extract and Verify

```javascript
// Final read
read_page({ tabId })

// Count researcher cards
// Compare to "showing X of Y" indicator
// Extract HTML for parsing
get_page_text({ tabId })
```

### Step 5: Discover Selectors

Analyze DOM to identify:
- Researcher card container (class/id pattern)
- Name element selector
- Title/position selector
- Email link selector
- Website link selector
- Photo URL pattern

### Step 6: Save Configuration

After analysis, add directory using MCP tool:

```javascript
scraper_add_directory({
  university: 'University Name',
  department: 'Department Name',
  url: 'https://...',
  method: 'playwright'  // or 'firecrawl' for static sites
})
```

Then update scrape_config in database with discovered selectors.

## Success Criteria

- No "Load More" button remaining
- Final count matches expected (if indicator present)
- All visible researchers extracted
- Selectors validated on at least 3 sample cards

## Common Patterns to Detect

### Load More Buttons
- `button.load-more`
- `a.see-more`
- `button:contains("Show All")`
- `[data-action="load-more"]`

### Pagination
- `.pagination a`
- `nav.pages`
- `[aria-label="Next page"]`

### Faculty Cards
- `.faculty-card`
- `.person-card`
- `.profile-card`
- `article.faculty`
- `.team-member`

### Name Elements
- `.name`
- `.faculty-name`
- `h2`, `h3` inside card
- `.title-name`

### Email
- `a[href^="mailto:"]`
- `.email`
- `.contact-email`
