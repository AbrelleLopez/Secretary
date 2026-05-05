const JIKAN_BASE_URL = "https://api.jikan.moe/v4";

export interface JikanManga {
  title: string;
  synopsis: string;
  authors: { name: string }[];
  published: { from: string };
  status: string;
  type: string;
}

export async function lookupTitleFromJikan(title: string): Promise<JikanManga | null> {
  try {
    // Jikan search endpoint for manga
    const response = await fetch(`${JIKAN_BASE_URL}/manga?q=${encodeURIComponent(title)}&limit=1`);
    if (!response.ok) {
      if (response.status === 429) {
        console.warn("[Jikan] Rate limit hit, skipping...");
      }
      return null;
    }
    
    const data = await response.json();

    if (data.data && data.data.length > 0) {
      return data.data[0];
    }
    return null;
  } catch (error) {
    console.error("[Jikan] lookup failed:", error);
    return null;
  }
}
