import { GoogleGenAI, Type } from "@google/genai";
import { ComicInfo, ComicType, ComicStatus } from "../types";
import { lookupTitlesFromJikan } from "./jikanService";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const comicSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "The official title of the comic" },
    type: { 
      type: Type.STRING, 
      enum: ["manga", "manhwa", "manhua", "unknown"],
      description: "Manga (Japanese), Manhwa (Korean), or Manhua (Chinese)"
    },
    status: { 
      type: Type.STRING, 
      enum: ["ongoing", "finished", "hiatus", "cancelled", "discontinued", "unknown"],
      description: "Current publication status"
    },
    genres: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "List of genres (e.g. Action, Fantasy, Romance)"
    },
    synopsis: { type: Type.STRING, description: "A brief summary of the story" },
    originalLanguage: { type: Type.STRING, description: "The original language of publication" },
    author: { type: Type.STRING, description: "The author or creator of the work" },
    releaseYear: { type: Type.STRING, description: "The year it was first released" },
    rating: { type: Type.STRING, description: "Average rating or content rating" },
    altTitles: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Alternative titles or original language titles"
    }
  },
  required: ["title", "type", "status", "genres", "synopsis", "author", "releaseYear"]
};

async function retryLookup<T>(fn: () => Promise<T>, retries = 5, delay = 3000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error).toLowerCase();
    const isRateLimit = errorStr.includes('429') || errorStr.includes('resource_exhausted') || errorStr.includes('quota');
    
    if (isRateLimit && retries > 0) {
      console.warn(`[AI Engine] Rate limit/Quota hit. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      // Exponential backoff with jitter
      const nextDelay = delay * 1.5 + Math.random() * 1000;
      return retryLookup(fn, retries - 1, nextDelay);
    }
    throw error;
  }
}

function mapStatus(status: string): ComicStatus {
  const s = status.toLowerCase();
  if (s.includes('ongoing') || s.includes('publishing')) return 'ongoing';
  if (s.includes('finished') || s.includes('complete')) return 'finished';
  if (s.includes('hiatus')) return 'hiatus';
  if (s.includes('cancelled')) return 'cancelled';
  if (s.includes('discontinued')) return 'discontinued';
  return 'unknown';
}

export async function lookupComicsBatch(searchQueries: string[]): Promise<Record<string, ComicInfo[]>> {
  if (searchQueries.length === 0) return {};

  return retryLookup(async () => {
    const queriesStr = searchQueries.join(', ');
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for comics matching each of these queries: [${queriesStr}].
      
      Requirements for EACH query:
      - Return a list of highly relevant matches.
      - If a query is gibberish, return an empty array [].
      - ONLY return real, existing comics (Manga, Manhwa, Manhua).
      - UP TO 20 results per query. Prioritize exact matches.
      - Ensure you include famous Manhua (Chinese) as well as Manga and Manhwa.
      - Return a JSON object where keys are the EXACT query strings provided and values are arrays of comic objects.
 
      Comic Object Structure:
      - title (The most common English release title), type (manga/manhwa/manhua), status (ongoing/finished/hiatus/cancelled/unknown), genres, synopsis, author, releaseYear, originalLanguage, altTitles (Include ALL known alternative titles).
      
      Query List: ${queriesStr}`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const jsonStr = (response.text || "").trim();
    if (!jsonStr) return {};
    
    try {
      const batchResults = JSON.parse(jsonStr);
      // Clean and normalize results
      const normalized: Record<string, ComicInfo[]> = {};
      
      searchQueries.forEach(query => {
        const lowerQuery = query.toLowerCase().trim();
        let results = batchResults[query] || batchResults[Object.keys(batchResults).find(k => k.toLowerCase().trim() === lowerQuery) || ''];
        
        results = results || [];
        
        // Final relevance filter: Allow more looseness for Gemini results
        const filteredResults = (results as any[]).map(data => ({
          title: data.title || query,
          type: (data.type || 'unknown').toLowerCase() as ComicType,
          status: mapStatus(data.status || 'unknown'),
          genres: data.genres || [],
          synopsis: data.synopsis || "No matches found.",
          originalLanguage: data.originalLanguage || "Unknown",
          author: data.author || "Unknown",
          releaseYear: data.releaseYear || "Unknown",
          rating: data.rating,
          altTitles: data.altTitles || []
        })).filter(comic => {
          const normalize = (s: string | undefined) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
          const nT = normalize(comic.title);
          const nQ = normalize(query);
          
          // Heuristic relevance: 
          // 1. One contains the other
          // 2. Or they share at least 50% of words (for typos/long titles)
          if (nT.includes(nQ) || nQ.includes(nT)) return true;
          
          const wordsT = new Set(nT.split(' ').filter(w => w.length > 2));
          const wordsQ = new Set(nQ.split(' ').filter(w => w.length > 2));
          if (wordsQ.size === 0) return true; // fallback if query is very short
          
          let matches = 0;
          wordsQ.forEach(w => { if (wordsT.has(w)) matches++; });
          
          // If at least one long word matches, it's probably relevant enough to show
          return matches > 0;
        });

        normalized[query] = filteredResults;
      });
      
      return normalized;
    } catch (err) {
      console.error("[AI Engine] Failed to parse batch JSON:", err);
      return {};
    }
  });
}

export async function lookupComicHybrid(title: string): Promise<ComicInfo[]> {
  const normalize = (s: string | undefined) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const searchNorm = normalize(title);
  
  if (!searchNorm) return [];

  console.log(`[Lookup] Hybrid start: "${title}"`);

  // 1. Try Jikan first
  const jikanData = await lookupTitlesFromJikan(title, 20);
  const mappedJikan: ComicInfo[] = jikanData.map(res => ({
    title: res.title,
    type: (res.type || 'unknown').toLowerCase() as ComicType,
    status: mapStatus(res.status || 'unknown'),
    genres: [...(res.genres?.map((g: any) => g.name) || [])].filter(Boolean),
    synopsis: res.synopsis || "No synopsis available.",
    author: res.authors?.[0]?.name || "Unknown",
    releaseYear: res.published?.from ? new Date(res.published.from).getFullYear().toString() : "Unknown",
    originalLanguage: "Japanese",
    altTitles: res.titles?.map((t: any) => t.title) || []
  }));

  // Filter Jikan results: Containment check on normalized strings
  const relevantJikan = mappedJikan.filter(c => {
    const nTitle = normalize(c.title);
    const nAlts = c.altTitles.map(at => normalize(at));
    
    if (nTitle.includes(searchNorm) || nAlts.some(at => at.includes(searchNorm)) || searchNorm.includes(nTitle)) return true;
    
    const wordsT = new Set(nTitle.split(' ').filter(w => w.length > 2));
    const wordsQ = new Set(searchNorm.split(' ').filter(w => w.length > 2));
    if (wordsQ.size === 0) return true;
    
    let matches = 0;
    wordsQ.forEach(w => { if (wordsT.has(w)) matches++; });
    return matches > 0;
  });

  // 2. Fetch Gemini Results 
  // We fetch Gemini results if we have few Jikan matches OR if the user is looking for something specific (heuristic)
  let geminiData: ComicInfo[] = [];
  if (relevantJikan.length < 5) {
    console.log(`[Lookup] Jikan results low (${relevantJikan.length}), fetching Gemini...`);
    geminiData = await lookupComic(title);
  }

  // 3. Combine
  const seen = new Set<string>();
  const combined: ComicInfo[] = [];

  [...relevantJikan, ...geminiData].forEach(comic => {
    const titleKey = comic.title.toLowerCase().trim();
    if (!seen.has(titleKey)) {
      const nT = normalize(comic.title);
      
      const isRelevanceSatisfied = nT.includes(searchNorm) || 
                                  comic.altTitles.some(at => normalize(at).includes(searchNorm)) ||
                                  searchNorm.includes(nT) ||
                                  (() => {
                                    const wordsT = new Set(nT.split(' ').filter(w => w.length > 2));
                                    const wordsQ = new Set(searchNorm.split(' ').filter(w => w.length > 2));
                                    if (wordsQ.size === 0) return true;
                                    let matches = 0;
                                    wordsQ.forEach(w => { if (wordsT.has(w)) matches++; });
                                    return matches > 0;
                                  })();
      
      if (isRelevanceSatisfied) {
        seen.add(titleKey);
        combined.push(comic);
      }
    }
  });

  console.log(`[Lookup] Combined results count: ${combined.length}`);

  // 4. Sort: Exact matches first, then partials
  return combined.sort((a, b) => {
    const nA = normalize(a.title);
    const nB = normalize(b.title);
    const aExact = nA === searchNorm || a.altTitles.some(at => normalize(at) === searchNorm);
    const bExact = nB === searchNorm || b.altTitles.some(at => normalize(at) === searchNorm);
    
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    
    return a.title.length - b.title.length;
  }).slice(0, 20);
}

export async function lookupComicsBatchHybrid(titles: string[]): Promise<Record<string, ComicInfo[]>> {
  if (titles.length === 0) return {};

  const finalResults: Record<string, ComicInfo[]> = {};
  
  console.log(`[BatchHybrid] Processing ${titles.length} titles`);

  // To keep it efficient but accurate, we loop through each title
  // and use the Hybrid logic which includes Jikan + Gemini fallback.
  // However, we process in chunks to avoid overwhelming the system.
  const CHUNK_SIZE = 5;
  for (let i = 0; i < titles.length; i += CHUNK_SIZE) {
    const chunk = titles.slice(i, i + CHUNK_SIZE);
    
    await Promise.all(chunk.map(async (title) => {
      const results = await lookupComicHybrid(title);
      finalResults[title] = results;
    }));

    if (i + CHUNK_SIZE < titles.length) {
      // Respectful delay for Jikan rate limits (Jikan is ~3 req/s)
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  return finalResults;
}

export async function lookupComic(title: string): Promise<ComicInfo[]> {
  const result = await lookupComicsBatch([title]);
  return result[title] || [];
}
