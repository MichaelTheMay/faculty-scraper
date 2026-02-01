/**
 * Step E4: Persist Enriched Data
 *
 * Save enriched researcher data and publications to database.
 */

import type { StepE4Input, StepE4Output, Researcher } from '../types.js';
import researchersRepository from '../../db/repositories/researchers.js';
import publicationsRepository from '../../db/repositories/publications.js';
import enrichmentQueueRepository from '../../db/repositories/enrichment-queue.js';

/**
 * Persist enriched data to database
 */
export async function persistEnrichedData(input: StepE4Input): Promise<StepE4Output> {
  const { researcher_id, merged_data, publications = [] } = input;

  let publications_added = 0;
  let publications_updated = 0;
  let error: string | undefined;

  try {
    // Build update data matching Partial<Researcher>
    const updateData: Partial<Researcher> = {};

    if (merged_data.h_index !== undefined) updateData.h_index = merged_data.h_index;
    if (merged_data.citations_total !== undefined)
      updateData.citations_total = merged_data.citations_total;
    if (merged_data.research_areas !== undefined)
      updateData.research_areas = merged_data.research_areas;
    if (merged_data.bio !== undefined) updateData.bio = merged_data.bio;
    if (merged_data.google_scholar_url !== undefined)
      updateData.google_scholar_url = merged_data.google_scholar_url;
    if (merged_data.dblp_url !== undefined) updateData.dblp_url = merged_data.dblp_url;
    if (merged_data.semantic_scholar_id !== undefined)
      updateData.semantic_scholar_id = merged_data.semantic_scholar_id;
    if (merged_data.orcid !== undefined) updateData.orcid = merged_data.orcid;
    if (merged_data.enrichment_status !== undefined)
      updateData.enrichment_status = merged_data.enrichment_status;
    if (merged_data.last_verified !== undefined)
      updateData.last_verified = merged_data.last_verified;

    // Update researcher with enriched data
    researchersRepository.update(researcher_id, updateData);

    // Add publications
    for (const pub of publications) {
      try {
        const created = publicationsRepository.create({
          title: pub.title,
          authors: pub.authors,
          venue: pub.venue,
          venue_type: pub.venue_type,
          year: pub.year,
          doi: pub.doi,
          url: pub.url,
          abstract: pub.abstract,
          citations: pub.citations ?? 0,
          source: pub.source,
          source_id: pub.source_id,
        });

        // Link to researcher
        publicationsRepository.linkToResearcher(created.id, researcher_id);
        publications_added++;
      } catch {
        // Publication may already exist, count as updated
        publications_updated++;
      }
    }

    // Update enrichment queue status
    enrichmentQueueRepository.updateStatus(researcher_id, 'complete');

    return {
      success: true,
      publications_added,
      publications_updated,
      enrichment_status: 'complete',
    };
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);

    // Mark as failed in queue
    enrichmentQueueRepository.updateStatus(researcher_id, 'failed', error);

    return {
      success: false,
      publications_added,
      publications_updated,
      enrichment_status: 'failed',
      error,
    };
  }
}

/**
 * Run Step E4
 */
export async function runStepE4(input: StepE4Input): Promise<StepE4Output> {
  return persistEnrichedData(input);
}

export default runStepE4;
