/**
 * Step 6: Deduplicate
 *
 * Check for existing researchers and decide whether to insert, update, or skip.
 */

import type { Step6Input, Step6Output, ParsedResearcher, DedupeDecision } from '../types.js';
import { researchersRepository } from '../../db/repositories/researchers.js';

/**
 * Deduplicate researchers against existing database records
 */
export async function deduplicate(input: Step6Input): Promise<Step6Output> {
  const decisions: DedupeDecision[] = [];
  const toInsert: ParsedResearcher[] = [];
  const toUpdate: { researcher: ParsedResearcher; existing_id: number }[] = [];
  const duplicates: { researcher: ParsedResearcher; existing_id: number; reason: string }[] = [];

  for (const researcher of input.researchers) {
    const decision = await checkDuplicate(researcher, input.directory_id);
    decisions.push(decision);

    switch (decision.action) {
      case 'insert':
        toInsert.push(researcher);
        break;
      case 'update':
        if (decision.existing_id) {
          toUpdate.push({ researcher, existing_id: decision.existing_id });
        }
        break;
      case 'skip':
        if (decision.existing_id) {
          duplicates.push({
            researcher,
            existing_id: decision.existing_id,
            reason: decision.match_reason || 'Exact duplicate',
          });
        }
        break;
    }
  }

  return {
    to_insert: toInsert,
    to_update: toUpdate,
    duplicates,
    stats: {
      total_input: input.researchers.length,
      to_insert: toInsert.length,
      to_update: toUpdate.length,
      duplicates: duplicates.length,
    },
  };
}

/**
 * Check if a researcher is a duplicate
 */
async function checkDuplicate(
  researcher: ParsedResearcher,
  _directoryId: number
): Promise<DedupeDecision> {
  // First, check by email (strongest match)
  if (researcher.email) {
    const byEmail = researchersRepository.findByEmail(researcher.email);
    if (byEmail) {
      // Check if data has changed
      const hasChanges = checkForChanges(researcher, byEmail);
      if (hasChanges) {
        return {
          researcher,
          action: 'update',
          existing_id: byEmail.id,
          match_reason: 'Email match with data changes',
          confidence: 1.0,
        };
      } else {
        return {
          researcher,
          action: 'skip',
          existing_id: byEmail.id,
          match_reason: 'Exact email match',
          confidence: 1.0,
        };
      }
    }
  }

  // Second, check by name + university + department
  if (researcher.university) {
    const byName = researchersRepository.findByNameAndUniversity(
      researcher.full_name,
      researcher.university,
      researcher.department
    );

    if (byName) {
      // Calculate confidence based on matching fields
      const confidence = calculateMatchConfidence(researcher, byName);

      if (confidence >= 0.9) {
        const hasChanges = checkForChanges(researcher, byName);
        if (hasChanges) {
          return {
            researcher,
            action: 'update',
            existing_id: byName.id,
            match_reason: `Name+university match (${(confidence * 100).toFixed(0)}% confidence)`,
            confidence,
          };
        } else {
          return {
            researcher,
            action: 'skip',
            existing_id: byName.id,
            match_reason: `Exact name+university match`,
            confidence,
          };
        }
      }
    }
  }

  // No match found - insert new
  return {
    researcher,
    action: 'insert',
    confidence: 1.0,
  };
}

/**
 * Check if there are meaningful data changes
 */
function checkForChanges(
  incoming: ParsedResearcher,
  existing: {
    title?: string;
    email?: string;
    phone?: string;
    office?: string;
    website?: string;
    research_areas?: string[];
  }
): boolean {
  // Check if any field has new/different data
  if (incoming.title && incoming.title !== existing.title) return true;
  if (incoming.email && incoming.email !== existing.email) return true;
  if (incoming.phone && incoming.phone !== existing.phone) return true;
  if (incoming.office && incoming.office !== existing.office) return true;
  if (incoming.website && incoming.website !== existing.website) return true;

  // Check research areas
  if (incoming.research_areas && incoming.research_areas.length > 0) {
    const existingAreas = new Set(existing.research_areas || []);
    const newAreas = incoming.research_areas.filter(a => !existingAreas.has(a));
    if (newAreas.length > 0) return true;
  }

  return false;
}

/**
 * Calculate match confidence based on matching fields
 */
function calculateMatchConfidence(
  incoming: ParsedResearcher,
  existing: {
    title?: string;
    email?: string;
    phone?: string;
    website?: string;
  }
): number {
  let score = 0.5; // Base score for name match

  // Boost for matching title
  if (incoming.title && existing.title) {
    if (incoming.title.toLowerCase() === existing.title.toLowerCase()) {
      score += 0.2;
    } else if (incoming.title.toLowerCase().includes(existing.title.toLowerCase()) ||
               existing.title.toLowerCase().includes(incoming.title.toLowerCase())) {
      score += 0.1;
    }
  }

  // Boost for matching email domain
  if (incoming.email && existing.email) {
    const incomingDomain = incoming.email.split('@')[1];
    const existingDomain = existing.email.split('@')[1];
    if (incomingDomain === existingDomain) {
      score += 0.15;
    }
  }

  // Boost for matching phone
  if (incoming.phone && existing.phone) {
    const incomingDigits = incoming.phone.replace(/\D/g, '');
    const existingDigits = existing.phone.replace(/\D/g, '');
    if (incomingDigits === existingDigits) {
      score += 0.1;
    }
  }

  // Boost for matching website domain
  if (incoming.website && existing.website) {
    try {
      const incomingHost = new URL(incoming.website).hostname;
      const existingHost = new URL(existing.website).hostname;
      if (incomingHost === existingHost) {
        score += 0.05;
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  return Math.min(score, 1.0);
}

/**
 * Run Step 6
 */
export async function runStep6(input: Step6Input): Promise<Step6Output> {
  return deduplicate(input);
}

export default runStep6;
