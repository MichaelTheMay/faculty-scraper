/**
 * Directories Repository - CRUD operations for faculty directories
 */

import { getDatabase } from '../connection.js';
import type { Directory, ScrapeConfig } from '../../pipeline/types.js';

export interface DirectoryRow {
  id: number;
  university: string;
  department: string;
  directory_url: string;
  profile_url_pattern: string | null;
  scrape_method: string;
  scrape_config: string | null;
  is_active: number;
  last_scraped: string | null;
  records_last_scrape: number;
  created_at: string;
  updated_at: string;
}

function rowToDirectory(row: DirectoryRow): Directory {
  return {
    id: row.id,
    university: row.university,
    department: row.department,
    directory_url: row.directory_url,
    profile_url_pattern: row.profile_url_pattern || undefined,
    scrape_method: row.scrape_method as Directory['scrape_method'],
    scrape_config: row.scrape_config ? JSON.parse(row.scrape_config) : undefined,
    is_active: Boolean(row.is_active),
    last_scraped: row.last_scraped || undefined,
    records_last_scrape: row.records_last_scrape,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class DirectoriesRepository {
  private db = getDatabase();

  /**
   * Get all directories
   */
  findAll(activeOnly = false): Directory[] {
    const query = activeOnly
      ? 'SELECT * FROM directories WHERE is_active = 1 ORDER BY university, department'
      : 'SELECT * FROM directories ORDER BY university, department';

    const rows = this.db.prepare(query).all() as DirectoryRow[];
    return rows.map(rowToDirectory);
  }

  /**
   * Get directory by ID
   */
  findById(id: number): Directory | null {
    const row = this.db.prepare('SELECT * FROM directories WHERE id = ?').get(id) as DirectoryRow | undefined;
    return row ? rowToDirectory(row) : null;
  }

  /**
   * Get directory by URL
   */
  findByUrl(url: string): Directory | null {
    const row = this.db.prepare('SELECT * FROM directories WHERE directory_url = ?').get(url) as DirectoryRow | undefined;
    return row ? rowToDirectory(row) : null;
  }

  /**
   * Create a new directory
   */
  create(data: {
    university: string;
    department: string;
    directory_url: string;
    profile_url_pattern?: string;
    scrape_method?: Directory['scrape_method'];
    scrape_config?: ScrapeConfig;
    is_active?: boolean;
  }): Directory {
    const stmt = this.db.prepare(`
      INSERT INTO directories (university, department, directory_url, profile_url_pattern, scrape_method, scrape_config, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.university,
      data.department,
      data.directory_url,
      data.profile_url_pattern || null,
      data.scrape_method || 'firecrawl',
      data.scrape_config ? JSON.stringify(data.scrape_config) : null,
      data.is_active !== false ? 1 : 0
    );

    return this.findById(Number(result.lastInsertRowid))!;
  }

  /**
   * Update a directory
   */
  update(id: number, data: Partial<{
    university: string;
    department: string;
    directory_url: string;
    profile_url_pattern: string | null;
    scrape_method: Directory['scrape_method'];
    scrape_config: ScrapeConfig | null;
    is_active: boolean;
    last_scraped: string;
    records_last_scrape: number;
  }>): Directory | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.university !== undefined) {
      fields.push('university = ?');
      values.push(data.university);
    }
    if (data.department !== undefined) {
      fields.push('department = ?');
      values.push(data.department);
    }
    if (data.directory_url !== undefined) {
      fields.push('directory_url = ?');
      values.push(data.directory_url);
    }
    if (data.profile_url_pattern !== undefined) {
      fields.push('profile_url_pattern = ?');
      values.push(data.profile_url_pattern);
    }
    if (data.scrape_method !== undefined) {
      fields.push('scrape_method = ?');
      values.push(data.scrape_method);
    }
    if (data.scrape_config !== undefined) {
      fields.push('scrape_config = ?');
      values.push(data.scrape_config ? JSON.stringify(data.scrape_config) : null);
    }
    if (data.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }
    if (data.last_scraped !== undefined) {
      fields.push('last_scraped = ?');
      values.push(data.last_scraped);
    }
    if (data.records_last_scrape !== undefined) {
      fields.push('records_last_scrape = ?');
      values.push(data.records_last_scrape);
    }

    if (fields.length === 0) return existing;

    values.push(id);
    this.db.prepare(`UPDATE directories SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  }

  /**
   * Delete a directory
   */
  delete(id: number): boolean {
    const result = this.db.prepare('DELETE FROM directories WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Update last scraped timestamp
   */
  updateLastScraped(id: number, recordsCount: number): void {
    this.db.prepare(`
      UPDATE directories
      SET last_scraped = datetime('now'), records_last_scrape = ?
      WHERE id = ?
    `).run(recordsCount, id);
  }

  /**
   * Search directories
   */
  search(query: string): Directory[] {
    const searchTerm = `%${query}%`;
    const rows = this.db.prepare(`
      SELECT * FROM directories
      WHERE university LIKE ? OR department LIKE ? OR directory_url LIKE ?
      ORDER BY university, department
    `).all(searchTerm, searchTerm, searchTerm) as DirectoryRow[];

    return rows.map(rowToDirectory);
  }
}

export const directoriesRepository = new DirectoriesRepository();
export default directoriesRepository;
