import { GoogleGenAI, Type } from "@google/genai";
import { ComicInfo, ComicType, ComicStatus } from "../types";
import { lookupTitleFromJikan } from "./jikanService";

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

export async function lookupComicsBatch(searchQueries: string[]): Promise<Record<string, ComicInfo[]>> {
  if (searchQueries.length === 0) return {};

  return retryLookup(async () => {
    const queriesStr = searchQueries.join(', ');
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for comics matching each of these queries: [${queriesStr}].
      
      Requirements for EACH query:
      - Return a list of highly relevant matches.
      - UP TO 10 results if generic (e.g. "Action"), 1-3 results if specific (e.g. "Inso's Law").
      - Only real, existing comics.
      - Handle punctuation variations strictly (e.g. "Inso's Law" should match "Inso's Law", "Inso's Law (webtoon)", "My Life as an Internet Novelist").
      - Return a JSON object where keys are the EXACT query strings provided and values are arrays of comic objects.

      Comic Object Structure:
      - title, type (manga/manhwa/manhua), status (ongoing/finished/hiatus/cancelled/unknown), genres, synopsis, author, releaseYear, originalLanguage, altTitles.
      
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
        // Try exact match, then case-insensitive match
        let results = batchResults[query];
        if (!results) {
          const lowerQuery = query.toLowerCase();
          const foundKey = Object.keys(batchResults).find(k => k.toLowerCase() === lowerQuery);
          if (foundKey) results = batchResults[foundKey];
        }
        
        results = results || [];
        normalized[query] = (results as any[]).map(data => ({
          title: data.title || query,
          type: (data.type || 'unknown').toLowerCase() as ComicType,
          status: (data.status || 'unknown').toLowerCase() as ComicStatus,
          genres: data.genres || [],
          synopsis: data.synopsis || "Manual entry required.",
          originalLanguage: data.originalLanguage || "Unknown",
          author: data.author || "Unknown",
          releaseYear: data.releaseYear || "Unknown",
          rating: data.rating,
          altTitles: data.altTitles || []
        }));
      });
      
      return normalized;
    } catch (err) {
      console.error("[AI Engine] Failed to parse batch JSON:", err);
      return {};
    }
  });
}

export async function lookupComicHybrid(title: string): Promise<ComicInfo[]> {
  // 1. Try Jikan
  const jikanResult = await lookupTitleFromJikan(title);
  
  if (jikanResult) {
    return [{
      title: jikanResult.title,
      type: (jikanResult.type || 'unknown').toLowerCase() as ComicType,
      status: (jikanResult.status || 'unknown').toLowerCase() as ComicStatus,
      genres: [jikanResult.status, jikanResult.type].filter(Boolean), // Generic mapping or extract from Jikan if needed
      synopsis: jikanResult.synopsis || "No synopsis available.",
      author: jikanResult.authors?.[0]?.name || "Unknown",
      releaseYear: jikanResult.published?.from ? new Date(jikanResult.published.from).getFullYear().toString() : "Unknown",
      originalLanguage: "Japanese", // Jikan is MyAnimeList, so mostly Japanese
      altTitles: []
    }];
  }

  // 2. Fallback to Gemini
  return await lookupComic(title);
}

export async function lookupComicsBatchHybrid(titles: string[]): Promise<Record<string, ComicInfo[]>> {
  const finalResults: Record<string, ComicInfo[]> = {};
  const missedTitles: string[] = [];

  // Check Jikan first for all titles (with small delay)
  for (const title of titles) {
    const jikanResult = await lookupTitleFromJikan(title);
    if (jikanResult) {
      finalResults[title] = [{
        title: jikanResult.title,
        type: (jikanResult.type || 'unknown').toLowerCase() as ComicType,
        status: (jikanResult.status || 'unknown').toLowerCase() as ComicStatus,
        genres: [jikanResult.status, jikanResult.type].filter(Boolean),
        synopsis: jikanResult.synopsis || "No synopsis available.",
        author: jikanResult.authors?.[0]?.name || "Unknown",
        releaseYear: jikanResult.published?.from ? new Date(jikanResult.published.from).getFullYear().toString() : "Unknown",
        originalLanguage: "Japanese",
        altTitles: []
      }];
    } else {
      missedTitles.push(title);
    }
    // Rate limit delay for Jikan
    await new Promise(resolve => setTimeout(resolve, 350));
  }

  // Batch process missed titles with Gemini
  if (missedTitles.length > 0) {
    const geminiResults = await lookupComicsBatch(missedTitles);
    Object.assign(finalResults, geminiResults);
  }

  return finalResults;
}

export async function lookupComic(title: string): Promise<ComicInfo[]> {
  const result = await lookupComicsBatch([title]);
  return result[title] || [];
}
