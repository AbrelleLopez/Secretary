export type ComicType = 'manga' | 'manhwa' | 'manhua' | 'novel' | 'light novel' | 'one-shot' | 'doujinshi' | 'unknown' | string;
export type ComicStatus = 'ongoing' | 'finished' | 'hiatus' | 'cancelled' | 'discontinued' | 'unknown' | string;

export interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: 'status_change' | 'info';
  timestamp: any;
  read: boolean;
  comicId?: string;
}

export interface ChatMessage {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  message: string;
  timestamp: any;
}

export interface ComicInfo {
  title: string;
  type: ComicType;
  status: ComicStatus;
  genres: string[];
  synopsis?: string;
  originalLanguage?: string;
  author?: string;
  releaseYear?: string;
  rating?: string;
  altTitles?: string[];
  id?: string;
  userId?: string;
  timestamp?: any;
  dropped?: boolean;
}
