/**
 * Step 5: Parse and Normalize
 *
 * Parse raw cards into structured researcher data with normalization.
 */

import type { Step5Input, Step5Output, ParsedResearcher, ParseError, RawCard } from '../types.js';
import {
  parseName,
  parseEmail,
  parsePhone,
  parseTitle,
  parseResearchAreas,
  parseWebsite,
} from '../../parsers/researcher-parser.js';
import { normalizeWhitespace, cleanHtml } from '../../parsers/normalizer.js';

/**
 * Parse and normalize researcher cards
 */
export async function parseAndNormalize(input: Step5Input): Promise<Step5Output> {
  const researchers: ParsedResearcher[] = [];
  const parseErrors: ParseError[] = [];
  const stats = {
    total_parsed: 0,
    emails_normalized: 0,
    names_split: 0,
    titles_standardized: 0,
  };

  for (const card of input.raw_cards) {
    try {
      const researcher = parseCard(card, input.university, input.department, parseErrors);
      if (researcher) {
        researchers.push(researcher);
        stats.total_parsed++;

        // Track normalization stats
        if (researcher.email) stats.emails_normalized++;
        if (researcher.first_name && researcher.last_name) stats.names_split++;
        if (researcher.title) stats.titles_standardized++;
      }
    } catch (error) {
      parseErrors.push({
        card_index: card.index,
        field: 'general',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    researchers,
    parse_errors: parseErrors,
    normalization_stats: stats,
  };
}

/**
 * Parse a single card into a researcher
 */
function parseCard(
  card: RawCard,
  university: string,
  department: string,
  errors: ParseError[]
): ParsedResearcher | null {
  // Must have a name
  if (!card.name_text) {
    errors.push({
      card_index: card.index,
      field: 'name',
      error: 'Missing name',
    });
    return null;
  }

  // Parse name
  let parsedName;
  try {
    const cleanName = cleanHtml(card.name_text);
    parsedName = parseName(cleanName);

    if (!parsedName.first_name && !parsedName.last_name) {
      errors.push({
        card_index: card.index,
        field: 'name',
        error: 'Could not parse name',
        raw_value: card.name_text,
      });
      return null;
    }
  } catch {
    errors.push({
      card_index: card.index,
      field: 'name',
      error: 'Name parsing failed',
      raw_value: card.name_text,
    });
    return null;
  }

  // Build researcher object
  const researcher: ParsedResearcher = {
    first_name: parsedName.first_name,
    last_name: parsedName.last_name,
    full_name: parsedName.full_name,
    university,
    department,
  };

  // Parse title
  if (card.title_text) {
    try {
      const cleanTitle = cleanHtml(card.title_text);
      researcher.title = parseTitle(cleanTitle);
    } catch {
      errors.push({
        card_index: card.index,
        field: 'title',
        error: 'Title parsing failed',
        raw_value: card.title_text,
      });
    }
  }

  // Parse email
  if (card.email_text) {
    try {
      const email = parseEmail(card.email_text);
      if (email) {
        researcher.email = email;
      } else {
        errors.push({
          card_index: card.index,
          field: 'email',
          error: 'Invalid email format',
          raw_value: card.email_text,
        });
      }
    } catch {
      errors.push({
        card_index: card.index,
        field: 'email',
        error: 'Email parsing failed',
        raw_value: card.email_text,
      });
    }
  }

  // Parse phone
  if (card.phone_text) {
    try {
      const phone = parsePhone(card.phone_text);
      if (phone) {
        researcher.phone = phone;
      }
    } catch {
      errors.push({
        card_index: card.index,
        field: 'phone',
        error: 'Phone parsing failed',
        raw_value: card.phone_text,
      });
    }
  }

  // Parse office
  if (card.office_text) {
    researcher.office = normalizeWhitespace(cleanHtml(card.office_text));
  }

  // Parse website
  if (card.website_url) {
    try {
      const website = parseWebsite(card.website_url);
      if (website) {
        researcher.website = website;
      }
    } catch {
      errors.push({
        card_index: card.index,
        field: 'website',
        error: 'Website URL invalid',
        raw_value: card.website_url,
      });
    }
  }

  // Parse photo URL
  if (card.photo_url) {
    try {
      const photo = parseWebsite(card.photo_url);
      if (photo) {
        researcher.photo_url = photo;
      }
    } catch {
      // Photo URL errors are not critical
    }
  }

  // Parse research areas
  if (card.research_areas_text) {
    try {
      const areas = parseResearchAreas(cleanHtml(card.research_areas_text));
      if (areas.length > 0) {
        researcher.research_areas = areas;
      }
    } catch {
      errors.push({
        card_index: card.index,
        field: 'research_areas',
        error: 'Research areas parsing failed',
        raw_value: card.research_areas_text,
      });
    }
  }

  return researcher;
}

/**
 * Run Step 5
 */
export async function runStep5(input: Step5Input): Promise<Step5Output> {
  return parseAndNormalize(input);
}

export default runStep5;
