/**
 * Step 1: Load Directory Config
 *
 * Load directory configuration from database or provided config.
 */

import type { Step1Input, Step1Output, Directory } from '../types.js';
import directoriesRepository from '../../db/repositories/directories.js';

/**
 * Load directory configuration
 */
export async function loadDirectoryConfig(input: Step1Input): Promise<Step1Output> {
  let directory: Directory | null = null;
  let useStep0Html = false;

  // Load from database by ID
  if (input.directory_id) {
    const dbDirectory = directoriesRepository.findById(input.directory_id);
    if (dbDirectory) {
      // Repository already parses scrape_config JSON
      directory = dbDirectory;
    }
  }

  // Use provided config from Step 0
  if (input.from_step0) {
    useStep0Html = true;
    const step0 = input.from_step0;

    if (directory) {
      // Update selectors from Step 0 discovery
      const existingConfig = directory.scrape_config || {};
      directory.scrape_config = {
        ...existingConfig,
        selectors: {
          ...existingConfig.selectors,
          card: step0.selectors_discovered.researcher_card,
          name: step0.selectors_discovered.name,
          title: step0.selectors_discovered.title,
          email: step0.selectors_discovered.email,
          phone: step0.selectors_discovered.phone,
          website: step0.selectors_discovered.website,
          photo: step0.selectors_discovered.photo,
        },
      };
    } else if (input.url) {
      // Create minimal directory from Step 0 + URL
      directory = {
        id: 0,
        university: 'Unknown',
        department: 'Unknown',
        directory_url: input.url,
        scrape_method: 'playwright',
        scrape_config: {
          selectors: {
            card: step0.selectors_discovered.researcher_card,
            name: step0.selectors_discovered.name,
            title: step0.selectors_discovered.title,
            email: step0.selectors_discovered.email,
          },
        },
        is_active: true,
        records_last_scrape: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  }

  if (!directory) {
    throw new Error('No directory configuration found. Provide directory_id, url, or from_step0.');
  }

  // Build selectors with defaults
  const config = directory.scrape_config || {};
  const selectors = config.selectors || {};
  const defaultSelectors = {
    card: '.faculty-card, .person-card, .profile-card, article.faculty',
    name: '.name, .faculty-name, .person-name, h2, h3',
    title: '.title, .position, .faculty-title',
    email: 'a[href^="mailto:"], .email',
    phone: '.phone, .telephone, a[href^="tel:"]',
    office: '.office, .location, .room',
    website: 'a[href*="http"]:not([href*="mailto"])',
    photo: 'img.photo, img.headshot, img.portrait',
    research_areas: '.research, .interests, .expertise',
  };

  return {
    directory,
    url: directory.directory_url,
    scrape_method: directory.scrape_method,
    selectors: {
      card: selectors.card || defaultSelectors.card,
      name: selectors.name || defaultSelectors.name,
      title: selectors.title || defaultSelectors.title,
      email: selectors.email || defaultSelectors.email,
      phone: selectors.phone || defaultSelectors.phone,
      office: selectors.office || defaultSelectors.office,
      website: selectors.website || defaultSelectors.website,
      photo: selectors.photo || defaultSelectors.photo,
      research_areas: selectors.research_areas || defaultSelectors.research_areas,
    },
    load_more_config: config.load_more_selector
      ? {
          selector: config.load_more_selector,
          max_clicks: 30,
          wait_between_clicks_ms: config.wait_after_load_ms || 1000,
        }
      : undefined,
    scroll_config: config.scroll_config,
    use_step0_html: useStep0Html,
  };
}

/**
 * Run Step 1
 */
export async function runStep1(input: Step1Input): Promise<Step1Output> {
  return loadDirectoryConfig(input);
}

export default runStep1;
