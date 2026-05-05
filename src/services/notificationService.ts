import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Notification, ComicInfo } from '../types';
import { lookupTitleFromJikan } from './jikanService';

export async function getNotifications(): Promise<Notification[]> {
  const user = auth.currentUser;
  if (!user) return [];

  const path = 'notifications';
  try {
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      ...d.data(),
      id: d.id,
      timestamp: (d.data().timestamp as Timestamp)?.toDate() || new Date()
    } as Notification));
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return [];
  }
}

export async function markAsRead(notificationId: string) {
  try {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, { read: true });
  } catch (error) {
    console.error("Failed to mark as read:", error);
  }
}

export async function deleteNotification(notificationId: string) {
  try {
    const docRef = doc(db, 'notifications', notificationId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Failed to delete notification:", error);
  }
}

export async function checkForUpdates(comics: ComicInfo[]) {
  const user = auth.currentUser;
  if (!user || comics.length === 0) return;

  console.log(`[Background Check] Starting status verification for ${comics.length} comics...`);

  for (const comic of comics) {
    // Only check if it's not already finished
    if (comic.status === 'finished') continue;

    try {
      const freshData = await lookupTitleFromJikan(comic.title);
      if (freshData) {
        const newStatus = (freshData.status || 'unknown').toLowerCase();
        
        // If status changed to finished
        if (newStatus === 'finished') {
          await createNotification({
            userId: user.uid,
            title: 'Comic Finished!',
            message: `"${comic.title}" is now marked as finished.`,
            type: 'status_change',
            timestamp: serverTimestamp(),
            read: false,
            comicId: comic.id
          });

          // Also update the comic in the library
          if (comic.id) {
            const comicRef = doc(db, 'recent_reads', comic.id);
            await updateDoc(comicRef, { 
              status: 'finished',
              timestamp: serverTimestamp() // Keep it active if desired, or just update status
            });
          }
        }
      }
      
      // Respect Jikan rate limit
      await new Promise(r => setTimeout(r, 400));
    } catch (error) {
      console.warn(`[Background Check] Failed for ${comic.title}:`, error);
    }
  }
}

async function createNotification(notif: Notification) {
  try {
    // Avoid double notifications for the same event
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', notif.userId),
      where('comicId', '==', notif.comicId),
      where('type', '==', notif.type),
      limit(1)
    );
    const existing = await getDocs(q);
    if (existing.empty) {
      await addDoc(collection(db, 'notifications'), notif);
    }
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}
