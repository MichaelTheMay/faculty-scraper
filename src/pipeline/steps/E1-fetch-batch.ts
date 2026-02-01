/**
 * Step E1: Fetch Enrichment Batch
 *
 * Get a batch of researchers that need enrichment from the queue.
 */

import type { StepE1Input, StepE1Output, ResearcherToEnrich } from '../types.js';
import enrichmentQueueRepository from '../../db/repositories/enrichment-queue.js';
import researchersRepository from '../../db/repositories/researchers.js';

/**
 * Fetch a batch of researchers for enrichment
 */
export async function fetchEnrichmentBatch(input: StepE1Input): Promise<StepE1Output> {
  const { batch_size } = input;

  // Get pending items from queue
  const queueItems = enrichmentQueueRepository.findPending(batch_size);

  // Build researchers to enrich list
  const researchers: ResearcherToEnrich[] = [];

  for (const item of queueItems) {
    const researcher = researchersRepository.findById(item.researcher_id);
    if (!researcher) continue;

    // Mark as in progress
    enrichmentQueueRepository.markInProgress(item.researcher_id);

    researchers.push({
      id: researcher.id,
      full_name: researcher.full_name,
      email: researcher.email || undefined,
      website: researcher.website || undefined,
      university: researcher.university || undefined,
      department: researcher.department || undefined,
    });
  }

  // Get total pending count
  const stats = enrichmentQueueRepository.getStats();

  return {
    researchers,
    total_pending: stats.pending,
  };
}

/**
 * Run Step E1
 */
export async function runStepE1(input: StepE1Input): Promise<StepE1Output> {
  return fetchEnrichmentBatch(input);
}

export default runStepE1;
