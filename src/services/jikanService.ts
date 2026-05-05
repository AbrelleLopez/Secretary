const JIKAN_BASE_URL = "https://api.jikan.moe/v4";

export interface JikanManga {
  title: string;
  synopsis: string;
  authors: { name: string }[];
  published: { from: string };
  status: string;
  type: string;
  genres: { name: string }[];
  titles: { type: string; title: string }[];
}

export async function lookupTitlesFromJikan(title: string, limit = 20): Promise<JikanManga[]> {
  try {
    // Jikan search endpoint for manga
    const response = await fetch(`${JIKAN_BASE_URL}/manga?q=${encodeURIComponent(title)}&limit=${limit}`);
    if (!response.ok) {
      if (response.status === 429) {
        console.warn("[Jikan] Rate limit hit, skipping...");
      }
      return [];
    }
    
    const data = await response.json();

    if (data.data && Array.isArray(data.data)) {
      return data.data;
    }
    return [];
  } catch (error) {
    console.error("[Jikan] lookup failed:", error);
    return [];
  }
}
