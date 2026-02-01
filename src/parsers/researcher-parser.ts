/**
 * Researcher Parser - Parse and normalize researcher data
 */

import {
  normalizeWhitespace,
  normalizeEmail,
  normalizePhone,
  normalizeUrl,
  normalizeName,
  isValidEmail,
  isValidUrl,
  splitByDelimiters,
  normalizeResearchArea,
} from './normalizer.js';

export interface ParsedName {
  first_name: string;
  last_name: string;
  full_name: string;
  prefix?: string;
  suffix?: string;
}

// Common name prefixes
const NAME_PREFIXES = ['dr', 'dr.', 'prof', 'prof.', 'professor', 'mr', 'mr.', 'ms', 'ms.', 'mrs', 'mrs.'];

// Common name suffixes
const NAME_SUFFIXES = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'phd', 'ph.d', 'ph.d.', 'md', 'm.d', 'm.d.', 'esq', 'esq.'];

// Academic titles
const ACADEMIC_TITLES: Record<string, string> = {
  'professor': 'Professor',
  'prof': 'Professor',
  'prof.': 'Professor',
  'associate professor': 'Associate Professor',
  'assoc. professor': 'Associate Professor',
  'assoc professor': 'Associate Professor',
  'assistant professor': 'Assistant Professor',
  'asst. professor': 'Assistant Professor',
  'asst professor': 'Assistant Professor',
  'lecturer': 'Lecturer',
  'senior lecturer': 'Senior Lecturer',
  'adjunct professor': 'Adjunct Professor',
  'emeritus professor': 'Professor Emeritus',
  'professor emeritus': 'Professor Emeritus',
  'research professor': 'Research Professor',
  'visiting professor': 'Visiting Professor',
  'distinguished professor': 'Distinguished Professor',
  'endowed professor': 'Endowed Professor',
  'postdoc': 'Postdoctoral Researcher',
  'postdoctoral': 'Postdoctoral Researcher',
  'postdoctoral researcher': 'Postdoctoral Researcher',
  'postdoctoral fellow': 'Postdoctoral Fellow',
  'research scientist': 'Research Scientist',
  'research associate': 'Research Associate',
  'instructor': 'Instructor',
};

/**
 * Parse a full name into first and last name
 */
export function parseName(fullName: string): ParsedName {
  let name = normalizeWhitespace(fullName);

  // Extract prefix
  let prefix: string | undefined;
  for (const p of NAME_PREFIXES) {
    const regex = new RegExp(`^${p}\\s+`, 'i');
    if (regex.test(name)) {
      prefix = p.replace('.', '');
      name = name.replace(regex, '');
      break;
    }
  }

  // Extract suffix
  let suffix: string | undefined;
  for (const s of NAME_SUFFIXES) {
    const regex = new RegExp(`[,\\s]+${s}$`, 'i');
    if (regex.test(name)) {
      suffix = s.replace('.', '');
      name = name.replace(regex, '');
      break;
    }
  }

  // Clean up and normalize
  name = normalizeWhitespace(name);

  let firstName: string;
  let lastName: string;

  // Check for "Last, First" format
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    lastName = normalizeName(parts[0]);
    firstName = normalizeName(parts.slice(1).join(' '));
  } else {
    // "First [Middle] Last" format
    const parts = name.split(/\s+/);

    if (parts.length === 1) {
      firstName = normalizeName(parts[0]);
      lastName = '';
    } else if (parts.length === 2) {
      firstName = normalizeName(parts[0]);
      lastName = normalizeName(parts[1]);
    } else {
      // Handle multi-part names
      // Check for common last name prefixes
      const lastNamePrefixes = ['de', 'van', 'von', 'der', 'la', 'le', 'di', 'del', 'da'];
      let lastNameStart = parts.length - 1;

      // Look for last name prefix
      for (let i = parts.length - 2; i >= 1; i--) {
        if (lastNamePrefixes.includes(parts[i].toLowerCase())) {
          lastNameStart = i;
          break;
        }
      }

      firstName = normalizeName(parts.slice(0, lastNameStart).join(' '));
      lastName = normalizeName(parts.slice(lastNameStart).join(' '));
    }
  }

  // Construct full name
  const fullNameNormalized = `${firstName} ${lastName}`.trim();

  return {
    first_name: firstName,
    last_name: lastName,
    full_name: fullNameNormalized,
    prefix,
    suffix,
  };
}

/**
 * Parse and validate email
 */
export function parseEmail(email: string): string | null {
  const normalized = normalizeEmail(email);

  if (isValidEmail(normalized)) {
    return normalized;
  }

  return null;
}

/**
 * Parse and normalize phone number
 */
export function parsePhone(phone: string): string | null {
  const normalized = normalizePhone(phone);

  // Must have at least 10 digits
  const digitCount = normalized.replace(/\D/g, '').length;
  if (digitCount < 10) {
    return null;
  }

  return normalized;
}

/**
 * Parse and standardize academic title
 */
export function parseTitle(title: string): string {
  const normalized = normalizeWhitespace(title.toLowerCase());

  // Check for exact matches
  if (ACADEMIC_TITLES[normalized]) {
    return ACADEMIC_TITLES[normalized];
  }

  // Check for partial matches
  for (const [pattern, standardized] of Object.entries(ACADEMIC_TITLES)) {
    if (normalized.includes(pattern)) {
      return standardized;
    }
  }

  // Return cleaned version if no match
  return normalizeName(title);
}

/**
 * Parse research areas from text
 */
export function parseResearchAreas(text: string): string[] {
  const areas = splitByDelimiters(text)
    .map(normalizeResearchArea)
    .filter(a => a.length > 2); // Filter out very short entries

  // Dedupe
  return [...new Set(areas)];
}

/**
 * Parse and validate website URL
 */
export function parseWebsite(url: string): string | null {
  const normalized = normalizeUrl(url);

  if (isValidUrl(normalized)) {
    return normalized;
  }

  return null;
}

/**
 * Parse Google Scholar URL from various formats
 */
export function parseGoogleScholarUrl(input: string): string | null {
  // Already a URL
  if (input.includes('scholar.google.com')) {
    try {
      const url = new URL(input.startsWith('http') ? input : 'https://' + input);
      return url.href;
    } catch {
      return null;
    }
  }

  // Could be a user ID
  if (/^[A-Za-z0-9_-]+$/.test(input)) {
    return `https://scholar.google.com/citations?user=${input}`;
  }

  return null;
}

/**
 * Parse DBLP URL from various formats
 */
export function parseDblpUrl(input: string): string | null {
  // Already a URL
  if (input.includes('dblp.org')) {
    try {
      const url = new URL(input.startsWith('http') ? input : 'https://' + input);
      return url.href;
    } catch {
      return null;
    }
  }

  // Could be a person ID (e.g., "John_Smith")
  if (/^[A-Za-z0-9_-]+$/.test(input)) {
    return `https://dblp.org/pid/${input}.html`;
  }

  return null;
}

/**
 * Extract h-index from text
 */
export function parseHIndex(text: string): number | null {
  // Look for patterns like "h-index: 45", "h-index = 45", "h-index 45"
  const match = text.match(/h[-\s]?index[\s:=]+(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }

  return null;
}

/**
 * Extract citation count from text
 */
export function parseCitations(text: string): number | null {
  // Look for patterns like "Citations: 1,234", "1234 citations"
  const match = text.match(/(?:citations?[\s:=]+)?([0-9,]+)(?:\s*citations?)?/i);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''), 10);
  }

  return null;
}
