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

let lastJikanCall = 0;
const JIKAN_COOLDOWN = 1000; // 1 second between calls to be safe for deployment

export async function lookupTitlesFromJikan(title: string, limit = 20): Promise<JikanManga[]> {
  try {
    // Basic rate limiting check
    const now = Date.now();
    const timeSinceLastCall = now - lastJikanCall;
    if (timeSinceLastCall < JIKAN_COOLDOWN) {
      await new Promise(resolve => setTimeout(resolve, JIKAN_COOLDOWN - timeSinceLastCall));
    }
    lastJikanCall = Date.now();

    // Jikan search endpoint for manga
    const response = await fetch(`${JIKAN_BASE_URL}/manga?q=${encodeURIComponent(title)}&limit=${limit}`);
    if (!response.ok) {
      if (response.status === 429) {
        console.warn("[Jikan] Rate limit hit (429). Falling back to AI.");
      } else {
        console.warn(`[Jikan] API error: ${response.status}. Falling back to AI.`);
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
