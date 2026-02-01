/**
 * Tests for Step 5: Parse and Normalize
 */

import { describe, it, expect } from 'vitest';
import { parseAndNormalize } from '../../src/pipeline/steps/05-parse-normalize.js';
import type { Step5Input, RawCard } from '../../src/pipeline/types.js';

describe('Step 5: Parse and Normalize', () => {
  describe('Name Parsing', () => {
    it('should parse simple first last name', async () => {
      const input: Step5Input = {
        raw_cards: [
          { index: 0, outer_html: '', name_text: 'John Doe', title_text: 'Professor' },
        ],
      };

      const result = await parseAndNormalize(input);

      expect(result.researchers).toHaveLength(1);
      expect(result.researchers[0].first_name).toBe('John');
      expect(result.researchers[0].last_name).toBe('Doe');
      expect(result.researchers[0].full_name).toBe('John Doe');
    });

    it('should handle names with titles like Dr.', async () => {
      const input: Step5Input = {
        raw_cards: [
          { index: 0, outer_html: '', name_text: 'Dr. Jane Smith', title_text: 'Associate Professor' },
        ],
      };

      const result = await parseAndNormalize(input);

      expect(result.researchers).toHaveLength(1);
      expect(result.researchers[0].first_name).toBe('Jane');
      expect(result.researchers[0].last_name).toBe('Smith');
    });

    it('should handle names with PhD suffix', async () => {
      const input: Step5Input = {
        raw_cards: [
          { index: 0, outer_html: '', name_text: 'Bob Johnson, PhD', title_text: 'Professor' },
        ],
      };

      const result = await parseAndNormalize(input);

      expect(result.researchers).toHaveLength(1);
      expect(result.researchers[0].first_name).toBe('Bob');
      expect(result.researchers[0].last_name).toBe('Johnson');
    });

    it('should handle multi-part names', async () => {
      const input: Step5Input = {
        raw_cards: [
          { index: 0, outer_html: '', name_text: 'Mary Jane Watson', title_text: 'Professor' },
        ],
      };

      const result = await parseAndNormalize(input);

      expect(result.researchers).toHaveLength(1);
      // Parser treats "Mary Jane" as first name and "Watson" as last name
      expect(result.researchers[0].first_name).toBe('Mary Jane');
      expect(result.researchers[0].last_name).toBe('Watson');
    });

    it('should skip cards with empty names', async () => {
      const input: Step5Input = {
        raw_cards: [
          { index: 0, outer_html: '', name_text: '', title_text: 'Professor' },
          { index: 1, outer_html: '', name_text: '   ', title_text: 'Associate Professor' },
        ],
      };

      const result = await parseAndNormalize(input);

      expect(result.researchers).toHaveLength(0);
      expect(result.parse_errors.length).toBeGreaterThan(0);
    });

    it('should skip cards without names', async () => {
      const input: Step5Input = {
        raw_cards: [
          { index: 0, outer_html: '', title_text: 'Professor' } as RawCard,
        ],
      };

      const result = await parseAndNormalize(input);

      expect(result.researchers).toHaveLength(0);
      expect(result.parse_errors).toHaveLength(1);
      expect(result.parse_errors[0].field).toBe('name');
    });
  });

  describe('Title Normalization', () => {
    it('should normalize professor titles', async () => {
      const cards: RawCard[] = [
        { index: 0, outer_html: '', name_text: 'John Doe', title_text: 'Professor' },
        { index: 1, outer_html: '', name_text: 'Jane Smith', title_text: 'Assistant Professor' },
        { index: 2, outer_html: '', name_text: 'Bob Brown', title_text: 'Associate Professor' },
      ];

      const input: Step5Input = { raw_cards: cards };
      const result = await parseAndNormalize(input);

      expect(result.researchers).toHaveLength(3);
      expect(result.researchers[0].title).toBe('Professor');
      expect(result.researchers[1].title).toBe('Assistant Professor');
      expect(result.researchers[2].title).toBe('Associate Professor');
    });

    it('should handle various title formats', async () => {
      const cards: RawCard[] = [
        { index: 0, outer_html: '', name_text: 'Test User', title_text: 'Research Scientist' },
        { index: 1, outer_html: '', name_text: 'Test User2', title_text: 'Lecturer' },
        { index: 2, outer_html: '', name_text: 'Test User3', title_text: 'Postdoctoral Fellow' },
      ];

      const input: Step5Input = { raw_cards: cards };
      const result = await parseAndNormalize(input);

      expect(result.researchers).toHaveLength(3);
      expect(result.researchers[0].title).toBe('Research Scientist');
      expect(result.researchers[1].title).toBe('Lecturer');
      expect(result.researchers[2].title).toBe('Postdoctoral Fellow');
    });
  });

  describe('Email Normalization', () => {
    it('should lowercase emails', async () => {
      const input: Step5Input = {
        raw_cards: [
          { index: 0, outer_html: '', name_text: 'John Doe', email_text: 'John.Doe@EXAMPLE.EDU' },
        ],
      };

      const result = await parseAndNormalize(input);

      expect(result.researchers).toHaveLength(1);
      expect(result.researchers[0].email).toBe('john.doe@example.edu');
    });

    it('should handle invalid emails with parse errors', async () => {
      const input: Step5Input = {
        raw_cards: [
          { index: 0, outer_html: '', name_text: 'John Doe', email_text: 'not-an-email' },
        ],
      };

      const result = await parseAndNormalize(input);

      // Researcher should still be created, just without email
      expect(result.researchers).toHaveLength(1);
      expect(result.researchers[0].email).toBeUndefined();
      expect(result.parse_errors).toHaveLength(1);
      expect(result.parse_errors[0].field).toBe('email');
    });
  });

  describe('Phone Normalization', () => {
    it('should normalize phone numbers', async () => {
      const input: Step5Input = {
        raw_cards: [
          { index: 0, outer_html: '', name_text: 'John Doe', phone_text: '555-123-4567' },
          { index: 1, outer_html: '', name_text: 'Jane Smith', phone_text: '(555) 123-4567' },
          { index: 2, outer_html: '', name_text: 'Bob Brown', phone_text: '+1-555-123-4567' },
        ],
      };

      const result = await parseAndNormalize(input);

      expect(result.researchers).toHaveLength(3);
      // All should have phone numbers
      expect(result.researchers[0].phone).toBeDefined();
      expect(result.researchers[1].phone).toBeDefined();
      expect(result.researchers[2].phone).toBeDefined();
    });
  });

  describe('Research Areas', () => {
    it('should parse comma-separated research areas', async () => {
      const input: Step5Input = {
        raw_cards: [
          {
            index: 0,
            outer_html: '',
            name_text: 'John Doe',
            research_areas_text: 'Machine Learning, Natural Language Processing, AI',
          },
        ],
      };

      const result = await parseAndNormalize(input);

      expect(result.researchers).toHaveLength(1);
      // Check that research areas are parsed (actual format may vary)
      expect(result.researchers[0].research_areas).toBeDefined();
      expect(result.researchers[0].research_areas!.length).toBeGreaterThan(0);
    });
  });

  describe('URL Handling', () => {
    it('should preserve valid URLs', async () => {
      const input: Step5Input = {
        raw_cards: [
          {
            index: 0,
            outer_html: '',
            name_text: 'John Doe',
            website_url: 'https://example.com/johndoe',
            photo_url: 'https://example.com/photo.jpg',
          },
        ],
      };

      const result = await parseAndNormalize(input);

      expect(result.researchers).toHaveLength(1);
      expect(result.researchers[0].website).toBe('https://example.com/johndoe');
      expect(result.researchers[0].photo_url).toBe('https://example.com/photo.jpg');
    });
  });

  describe('Error Handling', () => {
    it('should collect all parse errors', async () => {
      const input: Step5Input = {
        raw_cards: [
          { index: 0, outer_html: '', title_text: 'Professor' } as RawCard, // No name
          { index: 1, outer_html: '', name_text: 'Valid Name', email_text: 'invalid-email', title_text: 'Prof' },
        ],
      };

      const result = await parseAndNormalize(input);

      // Only valid researcher should be present
      expect(result.researchers).toHaveLength(1);
      // Should have errors for both cards
      expect(result.parse_errors.length).toBeGreaterThan(0);
    });

    it('should include card index in errors', async () => {
      const input: Step5Input = {
        raw_cards: [
          { index: 0, outer_html: '', name_text: 'Valid', title_text: 'Prof' },
          { index: 1, outer_html: '', title_text: 'Prof' } as RawCard, // No name
        ],
      };

      const result = await parseAndNormalize(input);

      const nameError = result.parse_errors.find((e) => e.field === 'name');
      expect(nameError?.card_index).toBe(1);
    });
  });

  describe('Normalization Stats', () => {
    it('should track normalization statistics', async () => {
      const input: Step5Input = {
        raw_cards: [
          { index: 0, outer_html: '', name_text: 'John Doe', email_text: 'john@example.com', title_text: 'Professor' },
          { index: 1, outer_html: '', name_text: 'Jane Smith', title_text: 'Associate Professor' },
        ],
      };

      const result = await parseAndNormalize(input);

      expect(result.normalization_stats.total_parsed).toBe(2);
      expect(result.normalization_stats.emails_normalized).toBe(1);
      expect(result.normalization_stats.names_split).toBe(2);
      expect(result.normalization_stats.titles_standardized).toBe(2);
    });
  });
});
