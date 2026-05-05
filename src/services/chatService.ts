import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { ChatMessage } from '../types';

const COLLECTION_NAME = 'chat_messages';

export async function sendMessage(message: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required");

  await addDoc(collection(db, COLLECTION_NAME), {
    userId: user.uid,
    userName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
    userEmail: user.email,
    message,
    timestamp: serverTimestamp()
  });
}

export function subscribeToChat(callback: (messages: ChatMessage[]) => void) {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy('timestamp', 'desc'),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: (data.timestamp as Timestamp)?.toDate() || new Date()
      } as ChatMessage;
    }).reverse(); // Order by time ascending for UI
    
    callback(messages);
  });
}
