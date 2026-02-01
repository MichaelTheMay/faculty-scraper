/**
 * Step 2: Fetch Page Content
 *
 * Fetch HTML content from a URL using the specified method.
 */

import type { Step2Input, Step2Output } from '../types.js';

/**
 * Fetch page content
 */
export async function fetchPageContent(input: Step2Input): Promise<Step2Output> {
  const startTime = Date.now();
  const { url, method, step0_html } = input;

  // If Step 0 already fetched the page, use that
  if (step0_html) {
    return {
      html: step0_html,
      markdown: '',
      links: [],
      fetch_time_ms: 0,
      from_cache: true,
    };
  }

  // Fetch based on method
  console.log(`[Step 2] Would fetch ${url} via ${method}`);

  // In production, this would use Firecrawl or Playwright MCP
  // For now, return placeholder response
  const html = '';
  const links: string[] = [];
  const fetchTime = Date.now() - startTime;

  return {
    html,
    markdown: '',
    links,
    fetch_time_ms: fetchTime,
    from_cache: false,
  };
}

/**
 * Run Step 2
 */
export async function runStep2(input: Step2Input): Promise<Step2Output> {
  return fetchPageContent(input);
}

export default runStep2;
