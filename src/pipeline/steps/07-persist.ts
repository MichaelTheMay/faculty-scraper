/**
 * Step 7: Persist to Database
 *
 * Insert new researchers and update existing ones in the database.
 */

import type { Step7Input, Step7Output, ParsedResearcher } from '../types.js';
import { researchersRepository } from '../../db/repositories/researchers.js';
import { jobsRepository } from '../../db/repositories/jobs.js';
import { getDatabase } from '../../db/connection.js';

/**
 * Persist researchers to the database
 */
export async function persist(input: Step7Input): Promise<Step7Output> {
  const db = getDatabase();
  const insertedIds: number[] = [];
  const updatedIds: number[] = [];
  let skipped = 0;

  // Use a transaction for atomicity
  const transaction = db.transaction(() => {
    // Insert new researchers
    for (const researcher of input.to_insert) {
      try {
        const created = researchersRepository.create({
          ...researcher,
          source_directory_id: input.directory_id,
        });
        insertedIds.push(created.id);
      } catch (error) {
        // Log error but continue with others
        console.error(`Failed to insert researcher ${researcher.full_name}:`, error);
        skipped++;
      }
    }

    // Update existing researchers
    for (const { researcher, existing_id } of input.to_update) {
      try {
        const updateData = buildUpdateData(researcher);
        const updated = researchersRepository.update(existing_id, updateData);
        if (updated) {
          updatedIds.push(existing_id);
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`Failed to update researcher ${researcher.full_name}:`, error);
        skipped++;
      }
    }
  });

  try {
    transaction();

    // Update job statistics
    jobsRepository.updateStats(input.job_id, {
      records_found: input.to_insert.length + input.to_update.length,
      records_created: insertedIds.length,
      records_updated: updatedIds.length,
      records_skipped: skipped,
    });
  } catch (error) {
    // Transaction failed - update job with error
    jobsRepository.updateStatus(
      input.job_id,
      'failed',
      error instanceof Error ? error.message : 'Database transaction failed'
    );
    throw error;
  }

  return {
    inserted_ids: insertedIds,
    updated_ids: updatedIds,
    job_stats: {
      records_created: insertedIds.length,
      records_updated: updatedIds.length,
      records_skipped: skipped,
    },
  };
}

/**
 * Build update data from parsed researcher
 */
function buildUpdateData(researcher: ParsedResearcher): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  // Only include fields that have values
  if (researcher.title) updateData.title = researcher.title;
  if (researcher.email) updateData.email = researcher.email;
  if (researcher.phone) updateData.phone = researcher.phone;
  if (researcher.office) updateData.office = researcher.office;
  if (researcher.website) updateData.website = researcher.website;
  if (researcher.photo_url) updateData.photo_url = researcher.photo_url;
  if (researcher.research_areas && researcher.research_areas.length > 0) {
    updateData.research_areas = researcher.research_areas;
  }

  // Update last verified timestamp
  updateData.last_verified = new Date().toISOString();

  return updateData;
}

/**
 * Run Step 7
 */
export async function runStep7(input: Step7Input): Promise<Step7Output> {
  return persist(input);
}

export default runStep7;
