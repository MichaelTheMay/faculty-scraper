/**
 * Enrichment Queue Repository - Manage pending enrichment tasks
 */

import { getDatabase } from '../connection.js';

export interface EnrichmentQueueRow {
  id: number;
  researcher_id: number;
  priority: number;
  attempts: number;
  last_attempt: string | null;
  next_attempt: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueueItem {
  id: number;
  researcher_id: number;
  priority: number;
  attempts: number;
  last_attempt?: string;
  next_attempt?: string;
  status: 'pending' | 'in_progress' | 'complete' | 'failed' | 'skipped';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

function rowToQueueItem(row: EnrichmentQueueRow): QueueItem {
  return {
    id: row.id,
    researcher_id: row.researcher_id,
    priority: row.priority,
    attempts: row.attempts,
    last_attempt: row.last_attempt || undefined,
    next_attempt: row.next_attempt || undefined,
    status: row.status as QueueItem['status'],
    error_message: row.error_message || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class EnrichmentQueueRepository {
  private db = getDatabase();

  /**
   * Add a researcher to the enrichment queue
   */
  add(researcherId: number, priority = 5): QueueItem | null {
    try {
      this.db.prepare(`
        INSERT INTO enrichment_queue (researcher_id, priority, status)
        VALUES (?, ?, 'pending')
      `).run(researcherId, priority);

      return this.findByResearcher(researcherId);
    } catch {
      // Already exists (unique constraint)
      return this.findByResearcher(researcherId);
    }
  }

  /**
   * Bulk add researchers to queue
   */
  addBulk(researcherIds: number[], priority = 5): number {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO enrichment_queue (researcher_id, priority, status)
      VALUES (?, ?, 'pending')
    `);

    let added = 0;
    const insertMany = this.db.transaction((ids: number[]) => {
      for (const id of ids) {
        const result = stmt.run(id, priority);
        if (result.changes > 0) added++;
      }
    });

    insertMany(researcherIds);
    return added;
  }

  /**
   * Find queue item by researcher ID
   */
  findByResearcher(researcherId: number): QueueItem | null {
    const row = this.db.prepare(`
      SELECT * FROM enrichment_queue WHERE researcher_id = ?
    `).get(researcherId) as EnrichmentQueueRow | undefined;

    return row ? rowToQueueItem(row) : null;
  }

  /**
   * Get pending items
   */
  findPending(limit = 10): QueueItem[] {
    const rows = this.db.prepare(`
      SELECT * FROM enrichment_queue
      WHERE status = 'pending'
        AND (next_attempt IS NULL OR next_attempt <= datetime('now'))
      ORDER BY priority ASC, created_at ASC
      LIMIT ?
    `).all(limit) as EnrichmentQueueRow[];

    return rows.map(rowToQueueItem);
  }

  /**
   * Update status
   */
  updateStatus(researcherId: number, status: QueueItem['status'], errorMessage?: string): void {
    this.db.prepare(`
      UPDATE enrichment_queue
      SET status = ?, error_message = ?, last_attempt = datetime('now')
      WHERE researcher_id = ?
    `).run(status, errorMessage || null, researcherId);
  }

  /**
   * Mark as in progress
   */
  markInProgress(researcherId: number): void {
    this.db.prepare(`
      UPDATE enrichment_queue
      SET status = 'in_progress', last_attempt = datetime('now')
      WHERE researcher_id = ?
    `).run(researcherId);
  }

  /**
   * Increment attempts and schedule retry
   */
  incrementAttempts(researcherId: number, retryDelayMinutes = 60): void {
    this.db.prepare(`
      UPDATE enrichment_queue
      SET attempts = attempts + 1,
          last_attempt = datetime('now'),
          next_attempt = datetime('now', '+' || ? || ' minutes'),
          status = 'pending'
      WHERE researcher_id = ?
    `).run(retryDelayMinutes, researcherId);
  }

  /**
   * Get queue position
   */
  getPosition(researcherId: number): number | null {
    const result = this.db.prepare(`
      SELECT COUNT(*) + 1 as position
      FROM enrichment_queue
      WHERE status = 'pending'
        AND (priority < (SELECT priority FROM enrichment_queue WHERE researcher_id = ?)
             OR (priority = (SELECT priority FROM enrichment_queue WHERE researcher_id = ?)
                 AND created_at < (SELECT created_at FROM enrichment_queue WHERE researcher_id = ?)))
    `).get(researcherId, researcherId, researcherId) as { position: number } | undefined;

    return result?.position || null;
  }

  /**
   * Remove completed items
   */
  removeCompleted(): number {
    const result = this.db.prepare(`
      DELETE FROM enrichment_queue WHERE status = 'complete'
    `).run();

    return result.changes;
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    pending: number;
    in_progress: number;
    complete: number;
    failed: number;
    total: number;
  } {
    const rows = this.db.prepare(`
      SELECT status, COUNT(*) as count
      FROM enrichment_queue
      GROUP BY status
    `).all() as { status: string; count: number }[];

    const stats = {
      pending: 0,
      in_progress: 0,
      complete: 0,
      failed: 0,
      total: 0,
    };

    for (const row of rows) {
      const status = row.status as keyof typeof stats;
      if (status in stats) {
        stats[status] = row.count;
      }
      stats.total += row.count;
    }

    return stats;
  }

  /**
   * Reset stuck items (in_progress for too long)
   */
  resetStuck(timeoutMinutes = 60): number {
    const result = this.db.prepare(`
      UPDATE enrichment_queue
      SET status = 'pending'
      WHERE status = 'in_progress'
        AND last_attempt < datetime('now', '-' || ? || ' minutes')
    `).run(timeoutMinutes);

    return result.changes;
  }

  /**
   * Clear all items (for testing)
   */
  clear(): void {
    this.db.prepare('DELETE FROM enrichment_queue').run();
  }
}

export const enrichmentQueueRepository = new EnrichmentQueueRepository();
export default enrichmentQueueRepository;
