import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export async function isUserAllowed(email: string): Promise<boolean> {
  try {
    // In Firestore, document IDs are strings. We use the email as the ID.
    const docRef = doc(db, "allowedUsers", email);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (error) {
    console.error("Whitelist check failed:", error);
    return false;
  }
}
