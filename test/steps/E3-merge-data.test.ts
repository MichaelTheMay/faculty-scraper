/**
 * Tests for Step E3: Merge Enrichment Data
 */

import { describe, it, expect } from 'vitest';
import { mergeEnrichmentData } from '../../src/pipeline/steps/E3-merge-data.js';
import type { StepE3Input } from '../../src/pipeline/types.js';

describe('Step E3: Merge Enrichment Data', () => {
  describe('H-Index Merging', () => {
    it('should take higher h-index value', async () => {
      const input: StepE3Input = {
        existing: {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          full_name: 'John Doe',
          h_index: 25,
        },
        enriched: {
          h_index: 28,
        },
      };

      const result = await mergeEnrichmentData(input);

      expect(result.merged.h_index).toBe(28);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].field).toBe('h_index');
      expect(result.conflicts[0].resolution).toBe('use_new');
    });

    it('should keep existing if higher', async () => {
      const input: StepE3Input = {
        existing: {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          full_name: 'John Doe',
          h_index: 30,
        },
        enriched: {
          h_index: 25,
        },
      };

      const result = await mergeEnrichmentData(input);

      expect(result.merged.h_index).toBeUndefined();
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolution).toBe('keep_existing');
    });

    it('should add new h-index if none exists', async () => {
      const input: StepE3Input = {
        existing: {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          full_name: 'John Doe',
        },
        enriched: {
          h_index: 20,
        },
      };

      const result = await mergeEnrichmentData(input);

      expect(result.merged.h_index).toBe(20);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('Citations Merging', () => {
    it('should take higher citation count', async () => {
      const input: StepE3Input = {
        existing: {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          full_name: 'John Doe',
          citations_total: 5000,
        },
        enriched: {
          citations_total: 6000,
        },
      };

      const result = await mergeEnrichmentData(input);

      expect(result.merged.citations_total).toBe(6000);
    });
  });

  describe('Research Areas Merging', () => {
    it('should merge and dedupe research areas', async () => {
      const input: StepE3Input = {
        existing: {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          full_name: 'John Doe',
          research_areas: ['Machine Learning', 'AI'],
        },
        enriched: {
          research_areas: ['Deep Learning', 'AI', 'Neural Networks'],
        },
      };

      const result = await mergeEnrichmentData(input);

      expect(result.merged.research_areas).toContain('Machine Learning');
      expect(result.merged.research_areas).toContain('AI');
      expect(result.merged.research_areas).toContain('Deep Learning');
      expect(result.merged.research_areas).toContain('Neural Networks');
      // AI should not be duplicated
      expect(result.merged.research_areas?.filter((a) => a === 'AI')).toHaveLength(1);
    });

    it('should record merge conflict for research areas', async () => {
      const input: StepE3Input = {
        existing: {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          full_name: 'John Doe',
          research_areas: ['ML'],
        },
        enriched: {
          research_areas: ['NLP'],
        },
      };

      const result = await mergeEnrichmentData(input);

      const conflict = result.conflicts.find((c) => c.field === 'research_areas');
      expect(conflict).toBeDefined();
      expect(conflict?.resolution).toBe('merge');
    });
  });

  describe('Bio Merging', () => {
    it('should add bio if missing', async () => {
      const input: StepE3Input = {
        existing: {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          full_name: 'John Doe',
        },
        enriched: {
          bio: 'A leading researcher in AI.',
        },
      };

      const result = await mergeEnrichmentData(input);

      expect(result.merged.bio).toBe('A leading researcher in AI.');
    });

    it('should not overwrite existing bio', async () => {
      const input: StepE3Input = {
        existing: {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          full_name: 'John Doe',
          bio: 'Original bio',
        },
        enriched: {
          bio: 'New bio',
        },
      };

      const result = await mergeEnrichmentData(input);

      expect(result.merged.bio).toBeUndefined();
    });
  });

  describe('URL Merging', () => {
    it('should add URLs if missing', async () => {
      const input: StepE3Input = {
        existing: {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          full_name: 'John Doe',
        },
        enriched: {
          google_scholar_url: 'https://scholar.google.com/user123',
          dblp_url: 'https://dblp.org/user123',
          semantic_scholar_id: 'abc123',
          orcid: '0000-0001-2345-6789',
        },
      };

      const result = await mergeEnrichmentData(input);

      expect(result.merged.google_scholar_url).toBe('https://scholar.google.com/user123');
      expect(result.merged.dblp_url).toBe('https://dblp.org/user123');
      expect(result.merged.semantic_scholar_id).toBe('abc123');
      expect(result.merged.orcid).toBe('0000-0001-2345-6789');
    });

    it('should not overwrite existing URLs', async () => {
      const input: StepE3Input = {
        existing: {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          full_name: 'John Doe',
          google_scholar_url: 'https://scholar.google.com/existing',
        },
        enriched: {
          google_scholar_url: 'https://scholar.google.com/new',
        },
      };

      const result = await mergeEnrichmentData(input);

      expect(result.merged.google_scholar_url).toBeUndefined();
    });
  });

  describe('Publications', () => {
    it('should collect publications to add', async () => {
      const input: StepE3Input = {
        existing: {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          full_name: 'John Doe',
        },
        enriched: {
          publications: [
            {
              title: 'Paper 1',
              authors: ['John Doe'],
              venue: 'NeurIPS',
              venue_type: 'conference',
              year: 2023,
              citations: 100,
              source: 'dblp',
            },
            {
              title: 'Paper 2',
              authors: ['John Doe', 'Jane Smith'],
              venue: 'ICML',
              venue_type: 'conference',
              year: 2022,
              source: 'semantic_scholar',
            },
          ],
        },
      };

      const result = await mergeEnrichmentData(input);

      expect(result.publications_to_add).toHaveLength(2);
      expect(result.publications_to_add[0].title).toBe('Paper 1');
      expect(result.publications_to_add[1].title).toBe('Paper 2');
    });
  });

  describe('Confidence Score', () => {
    it('should calculate confidence based on enriched data', async () => {
      const input: StepE3Input = {
        existing: {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          full_name: 'John Doe',
        },
        enriched: {
          h_index: 25,
          citations_total: 5000,
          research_areas: ['ML'],
          publications: [{ title: 'Paper', source: 'dblp', authors: [] }],
        },
      };

      const result = await mergeEnrichmentData(input);

      // Base 0.5 + various enrichment bonuses
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should have lower confidence with less data', async () => {
      const input: StepE3Input = {
        existing: {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          full_name: 'John Doe',
        },
        enriched: {},
      };

      const result = await mergeEnrichmentData(input);

      expect(result.confidence).toBe(0.5);
    });
  });

  describe('Enrichment Status', () => {
    it('should set enrichment status to complete', async () => {
      const input: StepE3Input = {
        existing: {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          full_name: 'John Doe',
        },
        enriched: {},
      };

      const result = await mergeEnrichmentData(input);

      expect(result.merged.enrichment_status).toBe('complete');
      expect(result.merged.last_verified).toBeDefined();
    });
  });
});
