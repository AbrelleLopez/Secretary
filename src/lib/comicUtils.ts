import { ComicStatus } from '../types';

export function mapStatus(status: string | undefined): ComicStatus {
  if (!status) return 'unknown';
  const s = status.toLowerCase();
  if (s.includes('ongoing') || s.includes('publishing') || s.includes('releasing') || s.includes('on-going') || s.includes('serial')) return 'ongoing';
  if (s.includes('finished') || s.includes('complete') || s.includes('completed')) return 'finished';
  if (s.includes('hiatus') || s.includes('on hold')) return 'hiatus';
  if (s.includes('cancelled') || s.includes('canceled')) return 'cancelled';
  if (s.includes('discontinued') || s.includes('dropped')) return 'discontinued';
  return 'unknown';
}

export function normalize(s: string | undefined): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

export function isRelevant(query: string, title: string, altTitles: string[]): boolean {
  const nQ = normalize(query);
  if (!nQ) return true;
  
  const searchWords = nQ.split(' ').filter(w => w.length > 2);
  
  const check = (t: string) => {
    const nT = normalize(t);
    if (!nT) return false;
    if (nT.includes(nQ) || nQ.includes(nT)) return true;
    
    if (searchWords.length === 0) return false;
    
    const targetWords = new Set(nT.split(' ').filter(w => w.length > 2));
    let matches = 0;
    searchWords.forEach(w => { if (targetWords.has(w)) matches++; });
    
    // For longer queries, require more overlap to avoid unrelated results
    if (searchWords.length >= 4) {
      return matches >= Math.max(2, Math.ceil(searchWords.length * 0.5));
    }
    return matches >= 1;
  };

  if (check(title)) return true;
  return (altTitles || []).some(at => check(at));
}
