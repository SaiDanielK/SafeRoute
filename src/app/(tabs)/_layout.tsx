import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#20C997",
        tabBarInactiveTintColor: "#8A98A8",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="home"
              size={size}
              color={String(color)}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="safety"
        options={{
          title: "Safety",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="shield-checkmark"
              size={size}
              color={String(color)}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="trips"
        options={{
          title: "Trips",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="map"
              size={size}
              color={String(color)}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="emergency"
        options={{
          title: "Emergency",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="warning"
              size={size}
              color={String(color)}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="person"
              size={size}
              color={String(color)}
            />
          ),
        }}
      />
    </Tabs>
  );
}