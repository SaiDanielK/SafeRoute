import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  getFirestore,
} from "firebase/firestore";

import { firebaseApp } from "../firebase/firebaseConfig";
import { firebaseAuth } from "../firebase/auth";

const db = getFirestore(firebaseApp);
const HAZARDS_COLLECTION = "communityHazards";
const REQUEST_TIMEOUT_MS = 15000;

export type HazardType =
  | "accident"
  | "road_closed"
  | "construction"
  | "unsafe_area"
  | "flooding"
  | "debris"
  | "traffic"
  | "other";

export type CommunityHazard = {
  id: string;
  type: HazardType;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  createdAt: unknown;
  reportedBy: string;
};

function withTimeout<T>(
  promise: Promise<T>,
  operation: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(
        new Error(
          `${operation} timed out after 15 seconds. Check your internet connection and Firebase Firestore configuration.`
        )
      );
    }, REQUEST_TIMEOUT_MS);

    promise.then(
      (result) => {
        clearTimeout(timeoutId);
        resolve(result);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);

        if (error instanceof Error) {
          reject(error);
        } else {
          reject(new Error(String(error)));
        }
      }
    );
  });
}

function getReadableError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    const code = String(error.code);

    if (code.includes("permission-denied")) {
      return "Firebase denied this report. Check your Firestore security rules.";
    }

    if (code.includes("unauthenticated")) {
      return "Your session has expired. Please sign in again.";
    }

    if (code.includes("unavailable")) {
      return "Firestore is unavailable. Check your internet connection.";
    }

    if (code.includes("failed-precondition")) {
      return "Firestore rejected this operation because its configuration or required index is missing.";
    }
  }

  return error instanceof Error
    ? error.message
    : "An unexpected error occurred while accessing Firestore.";
}

export async function reportHazard({
  type,
  title,
  description,
  latitude,
  longitude,
}: {
  type: HazardType;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
}): Promise<string> {
  const user = firebaseAuth.currentUser;

  if (!user) {
    throw new Error("You must be signed in to report a hazard.");
  }

  const cleanTitle = title.trim();
  const cleanDescription = description.trim();

  if (!cleanTitle) {
    throw new Error("Please enter a hazard title.");
  }

  if (!cleanDescription) {
    throw new Error("Please describe the hazard.");
  }

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("A valid location is required.");
  }

  try {
    console.log("[SafeRoute] Submitting hazard report...");

    const hazardRef = await withTimeout(
      addDoc(collection(db, HAZARDS_COLLECTION), {
        type,
        title: cleanTitle,
        description: cleanDescription,
        latitude,
        longitude,
        reportedBy: user.uid,
        createdAt: serverTimestamp(),
      }),
      "Submitting hazard report"
    );

    console.log(
      "[SafeRoute] Hazard report saved:",
      hazardRef.id
    );

    return hazardRef.id;
  } catch (error: unknown) {
    const message = getReadableError(error);

    console.error("[SafeRoute] Hazard submission failed:", error);

    throw new Error(message);
  }
}

export async function getRecentHazards(
  maxResults = 50
): Promise<CommunityHazard[]> {
  try {
    const hazardsQuery = query(
      collection(db, HAZARDS_COLLECTION),
      orderBy("createdAt", "desc"),
      limit(maxResults)
    );

    const snapshot = await withTimeout(
      getDocs(hazardsQuery),
      "Loading community hazards"
    );

    return snapshot.docs.map((document) => {
      const data = document.data();

      return {
        id: document.id,
        type: data.type as HazardType,
        title: data.title ?? "Community Hazard",
        description: data.description ?? "",
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        createdAt: data.createdAt ?? null,
        reportedBy: data.reportedBy ?? "",
      };
    });
  } catch (error: unknown) {
    const message = getReadableError(error);

    console.error("[SafeRoute] Loading hazards failed:", error);

    throw new Error(message);
  }
}