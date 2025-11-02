import { db } from "../../../config/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

export async function createOrGetConversation(hostId, guestId) {
  const convRef = collection(db, "Conversations");

  // Step 1: Find all conversations where guestId is a member
  const q = query(convRef, where("members", "array-contains", guestId));
  const snap = await getDocs(q);

  // Step 2: Check if any existing conversation includes the hostId too
  let existingConv = null;
  snap.forEach((doc) => {
    const data = doc.data();
    if (data.members.includes(hostId)) {
      existingConv = doc;
    }
  });

  if (existingConv) {
    return existingConv.id;
  }

  // Step 3: If not found, create new conversation
  const newConv = await addDoc(convRef, {
    members: [hostId, guestId],
    updatedAt: serverTimestamp(),
    lastMessage: "",
  });

  return newConv.id;
}
