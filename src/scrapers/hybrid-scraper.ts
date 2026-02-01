/**
 * Hybrid Scraper - Intelligently combines Firecrawl and Playwright
 *
 * Strategy:
 * 1. Try Firecrawl first (faster, cheaper)
 * 2. Check if content is complete
 * 3. Fall back to Playwright if needed (e.g., dynamic content detected)
 */

import { BaseScraper, type ScraperConfig, type ScrapeResult } from './base-scraper.js';
import { FirecrawlScraper, type FirecrawlConfig } from './firecrawl-scraper.js';
import { PlaywrightScraper, type PlaywrightConfig } from './playwright-scraper.js';

export interface HybridConfig extends ScraperConfig {
  firecrawl?: FirecrawlConfig;
  playwright?: PlaywrightConfig;
  minExpectedItems?: number;
  dynamicIndicators?: string[];
}

/**
 * Hybrid scraper that combines Firecrawl and Playwright
 */
export class HybridScraper extends BaseScraper {
  private hybridConfig: HybridConfig;
  private firecrawl: FirecrawlScraper;
  private playwright: PlaywrightScraper;

  constructor(config: HybridConfig = {}) {
    super(config);
    this.hybridConfig = {
      minExpectedItems: 0,
      dynamicIndicators: [
        'load more',
        'show more',
        'view all',
        'see all',
        'load-more',
        'infinite-scroll',
        'lazy-load',
      ],
      ...config,
    };

    this.firecrawl = new FirecrawlScraper(config.firecrawl);
    this.playwright = new PlaywrightScraper(config.playwright);
  }

  getName(): string {
    return 'hybrid';
  }

  canHandle(_url: string): boolean {
    return true;
  }

  /**
   * Check if content indicates dynamic loading is needed
   */
  private needsDynamicLoading(html: string, itemCount: number): boolean {
    // Check minimum expected items
    if (
      this.hybridConfig.minExpectedItems &&
      itemCount < this.hybridConfig.minExpectedItems
    ) {
      console.log(
        `[HybridScraper] Found ${itemCount} items, expected at least ${this.hybridConfig.minExpectedItems}`
      );
      return true;
    }

    // Check for dynamic loading indicators
    const lowerHtml = html.toLowerCase();
    for (const indicator of this.hybridConfig.dynamicIndicators || []) {
      if (lowerHtml.includes(indicator)) {
        console.log(`[HybridScraper] Found dynamic indicator: ${indicator}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Count items in HTML based on common patterns
   */
  private countItems(html: string): number {
    // Common faculty card patterns
    const patterns = [
      /<article[^>]*class="[^"]*faculty/gi,
      /<div[^>]*class="[^"]*person-card/gi,
      /<div[^>]*class="[^"]*faculty-card/gi,
      /<div[^>]*class="[^"]*profile-card/gi,
      /<li[^>]*class="[^"]*faculty/gi,
    ];

    let maxCount = 0;
    for (const pattern of patterns) {
      const matches = html.match(pattern);
      if (matches && matches.length > maxCount) {
        maxCount = matches.length;
      }
    }

    return maxCount;
  }

  async scrape(url: string): Promise<ScrapeResult> {
    console.log(`[HybridScraper] Starting hybrid scrape for ${url}`);

    // Step 1: Try Firecrawl first
    console.log('[HybridScraper] Attempting Firecrawl...');
    let result: ScrapeResult;

    try {
      result = await this.firecrawl.scrape(url);
      console.log(`[HybridScraper] Firecrawl returned ${result.html.length} bytes`);

      // Check if we got enough content
      const itemCount = this.countItems(result.html);
      console.log(`[HybridScraper] Found ${itemCount} items in Firecrawl response`);

      if (!this.needsDynamicLoading(result.html, itemCount)) {
        console.log('[HybridScraper] Content appears complete, using Firecrawl result');
        return result;
      }

      console.log('[HybridScraper] Dynamic loading needed, falling back to Playwright');
    } catch (e) {
      console.log(
        `[HybridScraper] Firecrawl failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }

    // Step 2: Fall back to Playwright
    console.log('[HybridScraper] Using Playwright...');
    result = await this.playwright.scrape(url);

    return result;
  }

  async cleanup(): Promise<void> {
    await this.firecrawl.cleanup();
    await this.playwright.cleanup();
  }
}

export default HybridScraper;
