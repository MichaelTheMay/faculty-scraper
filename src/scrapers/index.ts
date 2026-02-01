/**
 * Scrapers Index
 */

export { BaseScraper, type ScraperConfig, type ScrapeResult } from './base-scraper.js';
export { FirecrawlScraper, type FirecrawlConfig } from './firecrawl-scraper.js';
export { PlaywrightScraper, type PlaywrightConfig } from './playwright-scraper.js';
export { HybridScraper, type HybridConfig } from './hybrid-scraper.js';

import { FirecrawlScraper } from './firecrawl-scraper.js';
import { PlaywrightScraper } from './playwright-scraper.js';
import { HybridScraper } from './hybrid-scraper.js';
import type { BaseScraper, ScraperConfig } from './base-scraper.js';

/**
 * Create a scraper based on the method
 */
export function createScraper(
  method: 'firecrawl' | 'playwright' | 'hybrid',
  config?: ScraperConfig
): BaseScraper {
  switch (method) {
    case 'firecrawl':
      return new FirecrawlScraper(config);
    case 'playwright':
      return new PlaywrightScraper(config);
    case 'hybrid':
      return new HybridScraper(config);
    default:
      throw new Error(`Unknown scraper method: ${method}`);
  }
}
