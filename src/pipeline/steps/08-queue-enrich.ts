/**
 * Step 8: Queue for Enrichment
 *
 * Add newly created/updated researchers to the enrichment queue.
 */

import type { Step8Input, Step8Output } from '../types.js';
import { enrichmentQueueRepository } from '../../db/repositories/enrichment-queue.js';

/**
 * Queue researchers for enrichment
 */
export async function queueForEnrichment(input: Step8Input): Promise<Step8Output> {
  const priority = input.priority ?? 5;
  const queuePositions: { researcher_id: number; position: number }[] = [];
  let alreadyQueued = 0;

  for (const researcherId of input.researcher_ids) {
    // Check if already in queue
    const existing = enrichmentQueueRepository.findByResearcher(researcherId);

    if (existing) {
      alreadyQueued++;
      // Get current position
      const position = enrichmentQueueRepository.getPosition(researcherId);
      if (position) {
        queuePositions.push({ researcher_id: researcherId, position });
      }
    } else {
      // Add to queue
      enrichmentQueueRepository.add(researcherId, priority);

      // Get position
      const position = enrichmentQueueRepository.getPosition(researcherId);
      if (position) {
        queuePositions.push({ researcher_id: researcherId, position });
      }
    }
  }

  const queuedCount = input.researcher_ids.length - alreadyQueued;

  return {
    queued_count: queuedCount,
    already_queued: alreadyQueued,
    queue_positions: queuePositions,
  };
}

/**
 * Run Step 8
 */
export async function runStep8(input: Step8Input): Promise<Step8Output> {
  return queueForEnrichment(input);
}

export default runStep8;
