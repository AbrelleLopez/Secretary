import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  serverTimestamp,
  Timestamp,
  updateDoc,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { ComicInfo } from '../types';
import { mapStatus } from '../lib/comicUtils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function cleanData(data: any) {
  const clean: any = {};
  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      clean[key] = data[key];
    }
  });
  return clean;
}

export async function saveRecentRead(comic: ComicInfo) {
  const user = auth.currentUser;
  if (!user) return;

  const path = 'recent_reads';
  try {
    // Check if it already exists to prevent duplicates in the specific list
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid),
      where('title', '==', comic.title)
    );
    const existing = await getDocs(q);
    
    if (existing.empty) {
      // Essential fields must be strings or expected types
      const dataToSave = cleanData({
        title: comic.title || 'Unknown Title',
        type: comic.type || 'unknown',
        status: mapStatus(comic.status || 'unknown'),
        genres: comic.genres || [],
        userId: user.uid,
        timestamp: serverTimestamp(),
        dropped: false,
        synopsis: comic.synopsis,
        author: comic.author,
        releaseYear: comic.releaseYear,
        originalLanguage: comic.originalLanguage,
        altTitles: comic.altTitles,
        rating: comic.rating
      });
      await addDoc(collection(db, path), dataToSave);
    } else {
      // Update its timestamp and info to refresh data
      const docRef = doc(db, path, existing.docs[0].id);
      await updateDoc(docRef, {
        status: mapStatus(comic.status || 'unknown'),
        genres: comic.genres,
        synopsis: comic.synopsis,
        author: comic.author,
        releaseYear: comic.releaseYear,
        originalLanguage: comic.originalLanguage,
        altTitles: comic.altTitles,
        rating: comic.rating,
        timestamp: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function toggleDropStatus(comicId: string, status: boolean) {
  const path = 'recent_reads';
  try {
    const docRef = doc(db, path, comicId);
    await updateDoc(docRef, {
      dropped: status,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateComic(comicId: string, data: Partial<ComicInfo>) {
  const path = 'recent_reads';
  try {
    const docRef = doc(db, path, comicId);
    const cleaned = cleanData(data);
    if (cleaned.status) {
      cleaned.status = mapStatus(cleaned.status);
    }
    await updateDoc(docRef, {
      ...cleaned,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteComic(comicId: string) {
  const path = 'recent_reads';
  console.log(`[Firestore] Attempting to purge document: ${comicId} in ${path}`);
  try {
    const docRef = doc(db, path, comicId);
    await deleteDoc(docRef);
    console.log(`[Firestore] Purge successful: ${comicId}`);
  } catch (error) {
    console.error(`[Firestore] Purge failed: ${comicId}`, error);
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function getCollection(dropped: boolean = false): Promise<ComicInfo[]> {
  const user = auth.currentUser;
  if (!user) return [];

  const path = 'recent_reads';
  try {
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid),
      where('dropped', '==', dropped),
      orderBy('timestamp', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        status: mapStatus(data.status || 'unknown'),
        timestamp: (data.timestamp as Timestamp)?.toDate() || new Date()
      } as ComicInfo;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function getRecentReads(): Promise<ComicInfo[]> {
  const user = auth.currentUser;
  if (!user) return [];

  const path = 'recent_reads';
  try {
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        status: mapStatus(data.status || 'unknown'),
        timestamp: (data.timestamp as Timestamp)?.toDate() || new Date()
      } as ComicInfo;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}
