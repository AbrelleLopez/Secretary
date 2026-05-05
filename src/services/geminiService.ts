import { GoogleGenAI, Type } from "@google/genai";
import { ComicInfo, ComicType, ComicStatus } from "../types";
import { lookupTitlesFromJikan } from "./jikanService";
import { mapStatus, normalize, isRelevant } from "../lib/comicUtils";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    console.log("[DEBUG] API Key loaded:", apiKey ? "EXISTS" : "MISSING"); // add this
    if (!apiKey) {
      console.error("[AI Engine] GEMINI_API_KEY is not defined in the environment.");
    }
    aiInstance = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return aiInstance;
}

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

export function isAIConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export async function lookupComicsBatch(searchQueries: string[]): Promise<Record<string, ComicInfo[]>> {
  if (searchQueries.length === 0) return {};

  const ai = getAI();

  return retryLookup(async () => {
    const queriesStr = searchQueries.join(', ');
    console.log(`[AI Engine] Dispatching batch request for queries: ${queriesStr}`);
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Search for comics matching each of these queries: [${queriesStr}].
      
      Requirements for EACH query:
      - Return a list of highly relevant matches.
      - If a query is gibberish, return an empty array [].
      - ONLY return real, existing comics (Manga, Manhwa, Manhua).
      - UP TO 10 results per query.
      - **CRITICAL**: If the user provides a very specific long title, prioritize finding THAT exact comic.
      - Include famous Manhua (Chinese) and Manhwa (Korean).
      - Return a JSON object where keys are the EXACT query strings provided and values are arrays of comic objects.
      
      Query List: ${queriesStr}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          description: "A map of search queries to arrays of comic results",
          properties: Object.fromEntries(searchQueries.map(q => [q, {
            type: Type.ARRAY,
            items: comicSchema
          }]))
        }
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
        
        const filteredResults = (results as any[]).map(data => ({
          title: data.title || query,
          type: (data.type || 'unknown').toLowerCase() as ComicType,
          status: mapStatus(data.status || 'unknown'),
          genres: data.genres || [],
          synopsis: data.synopsis || "No synopsis available.",
          originalLanguage: data.originalLanguage || "Unknown",
          author: data.author || "Unknown",
          releaseYear: data.releaseYear || "Unknown",
          rating: data.rating,
          altTitles: data.altTitles || []
        })).filter(comic => {
          // Rule: Only search for manhwa/manhua/manga, no novels or books
          const validTypes: ComicType[] = ['manga', 'manhwa', 'manhua'];
          if (!validTypes.includes(comic.type)) return false;
          
          return isRelevant(query, comic.title, comic.altTitles);
        }).map(comic => {
          // Rule: if a title is searched and the result is the same comic but different title, 
          // just find the one that the user put as the title because they may not know the title alternatives.
          const nQ = normalize(query);
          if (normalize(comic.title) !== nQ) {
            const matchingAlt = comic.altTitles.find(at => normalize(at) === nQ);
            if (matchingAlt) {
              return { ...comic, title: query }; // Use the user's exact query if it matched an alt title
            }
          }
          return comic;
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

  // Filter Jikan results: Robust relevance check + strict type filtering
  const relevantJikan = mappedJikan.filter(c => {
    // Only manga/manhwa/manhua
    const validTypes: ComicType[] = ['manga', 'manhwa', 'manhua'];
    if (!validTypes.includes(c.type)) return false;
    
    return isRelevant(title, c.title, c.altTitles);
  }).map(comic => {
    // Title matching override
    const nQ = normalize(title);
    if (normalize(comic.title) !== nQ) {
      const matchingAlt = comic.altTitles.find(at => normalize(at) === nQ);
      if (matchingAlt) {
        return { ...comic, title: title }; // Matches user query
      }
    }
    return comic;
  });

  // 2. Fetch Gemini Results 
  // We fetch Gemini results if we have few Jikan matches OR if it's likely a Manhua/Manhwa (often not on MAL)
  let geminiData: ComicInfo[] = [];
  if (relevantJikan.length < 1) {
    console.log(`[Lookup] Jikan results low or specific query, fetching Gemini...`);
    geminiData = await lookupComic(title);
  }

  // 3. Combine
  const seen = new Set<string>();
  const combined: ComicInfo[] = [];

  [...relevantJikan, ...geminiData].forEach(comic => {
    const titleKey = comic.title.toLowerCase().trim();
    if (!seen.has(titleKey)) {
      // Re-apply relevance check and type check for Gemini results
      const validTypes: ComicType[] = ['manga', 'manhwa', 'manhua'];
      if (validTypes.includes(comic.type) && isRelevant(title, comic.title, comic.altTitles)) {
        seen.add(titleKey);
        
        let processedComic = comic;
        const nQ = normalize(title);
        if (normalize(comic.title) !== nQ) {
          const matchingAlt = comic.altTitles.find(at => normalize(at) === nQ);
          if (matchingAlt) {
            processedComic = { ...comic, title: title };
          }
        }
        combined.push(processedComic);
      }
    }
  });

  console.log(`[Lookup] Combined results count: ${combined.length}`);

  // 4. Sort: Exact matches first, then partials
  return combined.sort((a, b) => {
    const nA = normalize(a.title);
    const nB = normalize(b.title);
    const nQ = normalize(title);
    const aExact = nA === nQ || a.altTitles.some(at => normalize(at) === nQ);
    const bExact = nB === nQ || b.altTitles.some(at => normalize(at) === nQ);
    
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
