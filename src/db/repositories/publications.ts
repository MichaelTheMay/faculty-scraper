/**
 * Publications Repository - CRUD operations for publications
 */

import { getDatabase } from '../connection.js';
import type { Publication } from '../../pipeline/types.js';

export interface PublicationRow {
  id: number;
  title: string;
  authors: string | null;
  venue: string | null;
  venue_type: string | null;
  year: number | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  citations: number;
  source: string | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPublication(row: PublicationRow): Publication {
  return {
    id: row.id,
    title: row.title,
    authors: row.authors ? JSON.parse(row.authors) : undefined,
    venue: row.venue || undefined,
    venue_type: row.venue_type as Publication['venue_type'],
    year: row.year || undefined,
    doi: row.doi || undefined,
    url: row.url || undefined,
    abstract: row.abstract || undefined,
    citations: row.citations,
    source: row.source || undefined,
    source_id: row.source_id || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class PublicationsRepository {
  private db = getDatabase();

  /**
   * Find publication by ID
   */
  findById(id: number): Publication | null {
    const row = this.db.prepare('SELECT * FROM publications WHERE id = ?').get(id) as PublicationRow | undefined;
    return row ? rowToPublication(row) : null;
  }

  /**
   * Find publication by title and year
   */
  findByTitleAndYear(title: string, year?: number): Publication | null {
    const normalizedTitle = title.toLowerCase().trim();

    let query = 'SELECT * FROM publications WHERE LOWER(title) = ?';
    const params: unknown[] = [normalizedTitle];

    if (year) {
      query += ' AND year = ?';
      params.push(year);
    }

    const row = this.db.prepare(query).get(...params) as PublicationRow | undefined;
    return row ? rowToPublication(row) : null;
  }

  /**
   * Find publication by DOI
   */
  findByDoi(doi: string): Publication | null {
    const row = this.db.prepare('SELECT * FROM publications WHERE doi = ?').get(doi) as PublicationRow | undefined;
    return row ? rowToPublication(row) : null;
  }

  /**
   * Create a new publication
   */
  create(data: Omit<Publication, 'id' | 'created_at' | 'updated_at'>): Publication {
    const stmt = this.db.prepare(`
      INSERT INTO publications (
        title, authors, venue, venue_type, year, doi, url, abstract, citations, source, source_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.title,
      data.authors ? JSON.stringify(data.authors) : null,
      data.venue || null,
      data.venue_type || null,
      data.year || null,
      data.doi || null,
      data.url || null,
      data.abstract || null,
      data.citations || 0,
      data.source || null,
      data.source_id || null
    );

    return this.findById(Number(result.lastInsertRowid))!;
  }

  /**
   * Update a publication
   */
  update(id: number, data: Partial<Omit<Publication, 'id' | 'created_at' | 'updated_at'>>): Publication | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push(data.title);
    }
    if (data.authors !== undefined) {
      fields.push('authors = ?');
      values.push(data.authors ? JSON.stringify(data.authors) : null);
    }
    if (data.venue !== undefined) {
      fields.push('venue = ?');
      values.push(data.venue);
    }
    if (data.venue_type !== undefined) {
      fields.push('venue_type = ?');
      values.push(data.venue_type);
    }
    if (data.year !== undefined) {
      fields.push('year = ?');
      values.push(data.year);
    }
    if (data.doi !== undefined) {
      fields.push('doi = ?');
      values.push(data.doi);
    }
    if (data.url !== undefined) {
      fields.push('url = ?');
      values.push(data.url);
    }
    if (data.abstract !== undefined) {
      fields.push('abstract = ?');
      values.push(data.abstract);
    }
    if (data.citations !== undefined) {
      fields.push('citations = ?');
      values.push(data.citations);
    }
    if (data.source !== undefined) {
      fields.push('source = ?');
      values.push(data.source);
    }
    if (data.source_id !== undefined) {
      fields.push('source_id = ?');
      values.push(data.source_id);
    }

    if (fields.length === 0) return existing;

    values.push(id);
    this.db.prepare(`UPDATE publications SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  }

  /**
   * Link publication to researcher
   */
  linkToResearcher(publicationId: number, researcherId: number, isPrimaryAuthor = false, authorPosition?: number): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO researcher_publications (researcher_id, publication_id, is_primary_author, author_position)
      VALUES (?, ?, ?, ?)
    `).run(researcherId, publicationId, isPrimaryAuthor ? 1 : 0, authorPosition || null);
  }

  /**
   * Get publications for a researcher
   */
  findByResearcher(researcherId: number, limit = 100): Publication[] {
    const rows = this.db.prepare(`
      SELECT p.* FROM publications p
      JOIN researcher_publications rp ON p.id = rp.publication_id
      WHERE rp.researcher_id = ?
      ORDER BY p.year DESC, p.citations DESC
      LIMIT ?
    `).all(researcherId, limit) as PublicationRow[];

    return rows.map(rowToPublication);
  }

  /**
   * Count publications for a researcher
   */
  countByResearcher(researcherId: number): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM researcher_publications WHERE researcher_id = ?
    `).get(researcherId) as { count: number };

    return result.count;
  }

  /**
   * Bulk create publications
   */
  bulkCreate(publications: Omit<Publication, 'id' | 'created_at' | 'updated_at'>[]): number[] {
    const insertStmt = this.db.prepare(`
      INSERT INTO publications (
        title, authors, venue, venue_type, year, doi, url, abstract, citations, source, source_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const ids: number[] = [];

    const insertMany = this.db.transaction((items: typeof publications) => {
      for (const data of items) {
        const result = insertStmt.run(
          data.title,
          data.authors ? JSON.stringify(data.authors) : null,
          data.venue || null,
          data.venue_type || null,
          data.year || null,
          data.doi || null,
          data.url || null,
          data.abstract || null,
          data.citations || 0,
          data.source || null,
          data.source_id || null
        );
        ids.push(Number(result.lastInsertRowid));
      }
    });

    insertMany(publications);
    return ids;
  }

  /**
   * Search publications
   */
  search(query: string, limit = 100): Publication[] {
    const searchTerm = `%${query}%`;
    const rows = this.db.prepare(`
      SELECT * FROM publications
      WHERE title LIKE ? OR venue LIKE ? OR authors LIKE ?
      ORDER BY year DESC, citations DESC
      LIMIT ?
    `).all(searchTerm, searchTerm, searchTerm, limit) as PublicationRow[];

    return rows.map(rowToPublication);
  }

  /**
   * Get or create publication (returns existing if found by DOI or title+year)
   */
  getOrCreate(data: Omit<Publication, 'id' | 'created_at' | 'updated_at'>): { publication: Publication; created: boolean } {
    // Try to find by DOI first
    if (data.doi) {
      const existing = this.findByDoi(data.doi);
      if (existing) return { publication: existing, created: false };
    }

    // Try to find by title and year
    if (data.year) {
      const existing = this.findByTitleAndYear(data.title, data.year);
      if (existing) return { publication: existing, created: false };
    }

    // Create new
    return { publication: this.create(data), created: true };
  }
}

export const publicationsRepository = new PublicationsRepository();
export default publicationsRepository;
