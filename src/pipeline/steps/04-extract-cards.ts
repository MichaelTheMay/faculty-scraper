/**
 * Step 4: Extract Researcher Cards
 *
 * Extract researcher information from HTML using CSS selectors.
 */

import * as cheerio from 'cheerio';
import type { Step4Input, Step4Output, RawCard } from '../types.js';
import { extractEmail, extractPhone, extractUrl } from '../../parsers/normalizer.js';

/**
 * Extract researcher cards from HTML
 */
export async function extractCards(input: Step4Input): Promise<Step4Output> {
  const $ = cheerio.load(input.html);
  const { selectors } = input;

  const rawCards: RawCard[] = [];
  const stats = {
    total_cards: 0,
    cards_with_name: 0,
    cards_with_email: 0,
    cards_with_title: 0,
    cards_with_website: 0,
  };

  // Find all card elements
  const cardSelector = selectors.card || '.faculty-card, .person-card, .profile-card, .researcher, .faculty-member';
  const cardElements = $(cardSelector);

  cardElements.each((index, element) => {
    const $card = $(element);
    const card: RawCard = {
      index,
      outer_html: $.html($card),
    };

    // Extract name
    if (selectors.name) {
      const nameEl = $card.find(selectors.name);
      if (nameEl.length) {
        card.name_text = nameEl.text().trim();
        if (card.name_text) stats.cards_with_name++;
      }
    } else {
      // Try common name selectors
      const nameSelectors = ['.name', '.faculty-name', '.person-name', 'h2', 'h3', '.title a'];
      for (const sel of nameSelectors) {
        const nameEl = $card.find(sel).first();
        if (nameEl.length) {
          card.name_text = nameEl.text().trim();
          if (card.name_text) {
            stats.cards_with_name++;
            break;
          }
        }
      }
    }

    // Extract title/position
    if (selectors.title) {
      const titleEl = $card.find(selectors.title);
      if (titleEl.length) {
        card.title_text = titleEl.text().trim();
        if (card.title_text) stats.cards_with_title++;
      }
    } else {
      // Try common title selectors
      const titleSelectors = ['.title', '.position', '.role', '.faculty-title', '.job-title'];
      for (const sel of titleSelectors) {
        const titleEl = $card.find(sel).first();
        if (titleEl.length) {
          card.title_text = titleEl.text().trim();
          if (card.title_text) {
            stats.cards_with_title++;
            break;
          }
        }
      }
    }

    // Extract email
    if (selectors.email) {
      const emailEl = $card.find(selectors.email);
      if (emailEl.length) {
        // Check for mailto: link
        const href = emailEl.attr('href');
        if (href) {
          card.email_text = extractEmail(href) || undefined;
        } else {
          card.email_text = extractEmail(emailEl.text()) || undefined;
        }
        if (card.email_text) stats.cards_with_email++;
      }
    } else {
      // Try to find mailto: links
      const mailtoLinks = $card.find('a[href^="mailto:"]');
      if (mailtoLinks.length) {
        const href = mailtoLinks.first().attr('href');
        if (href) {
          card.email_text = extractEmail(href) || undefined;
          if (card.email_text) stats.cards_with_email++;
        }
      }
    }

    // Extract phone
    if (selectors.phone) {
      const phoneEl = $card.find(selectors.phone);
      if (phoneEl.length) {
        const href = phoneEl.attr('href');
        if (href) {
          card.phone_text = extractPhone(href) || undefined;
        } else {
          card.phone_text = extractPhone(phoneEl.text()) || undefined;
        }
      }
    } else {
      // Try to find tel: links
      const telLinks = $card.find('a[href^="tel:"]');
      if (telLinks.length) {
        const href = telLinks.first().attr('href');
        if (href) {
          card.phone_text = extractPhone(href) || undefined;
        }
      }
    }

    // Extract office
    if (selectors.office) {
      const officeEl = $card.find(selectors.office);
      if (officeEl.length) {
        card.office_text = officeEl.text().trim();
      }
    }

    // Extract website
    if (selectors.website) {
      const websiteEl = $card.find(selectors.website);
      if (websiteEl.length) {
        const href = websiteEl.attr('href');
        if (href) {
          card.website_url = extractUrl(href) || undefined;
          if (card.website_url) stats.cards_with_website++;
        }
      }
    } else {
      // Try to find personal website link
      const links = $card.find('a');
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const href = $(link).attr('href');
        const text = $(link).text().toLowerCase();
        if (href && (text.includes('website') || text.includes('homepage') || text.includes('personal'))) {
          card.website_url = extractUrl(href) || undefined;
          if (card.website_url) {
            stats.cards_with_website++;
            break;
          }
        }
      }
    }

    // Extract photo
    if (selectors.photo) {
      const photoEl = $card.find(selectors.photo);
      if (photoEl.length) {
        card.photo_url = photoEl.attr('src') || photoEl.attr('data-src') || undefined;
      }
    } else {
      // Try to find img
      const img = $card.find('img').first();
      if (img.length) {
        card.photo_url = img.attr('src') || img.attr('data-src') || undefined;
      }
    }

    // Extract research areas
    if (selectors.research_areas) {
      const areasEl = $card.find(selectors.research_areas);
      if (areasEl.length) {
        card.research_areas_text = areasEl.text().trim();
      }
    }

    // Extract profile link
    const profileLink = $card.find('a').first();
    if (profileLink.length) {
      const href = profileLink.attr('href');
      if (href && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        card.profile_link = href;
      }
    }

    rawCards.push(card);
    stats.total_cards++;
  });

  return {
    raw_cards: rawCards,
    extraction_stats: stats,
  };
}

/**
 * Run Step 4
 */
export async function runStep4(input: Step4Input): Promise<Step4Output> {
  return extractCards(input);
}

export default runStep4;
