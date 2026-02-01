/**
 * Test Setup - Common utilities for testing
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let testDb: Database.Database | null = null;

/**
 * Create an in-memory test database
 */
export function createTestDatabase(): Database.Database {
  if (testDb) {
    testDb.close();
  }

  testDb = new Database(':memory:');

  // Enable foreign keys
  testDb.pragma('foreign_keys = ON');

  // Load and execute schema
  const schemaPath = join(__dirname, '../database/schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  testDb.exec(schema);

  return testDb;
}

/**
 * Seed test data
 */
export function seedTestData(db: Database.Database): void {
  // Add test directory
  db.prepare(`
    INSERT INTO directories (university, department, directory_url, scrape_method, is_active)
    VALUES ('Test University', 'Computer Science', 'https://example.com/faculty', 'firecrawl', 1)
  `).run();

  // Add test researchers
  db.prepare(`
    INSERT INTO researchers (first_name, last_name, full_name, university, department, title, email, source_directory_id, enrichment_status)
    VALUES
      ('John', 'Doe', 'John Doe', 'Test University', 'Computer Science', 'Professor', 'john.doe@test.edu', 1, 'pending'),
      ('Jane', 'Smith', 'Jane Smith', 'Test University', 'Computer Science', 'Associate Professor', 'jane.smith@test.edu', 1, 'complete'),
      ('Bob', 'Johnson', 'Bob Johnson', 'Test University', 'Computer Science', 'Assistant Professor', 'bob.johnson@test.edu', 1, 'pending')
  `).run();
}

/**
 * Clean up test data
 */
export function cleanupTestData(db: Database.Database): void {
  db.exec(`
    DELETE FROM step_outputs;
    DELETE FROM scrape_logs;
    DELETE FROM scrape_jobs;
    DELETE FROM enrichment_queue;
    DELETE FROM researcher_publications;
    DELETE FROM publications;
    DELETE FROM researchers;
    DELETE FROM directories;
    DELETE FROM audit_log;
  `);
}

/**
 * Close test database
 */
export function closeTestDatabase(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}

/**
 * Get test database
 */
export function getTestDatabase(): Database.Database {
  if (!testDb) {
    throw new Error('Test database not initialized. Call createTestDatabase first.');
  }
  return testDb;
}

/**
 * Load test fixture
 */
export function loadFixture<T>(name: string): T {
  const fixturePath = join(__dirname, 'fixtures', name);
  const content = readFileSync(fixturePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Sample HTML fixture for testing card extraction
 */
export const sampleFacultyHtml = `
<!DOCTYPE html>
<html>
<body>
  <div class="faculty-list">
    <div class="faculty-card">
      <img src="https://example.com/photo1.jpg" alt="John Doe">
      <h3 class="faculty-name">John Doe</h3>
      <p class="faculty-title">Professor</p>
      <a href="mailto:john.doe@example.edu">john.doe@example.edu</a>
      <a href="tel:+1-555-123-4567">555-123-4567</a>
      <a href="https://johndoe.com" class="website">Personal Website</a>
      <p class="research-areas">Machine Learning, Natural Language Processing, Computer Vision</p>
    </div>
    <div class="faculty-card">
      <img src="https://example.com/photo2.jpg" alt="Jane Smith">
      <h3 class="faculty-name">Dr. Jane Smith</h3>
      <p class="faculty-title">Associate Professor</p>
      <a href="mailto:jane.smith@example.edu">jane.smith@example.edu</a>
      <a href="https://janesmith.dev">Homepage</a>
      <p class="research-areas">Distributed Systems, Cloud Computing</p>
    </div>
    <div class="faculty-card">
      <h3 class="faculty-name">Bob Johnson, PhD</h3>
      <p class="faculty-title">Assistant Professor of Computer Science</p>
      <a href="mailto:bob@example.edu">Contact</a>
    </div>
  </div>
</body>
</html>
`;

/**
 * Sample selectors for testing
 */
export const sampleSelectors = {
  card: '.faculty-card',
  name: '.faculty-name',
  title: '.faculty-title',
  email: 'a[href^="mailto:"]',
  phone: 'a[href^="tel:"]',
  website: 'a.website, a:contains("Homepage"), a:contains("Website")',
  photo: 'img',
  research_areas: '.research-areas',
};

/**
 * Mock Firecrawl response
 */
export function mockFirecrawlResponse(_url: string): {
  markdown: string;
  html: string;
  links: string[];
} {
  return {
    markdown: '# Faculty\n\n- John Doe, Professor\n- Jane Smith, Associate Professor',
    html: sampleFacultyHtml,
    links: [
      'https://example.com/faculty/john-doe',
      'https://example.com/faculty/jane-smith',
    ],
  };
}

/**
 * Mock Playwright page
 */
export function createMockPlaywrightPage(): {
  goto: (url: string) => Promise<void>;
  content: () => Promise<string>;
  click: (selector: string) => Promise<void>;
  waitForSelector: (selector: string) => Promise<void>;
  evaluate: <T>(fn: () => T) => Promise<T>;
  screenshot: (options: { path: string }) => Promise<void>;
  close: () => Promise<void>;
} {
  return {
    goto: async () => {},
    content: async () => sampleFacultyHtml,
    click: async () => {},
    waitForSelector: async () => {},
    evaluate: async <T>(fn: () => T) => fn(),
    screenshot: async () => {},
    close: async () => {},
  };
}
