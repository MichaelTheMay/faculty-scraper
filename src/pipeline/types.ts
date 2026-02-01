/**
 * Pipeline Types - Defines all input/output types for pipeline steps
 */

import { z } from 'zod';

// ============================================================
// Core Entity Types
// ============================================================

export interface Directory {
  id: number;
  university: string;
  department: string;
  directory_url: string;
  profile_url_pattern?: string;
  scrape_method: 'firecrawl' | 'playwright' | 'hybrid';
  scrape_config?: ScrapeConfig;
  is_active: boolean;
  last_scraped?: string;
  records_last_scrape: number;
  created_at: string;
  updated_at: string;
}

export interface ScrapeConfig {
  selectors?: {
    card?: string;
    name?: string;
    title?: string;
    email?: string;
    phone?: string;
    office?: string;
    website?: string;
    photo?: string;
    research_areas?: string;
  };
  load_more_selector?: string;
  scroll_to_load?: boolean;
  scroll_config?: {
    max_scrolls?: number;
    scroll_delay_ms?: number;
  };
  pagination_type?: 'none' | 'load_more' | 'pages' | 'infinite_scroll' | 'filter';
  filter_selector?: string;
  filter_value?: string;
  wait_after_load_ms?: number;
}

export interface Researcher {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  university?: string;
  department?: string;
  title?: string;
  email?: string;
  phone?: string;
  office?: string;
  website?: string;
  photo_url?: string;
  google_scholar_url?: string;
  dblp_url?: string;
  semantic_scholar_id?: string;
  orcid?: string;
  h_index?: number;
  citations_total: number;
  publications_count: number;
  research_areas?: string[];
  bio?: string;
  source_directory_id?: number;
  enrichment_status: 'pending' | 'in_progress' | 'complete' | 'failed';
  enrichment_error?: string;
  last_verified?: string;
  created_at: string;
  updated_at: string;
}

export interface Publication {
  id: number;
  title: string;
  authors?: string[];
  venue?: string;
  venue_type?: 'journal' | 'conference' | 'workshop' | 'book' | 'thesis' | 'preprint' | 'other';
  year?: number;
  doi?: string;
  url?: string;
  abstract?: string;
  citations: number;
  source?: string;
  source_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ScrapeJob {
  id: number;
  job_id: string;
  directory_id: number;
  scrape_type: 'full' | 'incremental' | 'verify' | 'test';
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  current_step?: string;
  records_found: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  error_message?: string;
  debug_path?: string;
  created_at: string;
}

// ============================================================
// Step 0: Autonomous Site Analysis Types
// ============================================================

export interface Step0Input {
  url: string;
  timeout_ms?: number;
}

export interface Step0Output {
  total_researchers_found: number;
  load_more_detected: boolean;
  load_more_clicks: number;
  scroll_performed: boolean;
  pagination_detected: boolean;
  pagination_pages?: number;
  selectors_discovered: {
    researcher_card?: string;
    name?: string;
    title?: string;
    email?: string;
    phone?: string;
    website?: string;
    photo?: string;
  };
  final_page_html: string;
  screenshots: string[];
  analysis_notes: string[];
}

// ============================================================
// Step 1: Load Directory Config Types
// ============================================================

export interface Step1Input {
  directory_id?: number;
  from_step0?: Step0Output;
  url?: string;
}

export interface Step1Output {
  directory: Directory;
  url: string;
  scrape_method: 'firecrawl' | 'playwright' | 'hybrid';
  selectors: NonNullable<ScrapeConfig['selectors']>;
  load_more_config?: {
    selector: string;
    max_clicks: number;
    wait_between_clicks_ms: number;
  };
  scroll_config?: ScrapeConfig['scroll_config'];
  use_step0_html: boolean;
}

// ============================================================
// Step 2: Fetch Page Content Types
// ============================================================

export interface Step2Input {
  url: string;
  method: 'firecrawl' | 'playwright';
  config?: {
    wait_for_selector?: string;
    timeout_ms?: number;
    screenshot?: boolean;
  };
  step0_html?: string; // If provided, skip fetching
}

export interface Step2Output {
  html: string;
  markdown?: string;
  links: string[];
  screenshot_path?: string;
  fetch_time_ms: number;
  from_cache: boolean;
}

// ============================================================
// Step 3: Handle Dynamic Content Types
// ============================================================

export interface Step3Input {
  html: string;
  url: string;
  load_more_selector?: string;
  scroll_config?: ScrapeConfig['scroll_config'];
  already_loaded?: boolean; // If Step 0 ran
}

export interface Step3Output {
  final_html: string;
  clicks_performed: number;
  scroll_distance: number;
  screenshots: string[];
  dynamic_content_found: boolean;
}

// ============================================================
// Step 4: Extract Researcher Cards Types
// ============================================================

export interface Step4Input {
  html: string;
  selectors: NonNullable<ScrapeConfig['selectors']>;
}

export interface RawCard {
  index: number;
  outer_html: string;
  name_text?: string;
  title_text?: string;
  email_text?: string;
  phone_text?: string;
  office_text?: string;
  website_url?: string;
  photo_url?: string;
  research_areas_text?: string;
  profile_link?: string;
}

export interface Step4Output {
  raw_cards: RawCard[];
  extraction_stats: {
    total_cards: number;
    cards_with_name: number;
    cards_with_email: number;
    cards_with_title: number;
    cards_with_website: number;
  };
}

// ============================================================
// Step 5: Parse and Normalize Types
// ============================================================

export interface Step5Input {
  raw_cards: RawCard[];
  university: string;
  department: string;
}

export interface ParsedResearcher {
  first_name: string;
  last_name: string;
  full_name: string;
  university: string;
  department: string;
  title?: string;
  email?: string;
  phone?: string;
  office?: string;
  website?: string;
  photo_url?: string;
  research_areas?: string[];
}

export interface ParseError {
  card_index: number;
  field: string;
  error: string;
  raw_value?: string;
}

export interface Step5Output {
  researchers: ParsedResearcher[];
  parse_errors: ParseError[];
  normalization_stats: {
    total_parsed: number;
    emails_normalized: number;
    names_split: number;
    titles_standardized: number;
  };
}

// ============================================================
// Step 6: Deduplicate Types
// ============================================================

export interface Step6Input {
  researchers: ParsedResearcher[];
  directory_id: number;
}

export interface DedupeDecision {
  researcher: ParsedResearcher;
  action: 'insert' | 'update' | 'skip';
  existing_id?: number;
  match_reason?: string;
  confidence: number;
}

export interface Step6Output {
  to_insert: ParsedResearcher[];
  to_update: { researcher: ParsedResearcher; existing_id: number }[];
  duplicates: { researcher: ParsedResearcher; existing_id: number; reason: string }[];
  stats: {
    total_input: number;
    to_insert: number;
    to_update: number;
    duplicates: number;
  };
}

// ============================================================
// Step 7: Persist to Database Types
// ============================================================

export interface Step7Input {
  to_insert: ParsedResearcher[];
  to_update: { researcher: ParsedResearcher; existing_id: number }[];
  job_id: string;
  directory_id: number;
}

export interface Step7Output {
  inserted_ids: number[];
  updated_ids: number[];
  job_stats: {
    records_created: number;
    records_updated: number;
    records_skipped: number;
  };
}

// ============================================================
// Step 8: Queue for Enrichment Types
// ============================================================

export interface Step8Input {
  researcher_ids: number[];
  priority?: number;
}

export interface Step8Output {
  queued_count: number;
  already_queued: number;
  queue_positions: { researcher_id: number; position: number }[];
}

// ============================================================
// Enrichment Pipeline Types
// ============================================================

export interface StepE1Input {
  batch_size: number;
  priority_threshold?: number;
}

export interface ResearcherToEnrich {
  id: number;
  full_name: string;
  email?: string;
  website?: string;
  university?: string;
  department?: string;
}

export interface StepE1Output {
  researchers: ResearcherToEnrich[];
  total_pending: number;
}

export interface StepE2Input {
  researcher: ResearcherToEnrich;
  sources: ('dblp' | 'semantic_scholar' | 'personal_website' | 'web_search')[];
}

export interface EnrichedData {
  publications: Omit<Publication, 'id' | 'created_at' | 'updated_at'>[];
  h_index?: number;
  citations_total?: number;
  research_areas?: string[];
  bio?: string;
  google_scholar_url?: string;
  dblp_url?: string;
  semantic_scholar_id?: string;
  orcid?: string;
}

export interface StepE2Output {
  researcher_id: number;
  enriched_data: EnrichedData;
  sources_used: string[];
  errors: { source: string; error: string }[];
}

export interface StepE3Input {
  existing: Researcher;
  enriched: EnrichedData;
}

export interface MergeConflict {
  field: string;
  existing_value: unknown;
  new_value: unknown;
  resolution: 'keep_existing' | 'use_new' | 'merge';
}

export interface StepE3Output {
  merged: Partial<Researcher>;
  publications_to_add: Omit<Publication, 'id' | 'created_at' | 'updated_at'>[];
  conflicts: MergeConflict[];
  confidence: number;
}

export interface StepE4Input {
  researcher_id: number;
  merged_data: Partial<Researcher>;
  publications: Omit<Publication, 'id' | 'created_at' | 'updated_at'>[];
}

export interface StepE4Output {
  success: boolean;
  publications_added: number;
  publications_updated: number;
  enrichment_status: 'complete' | 'failed';
  error?: string;
}

// ============================================================
// MCP Tool Types
// ============================================================

export interface ScrapeResult {
  job_id: string;
  status: 'success' | 'failed';
  records_found: number;
  records_created: number;
  records_updated: number;
  duration_seconds: number;
  errors?: string[];
}

export interface ScrapeJobSummary {
  total_directories: number;
  successful: number;
  failed: number;
  total_records: number;
  jobs: { directory_id: number; job_id: string; status: string }[];
}

export interface EnrichmentResult {
  researchers_enriched: number;
  publications_added: number;
  errors: { researcher_id: number; error: string }[];
}

export interface SearchFilters {
  university?: string;
  department?: string;
  title?: string;
  research_area?: string;
  enrichment_status?: 'pending' | 'in_progress' | 'complete' | 'failed';
  min_h_index?: number;
  min_citations?: number;
}

export interface JobStatus {
  job_id: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  current_step?: string;
  progress?: {
    current: number;
    total: number;
  };
  started_at: string;
  duration_seconds?: number;
  records_found?: number;
  error_message?: string;
}

// ============================================================
// Zod Schemas for Validation
// ============================================================

export const ScrapeConfigSchema = z.object({
  selectors: z.object({
    card: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    office: z.string().optional(),
    website: z.string().optional(),
    photo: z.string().optional(),
    research_areas: z.string().optional(),
  }).optional(),
  load_more_selector: z.string().optional(),
  scroll_to_load: z.boolean().optional(),
  scroll_config: z.object({
    max_scrolls: z.number().optional(),
    scroll_delay_ms: z.number().optional(),
  }).optional(),
  pagination_type: z.enum(['none', 'load_more', 'pages', 'infinite_scroll', 'filter']).optional(),
  filter_selector: z.string().optional(),
  filter_value: z.string().optional(),
  wait_after_load_ms: z.number().optional(),
});

export const DirectoryInputSchema = z.object({
  university: z.string().min(1),
  department: z.string().min(1),
  url: z.string().url(),
  method: z.enum(['firecrawl', 'playwright', 'hybrid']).default('firecrawl'),
  config: ScrapeConfigSchema.optional(),
});

export const ScrapeDirectoryInputSchema = z.object({
  directory_id: z.number().int().positive(),
  mode: z.enum(['full', 'test']).default('full'),
});

export const SearchInputSchema = z.object({
  query: z.string().optional(),
  filters: z.object({
    university: z.string().optional(),
    department: z.string().optional(),
    title: z.string().optional(),
    research_area: z.string().optional(),
    enrichment_status: z.enum(['pending', 'in_progress', 'complete', 'failed']).optional(),
    min_h_index: z.number().int().optional(),
    min_citations: z.number().int().optional(),
  }).optional(),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

export const ExportCsvInputSchema = z.object({
  output_path: z.string(),
  filters: z.object({
    university: z.string().optional(),
    department: z.string().optional(),
    enrichment_status: z.enum(['pending', 'in_progress', 'complete', 'failed']).optional(),
  }).optional(),
});

export const DebugStepInputSchema = z.object({
  step: z.string(),
  input: z.record(z.unknown()),
});
