/**
 * Step E2: Deep Research
 *
 * Perform deep research on a researcher using multiple sources.
 */

import type { StepE2Input, StepE2Output, EnrichedData, Publication } from '../types.js';

type PublicationInput = Omit<Publication, 'id' | 'created_at' | 'updated_at'>;

/**
 * Research a researcher using DBLP
 */
async function researchDblp(name: string): Promise<Partial<EnrichedData>> {
  console.log(`[Step E2] Would search DBLP for: ${name}`);
  return { publications: [], research_areas: [] };
}

/**
 * Research a researcher using Semantic Scholar
 */
async function researchSemanticScholar(name: string): Promise<Partial<EnrichedData>> {
  console.log(`[Step E2] Would search Semantic Scholar for: ${name}`);
  return { h_index: undefined, citations_total: undefined, publications: [] };
}

/**
 * Research a researcher's personal website
 */
async function researchPersonalWebsite(website: string): Promise<Partial<EnrichedData>> {
  console.log(`[Step E2] Would scrape personal website: ${website}`);
  return { research_areas: [], publications: [], bio: undefined };
}

/**
 * Merge results from multiple sources
 */
function mergeResults(...results: Partial<EnrichedData>[]): EnrichedData {
  const publications: PublicationInput[] = [];
  const research_areas = new Set<string>();
  let h_index: number | undefined;
  let citations_total: number | undefined;
  let bio: string | undefined;
  let google_scholar_url: string | undefined;
  let dblp_url: string | undefined;
  let semantic_scholar_id: string | undefined;
  let orcid: string | undefined;

  for (const result of results) {
    if (result.h_index !== undefined && (h_index === undefined || result.h_index > h_index)) {
      h_index = result.h_index;
    }

    if (
      result.citations_total !== undefined &&
      (citations_total === undefined || result.citations_total > citations_total)
    ) {
      citations_total = result.citations_total;
    }

    if (result.publications) {
      for (const pub of result.publications) {
        const exists = publications.some((p) => p.title.toLowerCase() === pub.title.toLowerCase());
        if (!exists) {
          publications.push(pub);
        }
      }
    }

    if (result.research_areas) {
      for (const area of result.research_areas) {
        research_areas.add(area);
      }
    }

    if (result.bio && !bio) bio = result.bio;
    if (result.google_scholar_url && !google_scholar_url)
      google_scholar_url = result.google_scholar_url;
    if (result.dblp_url && !dblp_url) dblp_url = result.dblp_url;
    if (result.semantic_scholar_id && !semantic_scholar_id)
      semantic_scholar_id = result.semantic_scholar_id;
    if (result.orcid && !orcid) orcid = result.orcid;
  }

  return {
    publications,
    h_index,
    citations_total,
    research_areas: Array.from(research_areas),
    bio,
    google_scholar_url,
    dblp_url,
    semantic_scholar_id,
    orcid,
  };
}

/**
 * Perform deep research on a researcher
 */
export async function deepResearch(input: StepE2Input): Promise<StepE2Output> {
  const { researcher, sources } = input;
  const searchQuery = researcher.full_name;

  const sourcesUsed: string[] = [];
  const errors: { source: string; error: string }[] = [];
  const results: Partial<EnrichedData>[] = [];

  // Query each source
  for (const source of sources) {
    try {
      sourcesUsed.push(source);

      switch (source) {
        case 'dblp':
          results.push(await researchDblp(searchQuery));
          break;
        case 'semantic_scholar':
          results.push(await researchSemanticScholar(searchQuery));
          break;
        case 'personal_website':
          if (researcher.website) {
            results.push(await researchPersonalWebsite(researcher.website));
          }
          break;
        case 'web_search':
          console.log(`[Step E2] Would perform web search for: ${searchQuery}`);
          break;
      }
    } catch (e) {
      errors.push({
        source,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Merge all results
  const enrichedData = mergeResults(...results);

  return {
    researcher_id: researcher.id,
    enriched_data: enrichedData,
    sources_used: sourcesUsed,
    errors,
  };
}

/**
 * Run Step E2
 */
export async function runStepE2(input: StepE2Input): Promise<StepE2Output> {
  return deepResearch(input);
}

export default runStepE2;
