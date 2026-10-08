import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { firebaseAuth } from "../../firebase/auth";

export default function ProfileTab() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [nightSafetyEnabled, setNightSafetyEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  const showComingSoon = (feature: string) => {
    Alert.alert(
      feature,
      "This feature will be connected to your SafeRoute account later."
    );
  };
  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of SafeRoute?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut(firebaseAuth);
              router.replace("/sign-in");
            } catch (error) {
              Alert.alert(
                "Sign Out Failed",
                "We couldn't sign you out. Please try again."
              );
            }
          },
        },
      ]
    );
  };
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SAFEROUTE PROFILE</Text>
            <Text style={styles.title}>Profile</Text>
          </View>

          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>✓</Text>
          </View>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>🛡️</Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.name}>SafeRoute User</Text>
            <Text style={styles.email}>Guest account</Text>

            <View style={styles.memberBadge}>
              <Text style={styles.memberBadgeText}>SAFE TRAVELER</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.pressed,
            ]}
            onPress={() => showComingSoon("Edit Profile")}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        </View>

        {/* Safety Score */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreLeft}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreNumber}>92</Text>
              <Text style={styles.scoreSmall}>/100</Text>
            </View>

            <View>
              <Text style={styles.scoreTitle}>Safety Score</Text>
              <Text style={styles.scoreSubtitle}>
                You're making safer choices
              </Text>
            </View>
          </View>

          <View style={styles.scoreArrow}>
            <Text style={styles.arrowText}>›</Text>
          </View>
        </View>

        {/* Account */}
        <Text style={styles.sectionTitle}>ACCOUNT</Text>

        <View style={styles.sectionCard}>
          <Pressable
            style={({ pressed }) => [
              styles.menuRow,
              pressed && styles.rowPressed,
            ]}
            onPress={() => showComingSoon("Personal Information")}
          >
            <View style={styles.iconBox}>
              <Text style={styles.icon}>👤</Text>
            </View>

            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>Personal Information</Text>
              <Text style={styles.menuSubtitle}>
                Name, profile and preferences
              </Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [
              styles.menuRow,
              pressed && styles.rowPressed,
            ]}
            onPress={() => showComingSoon("Trusted Contacts")}
          >
            <View style={styles.iconBox}>
              <Text style={styles.icon}>👥</Text>
            </View>

            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>Trusted Contacts</Text>
              <Text style={styles.menuSubtitle}>
                People who can receive your trip
              </Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [
              styles.menuRow,
              pressed && styles.rowPressed,
            ]}
            onPress={() => showComingSoon("Saved Places")}
          >
            <View style={styles.iconBox}>
              <Text style={styles.icon}>📍</Text>
            </View>

            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>Saved Places</Text>
              <Text style={styles.menuSubtitle}>
                Home, school and favorite places
              </Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        {/* Safety Settings */}
        <Text style={styles.sectionTitle}>SAFETY SETTINGS</Text>

        <View style={styles.sectionCard}>
          <View style={styles.settingRow}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>🔔</Text>
            </View>

            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>Safety Alerts</Text>
              <Text style={styles.menuSubtitle}>
                Get notified about nearby hazards
              </Text>
            </View>

            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>🌙</Text>
            </View>

            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>Night Safety Mode</Text>
              <Text style={styles.menuSubtitle}>
                Prioritize safer routes after dark
              </Text>
            </View>

            <Switch
              value={nightSafetyEnabled}
              onValueChange={setNightSafetyEnabled}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>📍</Text>
            </View>

            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>Location Services</Text>
              <Text style={styles.menuSubtitle}>
                Allow SafeRoute to use your location
              </Text>
            </View>

            <Switch
              value={locationEnabled}
              onValueChange={setLocationEnabled}
            />
          </View>
        </View>

        {/* Appearance */}
        <Text style={styles.sectionTitle}>APP</Text>

        <View style={styles.sectionCard}>
          <Pressable
            style={({ pressed }) => [
              styles.menuRow,
              pressed && styles.rowPressed,
            ]}
            onPress={() => showComingSoon("Appearance")}
          >
            <View style={styles.iconBox}>
              <Text style={styles.icon}>🎨</Text>
            </View>

            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>Appearance</Text>
              <Text style={styles.menuSubtitle}>Dark mode enabled</Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [
              styles.menuRow,
              pressed && styles.rowPressed,
            ]}
            onPress={() => showComingSoon("Privacy & Security")}
          >
            <View style={styles.iconBox}>
              <Text style={styles.icon}>🔒</Text>
            </View>

            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>Privacy & Security</Text>
              <Text style={styles.menuSubtitle}>
                Manage your data and permissions
              </Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [
              styles.menuRow,
              pressed && styles.rowPressed,
            ]}
            onPress={() => showComingSoon("Help & Support")}
          >
            <View style={styles.iconBox}>
              <Text style={styles.icon}>❓</Text>
            </View>

            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>Help & Support</Text>
              <Text style={styles.menuSubtitle}>
                Get help using SafeRoute
              </Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.pressed,
          ]}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutIcon}>↪</Text>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        {/* Emergency Shortcut */}
        <Pressable
          style={({ pressed }) => [
            styles.emergencyCard,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/emergency")}
        >
          <View style={styles.emergencyIcon}>
            <Text style={styles.emergencyIconText}>🚨</Text>
          </View>

          <View style={styles.emergencyText}>
            <Text style={styles.emergencyTitle}>Emergency Center</Text>
            <Text style={styles.emergencySubtitle}>
              Quickly access emergency tools
            </Text>
          </View>

          <Text style={styles.emergencyArrow}>›</Text>
        </Pressable>

        {/* App Info */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>SafeRoute</Text>
          <Text style={styles.footerText}>
            Safer routes. Smarter decisions.
          </Text>
          <Text style={styles.version}>Version 1.0.0 • Congressional App Challenge</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07111F",
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 63,
    paddingBottom: 30,
    justifyContent: "center",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  eyebrow: {
    color: "#6F8AA5",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 4,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
  },

  headerBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#102338",
    borderWidth: 1,
    borderColor: "#1D3A56",
    alignItems: "center",
    justifyContent: "center",
  },

  headerBadgeText: {
    color: "#4ADE80",
    fontSize: 22,
    fontWeight: "800",
  },

  profileCard: {
    backgroundColor: "#0D1B2A",
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#19334B",
    marginBottom: 16,
  },

  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#142B43",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  avatarText: {
    fontSize: 32,
  },

  profileInfo: {
    flex: 1,
  },

  name: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 3,
  },

  email: {
    color: "#8195AA",
    fontSize: 13,
    marginBottom: 8,
  },

  memberBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#12352B",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  memberBadgeText: {
    color: "#4ADE80",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  editButton: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#142B43",
  },

  editButtonText: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "800",
  },

  scoreCard: {
    backgroundColor: "#0D1B2A",
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#19334B",
    marginBottom: 26,
  },

  scoreLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  scoreCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 4,
    borderColor: "#4ADE80",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  scoreNumber: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
  },

  scoreSmall: {
    color: "#71869B",
    fontSize: 9,
    marginTop: -2,
  },

  scoreTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },

  scoreSubtitle: {
    color: "#8195AA",
    fontSize: 12,
  },

  scoreArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#142B43",
    alignItems: "center",
    justifyContent: "center",
  },

  arrowText: {
    color: "#7DD3FC",
    fontSize: 24,
    marginTop: -2,
  },

  sectionTitle: {
    color: "#6F8AA5",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 10,
    marginLeft: 4,
  },

  sectionCard: {
    backgroundColor: "#0D1B2A",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#19334B",
    marginBottom: 24,
    overflow: "hidden",
  },

  menuRow: {
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  settingRow: {
    minHeight: 82,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  rowPressed: {
    backgroundColor: "#102438",
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#142B43",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  icon: {
    fontSize: 19,
  },

  menuText: {
    flex: 1,
  },

  menuTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },

  menuSubtitle: {
    color: "#71869B",
    fontSize: 11,
    lineHeight: 16,
  },

  chevron: {
    color: "#5E7891",
    fontSize: 25,
    marginLeft: 8,
  },

  divider: {
    height: 1,
    backgroundColor: "#182E43",
    marginLeft: 68,
  },

  emergencyCard: {
    backgroundColor: "#30171B",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#5A292F",
    marginBottom: 28,
  },

  emergencyIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#4A2025",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  emergencyIconText: {
    fontSize: 23,
  },

  emergencyText: {
    flex: 1,
  },

  emergencyTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },

  emergencySubtitle: {
    color: "#C28D92",
    fontSize: 11,
  },

  emergencyArrow: {
    color: "#F87171",
    fontSize: 26,
  },

  footer: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 20,
  },

  footerTitle: {
    color: "#AFC1D3",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },

  footerText: {
    color: "#60778E",
    fontSize: 11,
    marginBottom: 7,
  },

  version: {
    color: "#40566B",
    fontSize: 9,
    textAlign: "center",
  },

  pressed: {
    opacity: 0.78,
  },

  signOutButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#26171A",
    borderWidth: 1,
    borderColor: "#54272D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  signOutIcon: {
    color: "#F87171",
    fontSize: 22,
    fontWeight: "700",
    marginRight: 9,
  },

  signOutText: {
    color: "#F87171",
    fontSize: 14,
    fontWeight: "700",
  },

  scrollView: {
    flex: 1,
  },
});