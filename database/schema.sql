-- Faculty Directory Scraper Database Schema
-- SQLite database for storing researcher information

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Directories table: Stores faculty directory configurations
CREATE TABLE IF NOT EXISTS directories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    university TEXT NOT NULL,
    department TEXT NOT NULL,
    directory_url TEXT NOT NULL,
    profile_url_pattern TEXT,
    scrape_method TEXT DEFAULT 'firecrawl' CHECK(scrape_method IN ('firecrawl', 'playwright', 'hybrid')),
    scrape_config TEXT, -- JSON: selectors, load_more_selector, scroll_config, etc.
    is_active INTEGER DEFAULT 1,
    last_scraped TEXT, -- ISO timestamp
    records_last_scrape INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(university, department, directory_url)
);

-- Researchers table: Core researcher information
CREATE TABLE IF NOT EXISTS researchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    university TEXT,
    department TEXT,
    title TEXT, -- e.g., "Professor", "Associate Professor", "Assistant Professor"
    email TEXT,
    phone TEXT,
    office TEXT,
    website TEXT,
    photo_url TEXT,
    google_scholar_url TEXT,
    dblp_url TEXT,
    semantic_scholar_id TEXT,
    orcid TEXT,
    h_index INTEGER,
    citations_total INTEGER DEFAULT 0,
    publications_count INTEGER DEFAULT 0,
    research_areas TEXT, -- JSON array of research areas
    bio TEXT,
    source_directory_id INTEGER,
    enrichment_status TEXT DEFAULT 'pending' CHECK(enrichment_status IN ('pending', 'in_progress', 'complete', 'failed')),
    enrichment_error TEXT,
    last_verified TEXT, -- ISO timestamp
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (source_directory_id) REFERENCES directories(id) ON DELETE SET NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_researchers_email ON researchers(email);
CREATE INDEX IF NOT EXISTS idx_researchers_full_name ON researchers(full_name);
CREATE INDEX IF NOT EXISTS idx_researchers_university ON researchers(university);
CREATE INDEX IF NOT EXISTS idx_researchers_enrichment_status ON researchers(enrichment_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_researchers_email_unique ON researchers(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_researchers_name_univ_dept ON researchers(full_name, university, department);

-- Publications table: Researcher publications
CREATE TABLE IF NOT EXISTS publications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    authors TEXT, -- JSON array of author names
    venue TEXT, -- Journal or conference name
    venue_type TEXT CHECK(venue_type IN ('journal', 'conference', 'workshop', 'book', 'thesis', 'preprint', 'other')),
    year INTEGER,
    doi TEXT,
    url TEXT,
    abstract TEXT,
    citations INTEGER DEFAULT 0,
    source TEXT, -- dblp, semantic_scholar, personal_website, etc.
    source_id TEXT, -- ID from the source
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(title, year, venue)
);

CREATE INDEX IF NOT EXISTS idx_publications_title ON publications(title);
CREATE INDEX IF NOT EXISTS idx_publications_year ON publications(year);
CREATE INDEX IF NOT EXISTS idx_publications_doi ON publications(doi) WHERE doi IS NOT NULL;

-- Researcher-Publications junction table
CREATE TABLE IF NOT EXISTS researcher_publications (
    researcher_id INTEGER NOT NULL,
    publication_id INTEGER NOT NULL,
    is_primary_author INTEGER DEFAULT 0,
    author_position INTEGER, -- 1 = first author, 2 = second, etc.
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (researcher_id, publication_id),
    FOREIGN KEY (researcher_id) REFERENCES researchers(id) ON DELETE CASCADE,
    FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE CASCADE
);

-- Scrape jobs table: Track scraping runs
CREATE TABLE IF NOT EXISTS scrape_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL UNIQUE,
    directory_id INTEGER NOT NULL,
    scrape_type TEXT DEFAULT 'full' CHECK(scrape_type IN ('full', 'incremental', 'verify', 'test')),
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    duration_seconds INTEGER,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'success', 'failed', 'cancelled')),
    current_step TEXT,
    records_found INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    error_message TEXT,
    debug_path TEXT, -- Path to debug output directory
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (directory_id) REFERENCES directories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_job_id ON scrape_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_directory_id ON scrape_jobs(directory_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);

-- Scrape logs table: Detailed per-record logging
CREATE TABLE IF NOT EXISTS scrape_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    step TEXT NOT NULL,
    level TEXT DEFAULT 'info' CHECK(level IN ('debug', 'info', 'warn', 'error')),
    message TEXT NOT NULL,
    data TEXT, -- JSON additional data
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (job_id) REFERENCES scrape_jobs(job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scrape_logs_job_id ON scrape_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_level ON scrape_logs(level);

-- Enrichment queue table: Track pending enrichment tasks
CREATE TABLE IF NOT EXISTS enrichment_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    researcher_id INTEGER NOT NULL UNIQUE,
    priority INTEGER DEFAULT 5, -- 1 = highest, 10 = lowest
    attempts INTEGER DEFAULT 0,
    last_attempt TEXT,
    next_attempt TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'complete', 'failed', 'skipped')),
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (researcher_id) REFERENCES researchers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status ON enrichment_queue(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_priority ON enrichment_queue(priority);

-- Audit log table: Track all changes
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values TEXT, -- JSON
    new_values TEXT, -- JSON
    changed_by TEXT DEFAULT 'system',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Step outputs table: Store intermediate pipeline outputs for debugging
CREATE TABLE IF NOT EXISTS step_outputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    step_name TEXT NOT NULL,
    input_data TEXT, -- JSON
    output_data TEXT, -- JSON
    duration_ms INTEGER,
    success INTEGER DEFAULT 1,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (job_id) REFERENCES scrape_jobs(job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_step_outputs_job_step ON step_outputs(job_id, step_name);

-- Triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_directories_timestamp
    AFTER UPDATE ON directories
BEGIN
    UPDATE directories SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_researchers_timestamp
    AFTER UPDATE ON researchers
BEGIN
    UPDATE researchers SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_publications_timestamp
    AFTER UPDATE ON publications
BEGIN
    UPDATE publications SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_enrichment_queue_timestamp
    AFTER UPDATE ON enrichment_queue
BEGIN
    UPDATE enrichment_queue SET updated_at = datetime('now') WHERE id = NEW.id;
END;
