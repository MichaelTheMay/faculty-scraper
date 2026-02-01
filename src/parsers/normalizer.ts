/**
 * Normalizer - Utility functions for data normalization
 */

/**
 * Normalize whitespace (collapse multiple spaces, trim)
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize email to lowercase and trim
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Normalize URL (ensure protocol, clean trailing slashes)
 */
export function normalizeUrl(url: string): string {
  let normalized = url.trim();

  // Add protocol if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }

  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  try {
    // Validate and normalize with URL constructor
    const parsed = new URL(normalized);
    return parsed.href.endsWith('/') ? parsed.href.slice(0, -1) : parsed.href;
  } catch {
    return normalized;
  }
}

/**
 * Normalize phone number (digits only with optional formatting)
 */
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters except + for international
  const digitsOnly = phone.replace(/[^\d+]/g, '');

  // Format US numbers
  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }

  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
  }

  // Return cleaned but unformatted for other formats
  return digitsOnly;
}

/**
 * Normalize name to proper case
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .split(/[\s-]+/)
    .map(word => {
      // Handle special cases
      if (word.length === 0) return '';

      // Handle prefixes like "de", "van", "von"
      if (['de', 'van', 'von', 'der', 'la', 'le', 'di'].includes(word)) {
        return word;
      }

      // Handle McDonald, O'Brien, etc.
      if (word.startsWith('mc')) {
        return 'Mc' + word.charAt(2).toUpperCase() + word.slice(3);
      }
      if (word.startsWith("o'")) {
        return "O'" + word.charAt(2).toUpperCase() + word.slice(3);
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Remove duplicates from array
 */
export function dedupeArray<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/**
 * Clean HTML tags from text
 */
export function cleanHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract plain text from HTML
 */
export function extractText(html: string): string {
  return cleanHtml(html);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url.startsWith('http') ? url : 'https://' + url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract email from text (including mailto: links)
 */
export function extractEmail(text: string): string | null {
  // Check for mailto: link
  const mailtoMatch = text.match(/mailto:([^\s?"'<>]+)/i);
  if (mailtoMatch) {
    return normalizeEmail(mailtoMatch[1]);
  }

  // Look for email pattern
  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.[\w.-]+/);
  if (emailMatch) {
    return normalizeEmail(emailMatch[0]);
  }

  return null;
}

/**
 * Extract phone from text (including tel: links)
 */
export function extractPhone(text: string): string | null {
  // Check for tel: link
  const telMatch = text.match(/tel:([^\s"'<>]+)/i);
  if (telMatch) {
    return normalizePhone(telMatch[1]);
  }

  // Look for phone pattern
  const phoneMatch = text.match(/(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/);
  if (phoneMatch) {
    return normalizePhone(phoneMatch[0]);
  }

  return null;
}

/**
 * Extract URL from href
 */
export function extractUrl(href: string, baseUrl?: string): string | null {
  if (!href || href === '#' || href.startsWith('javascript:')) {
    return null;
  }

  // Handle mailto and tel
  if (href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null;
  }

  try {
    // Handle relative URLs
    if (baseUrl && !href.startsWith('http')) {
      const base = new URL(baseUrl);
      const resolved = new URL(href, base);
      return resolved.href;
    }

    return normalizeUrl(href);
  } catch {
    return null;
  }
}

/**
 * Split text by common delimiters
 */
export function splitByDelimiters(text: string): string[] {
  return text
    .split(/[,;|•·\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Clean and normalize research area text
 */
export function normalizeResearchArea(area: string): string {
  return area
    .trim()
    .replace(/^[-•·]\s*/, '') // Remove leading bullets
    .replace(/\.$/, '') // Remove trailing period
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => {
      // Capitalize first word and proper nouns
      if (i === 0 || ['ai', 'ml', 'nlp', 'cv', 'hci', 'iot', 'api'].includes(word)) {
        return word.toUpperCase();
      }
      return word;
    })
    .join(' ');
}
