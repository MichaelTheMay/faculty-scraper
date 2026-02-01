/**
 * Publication Parser - Parse publications from various sources
 */

import type { Publication } from '../pipeline/types.js';
import { normalizeWhitespace, cleanHtml } from './normalizer.js';

type PublicationData = Omit<Publication, 'id' | 'created_at' | 'updated_at'>;

// Common venue type keywords
const CONFERENCE_KEYWORDS = ['conference', 'symposium', 'workshop', 'proceedings', 'icml', 'neurips', 'cvpr', 'iccv', 'aaai', 'ijcai', 'acl', 'emnlp', 'naacl', 'sigmod', 'vldb', 'sigir', 'www', 'kdd', 'icse', 'fse', 'chi', 'uist', 'ubicomp'];
const JOURNAL_KEYWORDS = ['journal', 'transactions', 'letters', 'review', 'magazine', 'bulletin', 'annals'];
const PREPRINT_KEYWORDS = ['arxiv', 'biorxiv', 'medrxiv', 'ssrn', 'preprint'];

/**
 * Parse publication from DBLP format
 */
export function parseFromDblp(data: {
  title?: string;
  authors?: string | string[];
  venue?: string;
  year?: number | string;
  doi?: string;
  url?: string;
  type?: string;
}): PublicationData | null {
  if (!data.title) return null;

  const title = normalizeWhitespace(data.title.replace(/\.$/, ''));

  let authors: string[] | undefined;
  if (typeof data.authors === 'string') {
    authors = data.authors.split(/,\s*and\s*|\s+and\s+|,\s*/);
  } else if (Array.isArray(data.authors)) {
    authors = data.authors;
  }

  const year = typeof data.year === 'string' ? parseInt(data.year, 10) : data.year;

  return {
    title,
    authors: authors?.map(a => normalizeWhitespace(a)),
    venue: data.venue ? normalizeWhitespace(data.venue) : undefined,
    venue_type: data.type ? parseVenueType(data.type) : inferVenueType(data.venue || ''),
    year: year && !isNaN(year) ? year : undefined,
    doi: data.doi,
    url: data.url,
    citations: 0,
    source: 'dblp',
  };
}

/**
 * Parse publication from Semantic Scholar format
 */
export function parseFromSemanticScholar(data: {
  title?: string;
  authors?: Array<{ name: string }>;
  venue?: string;
  year?: number;
  externalIds?: { DOI?: string };
  url?: string;
  abstract?: string;
  citationCount?: number;
  paperId?: string;
}): PublicationData | null {
  if (!data.title) return null;

  return {
    title: normalizeWhitespace(data.title),
    authors: data.authors?.map(a => a.name),
    venue: data.venue ? normalizeWhitespace(data.venue) : undefined,
    venue_type: inferVenueType(data.venue || ''),
    year: data.year,
    doi: data.externalIds?.DOI,
    url: data.url,
    abstract: data.abstract ? cleanAbstract(data.abstract) : undefined,
    citations: data.citationCount || 0,
    source: 'semantic_scholar',
    source_id: data.paperId,
  };
}

/**
 * Parse publication from HTML element (generic)
 */
export function parseFromHtml(element: {
  title?: string;
  authors?: string;
  venue?: string;
  year?: string;
  doi?: string;
  url?: string;
}): PublicationData | null {
  if (!element.title) return null;

  const title = normalizeWhitespace(cleanHtml(element.title).replace(/\.$/, ''));

  let authors: string[] | undefined;
  if (element.authors) {
    authors = parseAuthors(element.authors);
  }

  const year = element.year ? parseInt(element.year, 10) : undefined;

  return {
    title,
    authors,
    venue: element.venue ? normalizeWhitespace(cleanHtml(element.venue)) : undefined,
    venue_type: inferVenueType(element.venue || ''),
    year: year && !isNaN(year) ? year : undefined,
    doi: element.doi,
    url: element.url,
    citations: 0,
    source: 'website',
  };
}

/**
 * Parse author list from string
 */
export function parseAuthors(authorString: string): string[] {
  // Clean HTML first
  const cleaned = cleanHtml(authorString);

  // Split by common delimiters
  const authors = cleaned
    .split(/,\s*and\s*|\s+and\s+|,\s*(?=[A-Z])|;\s*/)
    .map(a => normalizeWhitespace(a))
    .filter(a => a.length > 1 && !a.match(/^\d+$/)); // Filter out empty and numbers

  return authors;
}

/**
 * Parse venue into name and type
 */
export function parseVenue(venueString: string): { venue: string; venue_type: Publication['venue_type'] } {
  const venue = normalizeWhitespace(cleanHtml(venueString));
  const venue_type = inferVenueType(venue);

  return { venue, venue_type };
}

/**
 * Infer venue type from name
 */
function inferVenueType(venue: string): Publication['venue_type'] {
  const lowerVenue = venue.toLowerCase();

  // Check preprints first
  for (const keyword of PREPRINT_KEYWORDS) {
    if (lowerVenue.includes(keyword)) return 'preprint';
  }

  // Check conferences
  for (const keyword of CONFERENCE_KEYWORDS) {
    if (lowerVenue.includes(keyword)) return 'conference';
  }

  // Check journals
  for (const keyword of JOURNAL_KEYWORDS) {
    if (lowerVenue.includes(keyword)) return 'journal';
  }

  // Default based on patterns
  if (lowerVenue.match(/\d{4}/)) {
    // Year in venue often indicates conference
    return 'conference';
  }

  return 'other';
}

/**
 * Parse venue type from explicit type string
 */
function parseVenueType(typeString: string): Publication['venue_type'] {
  const lowerType = typeString.toLowerCase();

  if (lowerType.includes('journal') || lowerType.includes('article')) return 'journal';
  if (lowerType.includes('conference') || lowerType.includes('inproceedings')) return 'conference';
  if (lowerType.includes('workshop')) return 'workshop';
  if (lowerType.includes('book')) return 'book';
  if (lowerType.includes('thesis') || lowerType.includes('dissertation')) return 'thesis';
  if (lowerType.includes('preprint') || lowerType.includes('arxiv')) return 'preprint';

  return 'other';
}

/**
 * Extract DOI from text
 */
export function extractDoi(text: string): string | null {
  // DOI patterns
  const patterns = [
    /doi\.org\/([^\s"'<>]+)/i,
    /doi:\s*([^\s"'<>]+)/i,
    /DOI:\s*([^\s"'<>]+)/i,
    /(10\.\d{4,}\/[^\s"'<>]+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let doi = match[1];
      // Clean up
      doi = doi.replace(/[.,;:)\]]+$/, ''); // Remove trailing punctuation
      return doi;
    }
  }

  return null;
}

/**
 * Clean and normalize abstract text
 */
export function cleanAbstract(text: string): string {
  let abstract = cleanHtml(text);

  // Remove common prefixes
  abstract = abstract.replace(/^(abstract[:\s]*)/i, '');

  // Normalize whitespace
  abstract = normalizeWhitespace(abstract);

  // Truncate if too long (keep first 2000 chars)
  if (abstract.length > 2000) {
    abstract = abstract.substring(0, 2000) + '...';
  }

  return abstract;
}

/**
 * Extract year from text
 */
export function extractYear(text: string): number | null {
  // Look for 4-digit year between 1900 and current year + 1
  const currentYear = new Date().getFullYear();
  const match = text.match(/\b(19\d{2}|20[0-2]\d)\b/);

  if (match) {
    const year = parseInt(match[1], 10);
    if (year >= 1900 && year <= currentYear + 1) {
      return year;
    }
  }

  return null;
}

/**
 * Merge publications from multiple sources
 */
export function mergePublications(publications: PublicationData[]): PublicationData[] {
  const merged = new Map<string, PublicationData>();

  for (const pub of publications) {
    // Generate a key for deduplication
    const key = generatePublicationKey(pub);

    if (merged.has(key)) {
      // Merge with existing
      const existing = merged.get(key)!;
      merged.set(key, mergePublication(existing, pub));
    } else {
      merged.set(key, pub);
    }
  }

  return Array.from(merged.values());
}

/**
 * Generate a deduplication key for a publication
 */
function generatePublicationKey(pub: PublicationData): string {
  // Normalize title for comparison
  const normalizedTitle = pub.title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 50);

  return `${normalizedTitle}-${pub.year || 'unknown'}`;
}

/**
 * Merge two publication records
 */
function mergePublication(a: PublicationData, b: PublicationData): PublicationData {
  return {
    title: a.title.length >= b.title.length ? a.title : b.title,
    authors: a.authors || b.authors,
    venue: a.venue || b.venue,
    venue_type: a.venue_type || b.venue_type,
    year: a.year || b.year,
    doi: a.doi || b.doi,
    url: a.url || b.url,
    abstract: a.abstract || b.abstract,
    citations: Math.max(a.citations || 0, b.citations || 0),
    source: a.source, // Keep first source
    source_id: a.source_id || b.source_id,
  };
}
