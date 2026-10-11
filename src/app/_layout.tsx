
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, router, useSegments } from "expo-router";
import type { User } from "firebase/auth";

import { listenForAuthChanges } from "../firebase/auth";
import {
  requestSafetyNotificationPermission,
} from "../services/notificationService";

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const segments = useSegments();

  // Request notification permission only after authentication.
  // This includes users who continue as anonymous guests.
  useEffect(() => {
    if (checkingAuth || !user) return;

    let mounted = true;

    const requestPermission = async () => {
      try {
        const granted =
          await requestSafetyNotificationPermission();

        if (mounted) {
          console.log(
            granted
              ? "SafeRoute notifications are enabled."
              : "SafeRoute notification permission is not enabled."
          );
        }
      } catch (error) {
        console.warn(
          "Could not request notification permission:",
          error
        );
      }
    };

    void requestPermission();

    return () => {
      mounted = false;
    };
  }, [user, checkingAuth]);

  // Listen for Firebase authentication changes.
  useEffect(() => {
    const unsubscribe = listenForAuthChanges(
      (currentUser) => {
        setUser(currentUser);
        setCheckingAuth(false);
      }
    );

    return unsubscribe;
  }, []);

  // Preserve the existing authentication redirects.
  useEffect(() => {
    if (checkingAuth) return;

    const currentRoute = segments[0];

    // Signed-out users can access Welcome and Auth screens.
    if (!user) {
      if (
        currentRoute !== "index" &&
        currentRoute !== "auth"
      ) {
        router.replace("/");
      }

      return;
    }

    // Allow anonymous guests to access Login / Sign Up.
    // Redirect authenticated, non-anonymous accounts.
    if (
      currentRoute === "auth" &&
      !user.isAnonymous
    ) {
      router.replace("/(tabs)");
    }
  }, [user, checkingAuth, segments]);

  if (checkingAuth) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#07111F",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator
          size="large"
          color="#20C997"
        />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="map" />
    </Stack>
  );
}
