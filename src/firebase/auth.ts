
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import { firebaseApp } from "./firebaseConfig";

import { getAuth } from "firebase/auth";

export const firebaseAuth = getAuth(firebaseApp);

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