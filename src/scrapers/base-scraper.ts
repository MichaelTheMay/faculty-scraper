/**
 * Base Scraper - Abstract class for all scrapers
 */

export interface ScraperConfig {
  timeout?: number;
  waitForSelector?: string;
  loadMoreSelector?: string;
  maxLoadMoreClicks?: number;
  scrollToLoad?: boolean;
  userAgent?: string;
}

export interface ScrapeResult {
  html: string;
  markdown?: string;
  links: string[];
  screenshot?: string;
  metadata: {
    fetchTime: number;
    contentLength: number;
    loadMoreClicks?: number;
    scrollPerformed?: boolean;
  };
}

/**
 * Abstract base class for scrapers
 */
export abstract class BaseScraper {
  protected config: ScraperConfig;

  constructor(config: ScraperConfig = {}) {
    this.config = {
      timeout: 30000,
      maxLoadMoreClicks: 30,
      scrollToLoad: false,
      ...config,
    };
  }

  /**
   * Scrape a URL and return the content
   */
  abstract scrape(url: string): Promise<ScrapeResult>;

  /**
   * Check if this scraper can handle the given URL
   */
  abstract canHandle(url: string): boolean;

  /**
   * Get the name of this scraper
   */
  abstract getName(): string;

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Override in subclasses if needed
  }
}

export default BaseScraper;
