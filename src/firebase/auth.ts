
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  initializeAuth,
  getAuth,
  type User,
} from "firebase/auth";

import type { Persistence } from "firebase/auth";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { firebaseApp } from "./firebaseConfig";

// React Native Firebase Auth persistence compatibility.
// The React Native persistence function may be missing from
// Firebase's TypeScript exports in some SDK versions.
type ReactNativePersistenceFactory = (
  storage: typeof AsyncStorage
) => Persistence;

function getNativePersistence(): Persistence | null {
  try {
    const authModule = require("firebase/auth") as {
      getReactNativePersistence?: ReactNativePersistenceFactory;
    };

    if (typeof authModule.getReactNativePersistence !== "function") {
      return null;
    }

    return authModule.getReactNativePersistence(AsyncStorage);
  } catch {
    return null;
  }
}

// Initialize Firebase Auth with persistent storage when available.
// If Auth has already been initialized, reuse the existing instance.
function createFirebaseAuth() {
  try {
    const persistence = getNativePersistence();

    if (persistence) {
      return initializeAuth(firebaseApp, { persistence });
    }

    return getAuth(firebaseApp);
  } catch {
    return getAuth(firebaseApp);
  }
}

export const firebaseAuth = createFirebaseAuth();

// SIGN UP
export async function signUp(
  email: string,
  password: string
): Promise<User> {
  const result = await createUserWithEmailAndPassword(
    firebaseAuth,
    email.trim(),
    password
  );

  return result.user;
}

// LOG IN
export async function logIn(
  email: string,
  password: string
): Promise<User> {
  const result = await signInWithEmailAndPassword(
    firebaseAuth,
    email.trim(),
    password
  );

  return result.user;
}

// GUEST SIGN IN
export async function signInGuest(): Promise<User> {
  if (firebaseAuth.currentUser) {
    return firebaseAuth.currentUser;
  }

  const result = await signInAnonymously(firebaseAuth);

  return result.user;
}

// LOG OUT
export async function logOut(): Promise<void> {
  await signOut(firebaseAuth);
}

// LISTEN FOR AUTH CHANGES
export function listenForAuthChanges(
  callback: (user: User | null) => void
) {
  return onAuthStateChanged(firebaseAuth, callback);
}
