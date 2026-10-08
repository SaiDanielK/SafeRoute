
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, router, useSegments } from "expo-router";
import { User } from "firebase/auth";

import { listenForAuthChanges } from "../firebase/auth";

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const segments = useSegments();

  useEffect(() => {
    const unsubscribe = listenForAuthChanges((currentUser) => {
      setUser(currentUser);
      setCheckingAuth(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (checkingAuth) return;

    const currentRoute = segments[0];

    if (!user) {
      if (currentRoute !== "index" && currentRoute !== "auth") {
        router.replace("/");
      }

      return;
    }

    if (currentRoute === "auth") {
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
        <ActivityIndicator size="large" color="#20C997" />
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