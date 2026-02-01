/**
 * Researchers Repository - CRUD operations for researchers
 */

import { getDatabase } from '../connection.js';
import type { Researcher, ParsedResearcher, SearchFilters } from '../../pipeline/types.js';

export interface ResearcherRow {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  university: string | null;
  department: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  office: string | null;
  website: string | null;
  photo_url: string | null;
  google_scholar_url: string | null;
  dblp_url: string | null;
  semantic_scholar_id: string | null;
  orcid: string | null;
  h_index: number | null;
  citations_total: number;
  publications_count: number;
  research_areas: string | null;
  bio: string | null;
  source_directory_id: number | null;
  enrichment_status: string;
  enrichment_error: string | null;
  last_verified: string | null;
  created_at: string;
  updated_at: string;
}

function rowToResearcher(row: ResearcherRow): Researcher {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: row.full_name,
    university: row.university || undefined,
    department: row.department || undefined,
    title: row.title || undefined,
    email: row.email || undefined,
    phone: row.phone || undefined,
    office: row.office || undefined,
    website: row.website || undefined,
    photo_url: row.photo_url || undefined,
    google_scholar_url: row.google_scholar_url || undefined,
    dblp_url: row.dblp_url || undefined,
    semantic_scholar_id: row.semantic_scholar_id || undefined,
    orcid: row.orcid || undefined,
    h_index: row.h_index || undefined,
    citations_total: row.citations_total,
    publications_count: row.publications_count,
    research_areas: row.research_areas ? JSON.parse(row.research_areas) : undefined,
    bio: row.bio || undefined,
    source_directory_id: row.source_directory_id || undefined,
    enrichment_status: row.enrichment_status as Researcher['enrichment_status'],
    enrichment_error: row.enrichment_error || undefined,
    last_verified: row.last_verified || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class ResearchersRepository {
  private db = getDatabase();

  /**
   * Find all researchers with optional pagination
   */
  findAll(limit = 100, offset = 0): Researcher[] {
    const rows = this.db.prepare(`
      SELECT * FROM researchers
      ORDER BY full_name
      LIMIT ? OFFSET ?
    `).all(limit, offset) as ResearcherRow[];

    return rows.map(rowToResearcher);
  }

  /**
   * Find researcher by ID
   */
  findById(id: number): Researcher | null {
    const row = this.db.prepare('SELECT * FROM researchers WHERE id = ?').get(id) as ResearcherRow | undefined;
    return row ? rowToResearcher(row) : null;
  }

  /**
   * Find researcher by email
   */
  findByEmail(email: string): Researcher | null {
    const row = this.db.prepare('SELECT * FROM researchers WHERE email = ?').get(email.toLowerCase()) as ResearcherRow | undefined;
    return row ? rowToResearcher(row) : null;
  }

  /**
   * Find researcher by name and university
   */
  findByNameAndUniversity(fullName: string, university: string, department?: string): Researcher | null {
    let query = 'SELECT * FROM researchers WHERE full_name = ? AND university = ?';
    const params: unknown[] = [fullName, university];

    if (department) {
      query += ' AND department = ?';
      params.push(department);
    }

    const row = this.db.prepare(query).get(...params) as ResearcherRow | undefined;
    return row ? rowToResearcher(row) : null;
  }

  /**
   * Create a new researcher
   */
  create(data: ParsedResearcher & { source_directory_id?: number }): Researcher {
    const stmt = this.db.prepare(`
      INSERT INTO researchers (
        first_name, last_name, full_name, university, department,
        title, email, phone, office, website, photo_url,
        research_areas, source_directory_id, enrichment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);

    const result = stmt.run(
      data.first_name,
      data.last_name,
      data.full_name,
      data.university || null,
      data.department || null,
      data.title || null,
      data.email?.toLowerCase() || null,
      data.phone || null,
      data.office || null,
      data.website || null,
      data.photo_url || null,
      data.research_areas ? JSON.stringify(data.research_areas) : null,
      data.source_directory_id || null
    );

    return this.findById(Number(result.lastInsertRowid))!;
  }

  /**
   * Update a researcher
   */
  update(id: number, data: Partial<Researcher>): Researcher | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    const stringFields = [
      'first_name', 'last_name', 'full_name', 'university', 'department',
      'title', 'email', 'phone', 'office', 'website', 'photo_url',
      'google_scholar_url', 'dblp_url', 'semantic_scholar_id', 'orcid',
      'bio', 'enrichment_status', 'enrichment_error', 'last_verified'
    ] as const;

    for (const field of stringFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(field === 'email' && data[field] ? (data[field] as string).toLowerCase() : data[field]);
      }
    }

    const numberFields = ['h_index', 'citations_total', 'publications_count', 'source_directory_id'] as const;
    for (const field of numberFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (data.research_areas !== undefined) {
      fields.push('research_areas = ?');
      values.push(data.research_areas ? JSON.stringify(data.research_areas) : null);
    }

    if (fields.length === 0) return existing;

    values.push(id);
    this.db.prepare(`UPDATE researchers SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  }

  /**
   * Delete a researcher
   */
  delete(id: number): boolean {
    const result = this.db.prepare('DELETE FROM researchers WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Search researchers with filters
   */
  search(query?: string, filters?: SearchFilters, limit = 100, offset = 0): Researcher[] {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (query) {
      conditions.push('(full_name LIKE ? OR email LIKE ? OR research_areas LIKE ?)');
      const searchTerm = `%${query}%`;
      values.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters?.university) {
      conditions.push('university = ?');
      values.push(filters.university);
    }

    if (filters?.department) {
      conditions.push('department = ?');
      values.push(filters.department);
    }

    if (filters?.title) {
      conditions.push('title LIKE ?');
      values.push(`%${filters.title}%`);
    }

    if (filters?.research_area) {
      conditions.push('research_areas LIKE ?');
      values.push(`%${filters.research_area}%`);
    }

    if (filters?.enrichment_status) {
      conditions.push('enrichment_status = ?');
      values.push(filters.enrichment_status);
    }

    if (filters?.min_h_index !== undefined) {
      conditions.push('h_index >= ?');
      values.push(filters.min_h_index);
    }

    if (filters?.min_citations !== undefined) {
      conditions.push('citations_total >= ?');
      values.push(filters.min_citations);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = this.db.prepare(`
      SELECT * FROM researchers
      ${whereClause}
      ORDER BY full_name
      LIMIT ? OFFSET ?
    `).all(...values, limit, offset) as ResearcherRow[];

    return rows.map(rowToResearcher);
  }

  /**
   * Count researchers with filters
   */
  count(filters?: SearchFilters): number {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters?.university) {
      conditions.push('university = ?');
      values.push(filters.university);
    }

    if (filters?.department) {
      conditions.push('department = ?');
      values.push(filters.department);
    }

    if (filters?.enrichment_status) {
      conditions.push('enrichment_status = ?');
      values.push(filters.enrichment_status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = this.db.prepare(`SELECT COUNT(*) as count FROM researchers ${whereClause}`).get(...values) as { count: number };
    return result.count;
  }

  /**
   * Get researchers pending enrichment
   */
  findPendingEnrichment(limit = 10): Researcher[] {
    const rows = this.db.prepare(`
      SELECT r.* FROM researchers r
      LEFT JOIN enrichment_queue eq ON r.id = eq.researcher_id
      WHERE r.enrichment_status = 'pending'
        AND (eq.id IS NULL OR eq.status = 'pending')
      ORDER BY r.created_at
      LIMIT ?
    `).all(limit) as ResearcherRow[];

    return rows.map(rowToResearcher);
  }

  /**
   * Bulk create researchers (within a transaction)
   */
  bulkCreate(researchers: (ParsedResearcher & { source_directory_id?: number })[]): number[] {
    const insertStmt = this.db.prepare(`
      INSERT INTO researchers (
        first_name, last_name, full_name, university, department,
        title, email, phone, office, website, photo_url,
        research_areas, source_directory_id, enrichment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);

    const ids: number[] = [];

    const insertMany = this.db.transaction((items: typeof researchers) => {
      for (const data of items) {
        const result = insertStmt.run(
          data.first_name,
          data.last_name,
          data.full_name,
          data.university || null,
          data.department || null,
          data.title || null,
          data.email?.toLowerCase() || null,
          data.phone || null,
          data.office || null,
          data.website || null,
          data.photo_url || null,
          data.research_areas ? JSON.stringify(data.research_areas) : null,
          data.source_directory_id || null
        );
        ids.push(Number(result.lastInsertRowid));
      }
    });

    insertMany(researchers);
    return ids;
  }

  /**
   * Get distinct universities
   */
  getUniversities(): string[] {
    const rows = this.db.prepare(`
      SELECT DISTINCT university FROM researchers
      WHERE university IS NOT NULL
      ORDER BY university
    `).all() as { university: string }[];

    return rows.map(r => r.university);
  }

  /**
   * Get distinct departments for a university
   */
  getDepartments(university?: string): string[] {
    let query = 'SELECT DISTINCT department FROM researchers WHERE department IS NOT NULL';
    const params: unknown[] = [];

    if (university) {
      query += ' AND university = ?';
      params.push(university);
    }

    query += ' ORDER BY department';

    const rows = this.db.prepare(query).all(...params) as { department: string }[];
    return rows.map(r => r.department);
  }
}

export const researchersRepository = new ResearchersRepository();
export default researchersRepository;
