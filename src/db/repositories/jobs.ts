/**
 * Jobs Repository - CRUD operations for scrape jobs and logs
 */

import { getDatabase } from '../connection.js';
import type { ScrapeJob, JobStatus } from '../../pipeline/types.js';
import { v4 as uuidv4 } from 'uuid';

export interface JobRow {
  id: number;
  job_id: string;
  directory_id: number;
  scrape_type: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  status: string;
  current_step: string | null;
  records_found: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  error_message: string | null;
  debug_path: string | null;
  created_at: string;
}

function rowToJob(row: JobRow): ScrapeJob {
  return {
    id: row.id,
    job_id: row.job_id,
    directory_id: row.directory_id,
    scrape_type: row.scrape_type as ScrapeJob['scrape_type'],
    started_at: row.started_at,
    completed_at: row.completed_at || undefined,
    duration_seconds: row.duration_seconds || undefined,
    status: row.status as ScrapeJob['status'],
    current_step: row.current_step || undefined,
    records_found: row.records_found,
    records_created: row.records_created,
    records_updated: row.records_updated,
    records_skipped: row.records_skipped,
    error_message: row.error_message || undefined,
    debug_path: row.debug_path || undefined,
    created_at: row.created_at,
  };
}

export class JobsRepository {
  private db = getDatabase();

  /**
   * Create a new scrape job
   */
  create(data: {
    directory_id: number;
    scrape_type?: ScrapeJob['scrape_type'];
    debug_path?: string;
  }): ScrapeJob {
    const jobId = uuidv4();

    this.db.prepare(`
      INSERT INTO scrape_jobs (job_id, directory_id, scrape_type, status, debug_path)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(jobId, data.directory_id, data.scrape_type || 'full', data.debug_path || null);

    return this.findByJobId(jobId)!;
  }

  /**
   * Find job by job_id
   */
  findByJobId(jobId: string): ScrapeJob | null {
    const row = this.db.prepare('SELECT * FROM scrape_jobs WHERE job_id = ?').get(jobId) as JobRow | undefined;
    return row ? rowToJob(row) : null;
  }

  /**
   * Find jobs by directory
   */
  findByDirectory(directoryId: number, limit = 10): ScrapeJob[] {
    const rows = this.db.prepare(`
      SELECT * FROM scrape_jobs
      WHERE directory_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `).all(directoryId, limit) as JobRow[];

    return rows.map(rowToJob);
  }

  /**
   * Get recent jobs
   */
  findRecent(limit = 20): ScrapeJob[] {
    const rows = this.db.prepare(`
      SELECT * FROM scrape_jobs
      ORDER BY started_at DESC
      LIMIT ?
    `).all(limit) as JobRow[];

    return rows.map(rowToJob);
  }

  /**
   * Update job status
   */
  updateStatus(jobId: string, status: ScrapeJob['status'], errorMessage?: string): void {
    if (status === 'success' || status === 'failed' || status === 'cancelled') {
      this.db.prepare(`
        UPDATE scrape_jobs
        SET status = ?,
            completed_at = datetime('now'),
            duration_seconds = CAST((julianday(datetime('now')) - julianday(started_at)) * 86400 AS INTEGER),
            error_message = ?
        WHERE job_id = ?
      `).run(status, errorMessage || null, jobId);
    } else {
      this.db.prepare(`
        UPDATE scrape_jobs
        SET status = ?, error_message = ?
        WHERE job_id = ?
      `).run(status, errorMessage || null, jobId);
    }
  }

  /**
   * Update current step
   */
  updateCurrentStep(jobId: string, step: string): void {
    this.db.prepare('UPDATE scrape_jobs SET current_step = ? WHERE job_id = ?').run(step, jobId);
  }

  /**
   * Update job statistics
   */
  updateStats(jobId: string, stats: {
    records_found?: number;
    records_created?: number;
    records_updated?: number;
    records_skipped?: number;
  }): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (stats.records_found !== undefined) {
      fields.push('records_found = ?');
      values.push(stats.records_found);
    }
    if (stats.records_created !== undefined) {
      fields.push('records_created = ?');
      values.push(stats.records_created);
    }
    if (stats.records_updated !== undefined) {
      fields.push('records_updated = ?');
      values.push(stats.records_updated);
    }
    if (stats.records_skipped !== undefined) {
      fields.push('records_skipped = ?');
      values.push(stats.records_skipped);
    }

    if (fields.length === 0) return;

    values.push(jobId);
    this.db.prepare(`UPDATE scrape_jobs SET ${fields.join(', ')} WHERE job_id = ?`).run(...values);
  }

  /**
   * Get job status (for MCP tool)
   */
  getStatus(jobId: string): JobStatus | null {
    const job = this.findByJobId(jobId);
    if (!job) return null;

    return {
      job_id: job.job_id,
      status: job.status,
      current_step: job.current_step,
      started_at: job.started_at,
      duration_seconds: job.duration_seconds,
      records_found: job.records_found,
      error_message: job.error_message,
    };
  }

  /**
   * Add a log entry
   */
  addLog(jobId: string, step: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
    this.db.prepare(`
      INSERT INTO scrape_logs (job_id, step, level, message, data)
      VALUES (?, ?, ?, ?, ?)
    `).run(jobId, step, level, message, data ? JSON.stringify(data) : null);
  }

  /**
   * Get logs for a job
   */
  getLogs(jobId: string, level?: 'debug' | 'info' | 'warn' | 'error'): Array<{
    id: number;
    step: string;
    level: string;
    message: string;
    data: Record<string, unknown> | null;
    created_at: string;
  }> {
    let query = 'SELECT * FROM scrape_logs WHERE job_id = ?';
    const params: unknown[] = [jobId];

    if (level) {
      query += ' AND level = ?';
      params.push(level);
    }

    query += ' ORDER BY created_at ASC';

    const rows = this.db.prepare(query).all(...params) as Array<{
      id: number;
      step: string;
      level: string;
      message: string;
      data: string | null;
      created_at: string;
    }>;

    return rows.map(row => ({
      ...row,
      data: row.data ? JSON.parse(row.data) : null,
    }));
  }

  /**
   * Store step output for debugging
   */
  storeStepOutput(jobId: string, stepName: string, input: unknown, output: unknown, durationMs: number, success: boolean, errorMessage?: string): void {
    this.db.prepare(`
      INSERT INTO step_outputs (job_id, step_name, input_data, output_data, duration_ms, success, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      jobId,
      stepName,
      JSON.stringify(input),
      JSON.stringify(output),
      durationMs,
      success ? 1 : 0,
      errorMessage || null
    );
  }

  /**
   * Get step output for replay
   */
  getStepOutput(jobId: string, stepName: string): { input: unknown; output: unknown } | null {
    const row = this.db.prepare(`
      SELECT input_data, output_data FROM step_outputs
      WHERE job_id = ? AND step_name = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(jobId, stepName) as { input_data: string; output_data: string } | undefined;

    if (!row) return null;

    return {
      input: JSON.parse(row.input_data),
      output: JSON.parse(row.output_data),
    };
  }

  /**
   * Get running jobs
   */
  findRunning(): ScrapeJob[] {
    const rows = this.db.prepare(`
      SELECT * FROM scrape_jobs
      WHERE status = 'running'
      ORDER BY started_at ASC
    `).all() as JobRow[];

    return rows.map(rowToJob);
  }

  /**
   * Cancel stale jobs (older than timeout)
   */
  cancelStaleJobs(timeoutMinutes = 60): number {
    const result = this.db.prepare(`
      UPDATE scrape_jobs
      SET status = 'cancelled',
          completed_at = datetime('now'),
          error_message = 'Job timed out'
      WHERE status = 'running'
        AND started_at < datetime('now', '-' || ? || ' minutes')
    `).run(timeoutMinutes);

    return result.changes;
  }
}

export const jobsRepository = new JobsRepository();
export default jobsRepository;
