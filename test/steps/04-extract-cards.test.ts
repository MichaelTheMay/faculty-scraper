/**
 * Step 4: Extract Researcher Cards - Tests
 */

import { describe, it, expect } from 'vitest';
import { runStep4 } from '../../src/pipeline/steps/04-extract-cards.js';
import { loadFixture, sampleFacultyHtml, sampleSelectors } from '../setup.js';
import type { Step4Input } from '../../src/pipeline/types.js';

describe('Step 4: Extract Researcher Cards', () => {
  describe('runStep4', () => {
    it('should extract all researcher cards from HTML', async () => {
      const input: Step4Input = {
        html: sampleFacultyHtml,
        selectors: sampleSelectors,
      };

      const result = await runStep4(input);

      expect(result.raw_cards).toHaveLength(3);
      expect(result.extraction_stats.total_cards).toBe(3);
    });

    it('should extract names correctly', async () => {
      const input: Step4Input = {
        html: sampleFacultyHtml,
        selectors: sampleSelectors,
      };

      const result = await runStep4(input);

      expect(result.raw_cards[0].name_text).toBe('John Doe');
      expect(result.raw_cards[1].name_text).toBe('Dr. Jane Smith');
      expect(result.raw_cards[2].name_text).toBe('Bob Johnson, PhD');
      expect(result.extraction_stats.cards_with_name).toBe(3);
    });

    it('should extract emails from mailto links', async () => {
      const input: Step4Input = {
        html: sampleFacultyHtml,
        selectors: sampleSelectors,
      };

      const result = await runStep4(input);

      expect(result.raw_cards[0].email_text).toBe('john.doe@example.edu');
      expect(result.raw_cards[1].email_text).toBe('jane.smith@example.edu');
      expect(result.raw_cards[2].email_text).toBe('bob@example.edu');
      expect(result.extraction_stats.cards_with_email).toBe(3);
    });

    it('should extract titles', async () => {
      const input: Step4Input = {
        html: sampleFacultyHtml,
        selectors: sampleSelectors,
      };

      const result = await runStep4(input);

      expect(result.raw_cards[0].title_text).toBe('Professor');
      expect(result.raw_cards[1].title_text).toBe('Associate Professor');
      expect(result.raw_cards[2].title_text).toBe('Assistant Professor of Computer Science');
      expect(result.extraction_stats.cards_with_title).toBe(3);
    });

    it('should extract phone numbers from tel links', async () => {
      const input: Step4Input = {
        html: sampleFacultyHtml,
        selectors: sampleSelectors,
      };

      const result = await runStep4(input);

      // Raw extraction includes the tel: link content which normalizer processes
      expect(result.raw_cards[0].phone_text).toBeDefined();
      expect(result.raw_cards[0].phone_text).toContain('555');
      expect(result.raw_cards[1].phone_text).toBeUndefined();
    });

    it('should extract photo URLs', async () => {
      const input: Step4Input = {
        html: sampleFacultyHtml,
        selectors: sampleSelectors,
      };

      const result = await runStep4(input);

      expect(result.raw_cards[0].photo_url).toBe('https://example.com/photo1.jpg');
      expect(result.raw_cards[1].photo_url).toBe('https://example.com/photo2.jpg');
      expect(result.raw_cards[2].photo_url).toBeUndefined();
    });

    it('should extract research areas', async () => {
      const input: Step4Input = {
        html: sampleFacultyHtml,
        selectors: sampleSelectors,
      };

      const result = await runStep4(input);

      expect(result.raw_cards[0].research_areas_text).toBe(
        'Machine Learning, Natural Language Processing, Computer Vision'
      );
      expect(result.raw_cards[1].research_areas_text).toBe(
        'Distributed Systems, Cloud Computing'
      );
    });

    it('should preserve outer HTML for debugging', async () => {
      const input: Step4Input = {
        html: sampleFacultyHtml,
        selectors: sampleSelectors,
      };

      const result = await runStep4(input);

      expect(result.raw_cards[0].outer_html).toContain('faculty-card');
      expect(result.raw_cards[0].outer_html).toContain('John Doe');
    });

    it('should use default selectors when none provided', async () => {
      const input: Step4Input = {
        html: sampleFacultyHtml,
        selectors: {
          card: '.faculty-card',
        },
      };

      const result = await runStep4(input);

      // Should still find cards with default selectors
      expect(result.raw_cards.length).toBeGreaterThan(0);
    });

    it('should handle empty HTML gracefully', async () => {
      const input: Step4Input = {
        html: '<html><body></body></html>',
        selectors: sampleSelectors,
      };

      const result = await runStep4(input);

      expect(result.raw_cards).toHaveLength(0);
      expect(result.extraction_stats.total_cards).toBe(0);
    });

    it('should handle malformed HTML', async () => {
      const input: Step4Input = {
        html: '<div class="faculty-card"><h3 class="faculty-name">Test</h3>',
        selectors: sampleSelectors,
      };

      const result = await runStep4(input);

      expect(result.raw_cards).toHaveLength(1);
      expect(result.raw_cards[0].name_text).toBe('Test');
    });
  });

  describe('with fixture data', () => {
    it('should process fixture input correctly', async () => {
      let input: Step4Input;
      try {
        input = loadFixture<Step4Input>('step4-input.json');
      } catch {
        // Skip if fixture doesn't exist
        return;
      }

      const result = await runStep4(input);

      expect(result.raw_cards.length).toBeGreaterThan(0);
      expect(result.extraction_stats.total_cards).toBe(result.raw_cards.length);
    });
  });
});
