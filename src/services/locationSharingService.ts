import * as Location from "expo-location";
import { Share } from "react-native";
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { firebaseApp } from "../firebase/firebaseConfig";
import { firebaseAuth } from "../firebase/auth";

const db = getFirestore(firebaseApp);
const COLLECTION = "locationShares";

export type LocationShareStatus = {
  active: boolean;
  userId: string;
  latitude: number | null;
  longitude: number | null;
  mapUrl: string | null;
  updatedAt: Date | null;
};

const EMPTY_STATUS: LocationShareStatus = {
  active: false,
  userId: "",
  latitude: null,
  longitude: null,
  mapUrl: null,
  updatedAt: null,
};

function toDate(value: unknown): Date | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate();
  }

  return null;
}

function readStatus(
  data: Record<string, unknown> | undefined
): LocationShareStatus {
  if (!data) return EMPTY_STATUS;

  return {
    active: data.active === true,
    userId: String(data.userId ?? ""),
    latitude:
      typeof data.latitude === "number" ? data.latitude : null,
    longitude:
      typeof data.longitude === "number" ? data.longitude : null,
    mapUrl: typeof data.mapUrl === "string" ? data.mapUrl : null,
    updatedAt: toDate(data.updatedAt),
  };
}

function getShareDocument() {
  const user = firebaseAuth.currentUser;

  if (!user) {
    throw new Error("Sign in to use location sharing.");
  }

  return {
    user,
    reference: doc(db, COLLECTION, user.uid),
  };
}

export function subscribeToLocationSharing(
  callback: (status: LocationShareStatus) => void,
  onError?: (error: Error) => void
) {
  const user = firebaseAuth.currentUser;

  if (!user) {
    callback(EMPTY_STATUS);
    onError?.(new Error("Sign in to use location sharing."));
    return () => {};
  }

  return onSnapshot(
    doc(db, COLLECTION, user.uid),
    (snapshot) => {
      callback(readStatus(
        snapshot.exists()
          ? snapshot.data()
          : undefined
      ));
    },
    (error) => {
      console.error("Location-sharing listener failed:", error);
      onError?.(error);
    }
  );
}

export async function startLocationSharing(): Promise<string> {
  const { user, reference } = getShareDocument();

  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error(
      "Location permission is required. Allow SafeRoute to access your location and try again."
    );
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const mapUrl =
    `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  const existing = await getDoc(reference);

  await setDoc(
    reference,
    {
      userId: user.uid,
      active: true,
      latitude,
      longitude,
      mapUrl,
      updatedAt: serverTimestamp(),
      ...(existing.exists()
        ? {}
        : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );

  const result = await Share.share({
    title: "My SafeRoute location",
    message: `Here is my current location:\n${mapUrl}`,
    url: mapUrl,
  });

  // If the user cancels the share sheet, sharing stays active
  // until they explicitly stop it in SafeRoute.
  return result.action === Share.sharedAction ? mapUrl : mapUrl;
}

export async function stopLocationSharing(): Promise<void> {
  const { reference } = getShareDocument();

  await setDoc(
    reference,
    {
      active: false,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}