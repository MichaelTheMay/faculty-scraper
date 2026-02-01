/**
 * Firecrawl Scraper - Uses Firecrawl MCP for web scraping
 *
 * Best for static content that doesn't require JavaScript rendering.
 */

import { BaseScraper, type ScraperConfig, type ScrapeResult } from './base-scraper.js';

export interface FirecrawlConfig extends ScraperConfig {
  formats?: ('markdown' | 'html' | 'links' | 'screenshot')[];
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
}

/**
 * Firecrawl-based scraper
 *
 * Note: This scraper requires the Firecrawl MCP to be connected.
 * In production, it would call the mcp__firecrawl__firecrawl_scrape tool.
 */
export class FirecrawlScraper extends BaseScraper {
  private firecrawlConfig: FirecrawlConfig;

  constructor(config: FirecrawlConfig = {}) {
    super(config);
    this.firecrawlConfig = {
      formats: ['markdown', 'html', 'links'],
      onlyMainContent: true,
      ...config,
    };
  }

  getName(): string {
    return 'firecrawl';
  }

  canHandle(_url: string): boolean {
    // Firecrawl can handle most URLs
    // Returns false only for known dynamic-only sites
    return true;
  }

  async scrape(url: string): Promise<ScrapeResult> {
    const startTime = Date.now();

    console.log(`[FirecrawlScraper] Would scrape ${url} via Firecrawl MCP`);
    console.log('[FirecrawlScraper] Config:', JSON.stringify(this.firecrawlConfig, null, 2));

    // In production, this would call:
    // mcp__firecrawl__firecrawl_scrape({
    //   url,
    //   formats: this.firecrawlConfig.formats,
    //   onlyMainContent: this.firecrawlConfig.onlyMainContent,
    //   includeTags: this.firecrawlConfig.includeTags,
    //   excludeTags: this.firecrawlConfig.excludeTags,
    // })

    // Placeholder response
    const html = '';
    const markdown = '';
    const links: string[] = [];

    const fetchTime = Date.now() - startTime;

    return {
      html,
      markdown,
      links,
      metadata: {
        fetchTime,
        contentLength: html.length,
      },
    };
  }

  /**
   * Search and scrape using Firecrawl
   */
  async searchAndScrape(query: string, limit = 5): Promise<ScrapeResult[]> {
    console.log(`[FirecrawlScraper] Would search for: ${query}`);
    console.log(`[FirecrawlScraper] Limit: ${limit}`);

    // In production, this would call:
    // mcp__firecrawl__firecrawl_search({
    //   query,
    //   limit,
    //   scrapeOptions: {
    //     formats: ['markdown'],
    //     onlyMainContent: true,
    //   },
    // })

    return [];
  }
}

export default FirecrawlScraper;
