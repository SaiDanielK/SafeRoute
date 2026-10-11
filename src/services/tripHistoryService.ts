import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { firebaseApp } from "../firebase/firebaseConfig";
import { firebaseAuth } from "../firebase/auth";

const db = getFirestore(firebaseApp);

export type CompletedTrip = {
  originName: string;
  destinationName: string;
  distanceMeters: number;
  durationSeconds: number;
  safetyScore: number | null;
  travelMode: string;
  originLatitude?: number;
  originLongitude?: number;
  destinationLatitude: number;
  destinationLongitude: number;
};

export type RecentTrip = CompletedTrip & {
  id: string;
  userId: string;
  completedAt: unknown;
};

export async function saveCompletedTrip(
  trip: CompletedTrip
): Promise<void> {
  const user = firebaseAuth.currentUser;

  if (!user) {
    throw new Error("Sign in to save your trip history.");
  }

  await addDoc(collection(db, "trips"), {
    ...trip,
    userId: user.uid,
    completedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
}

export async function getRecentTrips(
  limitCount = 5
): Promise<RecentTrip[]> {
  const user = firebaseAuth.currentUser;

  if (!user) {
    return [];
  }

  const tripsQuery = query(
    collection(db, "trips"),
    where("userId", "==", user.uid),
    orderBy("completedAt", "desc")
  );

  const snapshot = await getDocs(tripsQuery);

  return snapshot.docs
    .map((document) => ({
      id: document.id,
      ...document.data(),
    }) as RecentTrip)
    .slice(0, Math.max(1, limitCount));
}