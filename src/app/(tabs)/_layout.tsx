import React from "react";
import { Platform, Pressable } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { Ionicons } from "@expo/vector-icons";

function AndroidTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#20C997",
        tabBarInactiveTintColor: "#8190A5",
        tabBarStyle: {
          backgroundColor: "#07111F",
          borderTopColor: "#1B2B3D",
          borderTopWidth: 1,
          height: 70,
          paddingTop: 5,
          paddingBottom: 10,
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarButton: (props) => (
          <Pressable
            onPress={props.onPress}
            onLongPress={props.onLongPress}
            accessibilityRole="button"
            accessibilityState={props.accessibilityState}
            accessibilityLabel={props.accessibilityLabel}
            testID={props.testID}
            android_ripple={{
              color: "rgba(32, 201, 151, 0.22)",
              borderless: false,
              radius: 40,
            }}
            style={[
              props.style,
              {
                borderRadius: 28,
                overflow: "hidden",
                marginHorizontal: 0,
              },
            ]}
          >
            {props.children}
          </Pressable>
        ),
        
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size + (focused ? 2 : 0)}
              color={String(color)}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="safety"
        options={{
          title: "Safety",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "shield-checkmark" : "shield-checkmark-outline"}
              size={size + (focused ? 2 : 0)}
              color={String(color)}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="trips"
        options={{
          title: "Trips",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "map" : "map-outline"}
              size={size + (focused ? 2 : 0)}
              color={String(color)}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="emergency"
        options={{
          title: "Emergency",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "warning" : "warning-outline"}
              size={size + (focused ? 2 : 0)}
              color={String(color)}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={size + (focused ? 2 : 0)}
              color={String(color)}
            />
          ),
        }}
      />
    </Tabs>
  );
}

function IOSTabs() {
  return (
    <NativeTabs tintColor="#20C997">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="safety">
        <NativeTabs.Trigger.Label>Safety</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="shield.fill" md="security" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="trips">
        <NativeTabs.Trigger.Label>Trips</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="map.fill" md="map" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="emergency">
        <NativeTabs.Trigger.Label>Emergency</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="exclamationmark.triangle.fill"
          md="warning"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.fill" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

export default function TabLayout() {
  return Platform.OS === "ios" ? <IOSTabs /> : <AndroidTabs />;
}