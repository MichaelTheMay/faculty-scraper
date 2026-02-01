/**
 * Step E3: Merge Enrichment Data
 *
 * Merge enriched data with existing researcher record.
 */

import type { StepE3Input, StepE3Output, MergeConflict, Researcher, Publication } from '../types.js';

type PublicationInput = Omit<Publication, 'id' | 'created_at' | 'updated_at'>;

/**
 * Merge enrichment data with existing record
 */
export async function mergeEnrichmentData(input: StepE3Input): Promise<StepE3Output> {
  const { existing, enriched } = input;

  const conflicts: MergeConflict[] = [];
  const merged: Partial<Researcher> = {};
  const publications_to_add: PublicationInput[] = enriched.publications || [];

  // Merge h-index (take higher value)
  if (enriched.h_index !== undefined) {
    if (existing.h_index !== undefined && existing.h_index !== enriched.h_index) {
      const useNew = enriched.h_index > existing.h_index;
      conflicts.push({
        field: 'h_index',
        existing_value: existing.h_index,
        new_value: enriched.h_index,
        resolution: useNew ? 'use_new' : 'keep_existing',
      });
      if (useNew) merged.h_index = enriched.h_index;
    } else if (existing.h_index === undefined) {
      merged.h_index = enriched.h_index;
    }
  }

  // Merge citations (take higher value)
  if (enriched.citations_total !== undefined) {
    if (existing.citations_total !== enriched.citations_total) {
      const useNew = enriched.citations_total > existing.citations_total;
      conflicts.push({
        field: 'citations_total',
        existing_value: existing.citations_total,
        new_value: enriched.citations_total,
        resolution: useNew ? 'use_new' : 'keep_existing',
      });
      if (useNew) merged.citations_total = enriched.citations_total;
    }
  }

  // Merge research areas (combine and dedupe)
  if (enriched.research_areas && enriched.research_areas.length > 0) {
    const existingAreas = existing.research_areas || [];
    const allAreas = new Set([...existingAreas, ...enriched.research_areas]);
    const mergedAreas = Array.from(allAreas);

    if (existingAreas.length > 0) {
      conflicts.push({
        field: 'research_areas',
        existing_value: existingAreas,
        new_value: enriched.research_areas,
        resolution: 'merge',
      });
    }

    merged.research_areas = mergedAreas;
  }

  // Merge bio (prefer new if missing)
  if (enriched.bio && !existing.bio) {
    merged.bio = enriched.bio;
  }

  // Merge URLs (prefer new if missing)
  if (enriched.google_scholar_url && !existing.google_scholar_url) {
    merged.google_scholar_url = enriched.google_scholar_url;
  }
  if (enriched.dblp_url && !existing.dblp_url) {
    merged.dblp_url = enriched.dblp_url;
  }
  if (enriched.semantic_scholar_id && !existing.semantic_scholar_id) {
    merged.semantic_scholar_id = enriched.semantic_scholar_id;
  }
  if (enriched.orcid && !existing.orcid) {
    merged.orcid = enriched.orcid;
  }

  // Update enrichment status
  merged.enrichment_status = 'complete';
  merged.last_verified = new Date().toISOString();

  // Calculate confidence
  let confidence = 0.5;
  if (merged.h_index) confidence += 0.1;
  if (merged.citations_total) confidence += 0.1;
  if (merged.research_areas) confidence += 0.1;
  if (publications_to_add.length > 0) confidence += 0.2;
  confidence = Math.min(confidence, 1.0);

  return {
    merged,
    publications_to_add,
    conflicts,
    confidence,
  };
}

/**
 * Run Step E3
 */
export async function runStepE3(input: StepE3Input): Promise<StepE3Output> {
  return mergeEnrichmentData(input);
}

export default runStepE3;
