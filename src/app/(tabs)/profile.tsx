import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  onAuthStateChanged,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "../../firebase/auth";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

const SETTINGS_KEY = "@saferoute_profile_settings";
const PROFILE_NAME_KEY = "@saferoute_profile_name";

type ProfileSettings = {
  notificationsEnabled: boolean;
  nightSafetyEnabled: boolean;
  locationEnabled: boolean;
};

const DEFAULT_SETTINGS: ProfileSettings = {
  notificationsEnabled: true,
  nightSafetyEnabled: true,
  locationEnabled: true,
};

type DialogType = "profile" | "appearance" | "privacy" | "help" | null;

type SettingColor = "orange" | "purple" | "blue";

const SETTING_COLORS: Record<SettingColor, string> = {
  orange: "#F97316",
  purple: "#A78BFA",
  blue: "#3B82F6",
};

function parseSettings(raw: string | null): ProfileSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };

  try {
    const parsed = JSON.parse(raw) as Partial<ProfileSettings>;

    return {
      notificationsEnabled:
        typeof parsed.notificationsEnabled === "boolean"
          ? parsed.notificationsEnabled
          : DEFAULT_SETTINGS.notificationsEnabled,
      nightSafetyEnabled:
        typeof parsed.nightSafetyEnabled === "boolean"
          ? parsed.nightSafetyEnabled
          : DEFAULT_SETTINGS.nightSafetyEnabled,
      locationEnabled:
        typeof parsed.locationEnabled === "boolean"
          ? parsed.locationEnabled
          : DEFAULT_SETTINGS.locationEnabled,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export default function ProfileTab() {
  const [settings, setSettings] = useState<ProfileSettings>({
    ...DEFAULT_SETTINGS,
  });
  const [currentUser, setCurrentUser] = useState<User | null>(
    firebaseAuth.currentUser
  );
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState("");
  const [dialog, setDialog] = useState<DialogType>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setCurrentUser(user);

      if (user?.displayName) {
        setDisplayName(user.displayName);
      } else if (!user) {
        setDisplayName("");
      }
    });

    return unsubscribe;
  }, []);

  const saveSettings = useCallback(async (next: ProfileSettings) => {
    setSettingsSaving(true);

    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return true;
    } catch {
      Alert.alert(
        "Settings Not Saved",
        "SafeRoute couldn't save your preferences on this device. Please try again."
      );
      return false;
    } finally {
      setSettingsSaving(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      try {
        const [savedSettings, savedName, permission] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(PROFILE_NAME_KEY),
          Location.getForegroundPermissionsAsync(),
        ]);

        if (!active) return;

        const parsedSettings = parseSettings(savedSettings);

        setSettings({
          ...parsedSettings,
          locationEnabled:
            permission.status === "granted" &&
            parsedSettings.locationEnabled,
        });

        if (savedName && !firebaseAuth.currentUser?.displayName) {
          setDisplayName(savedName);
        }
      } catch {
        if (active) {
          setSettings({
            ...DEFAULT_SETTINGS,
            locationEnabled: false,
          });
        }
      } finally {
        if (active) setSettingsLoaded(true);
      }
    };

    void loadSettings();

    return () => {
      active = false;
    };
  }, []);

  const updatePreference = useCallback(
    async (key: keyof ProfileSettings, value: boolean) => {
      const next: ProfileSettings = {
        ...settings,
        [key]: value,
      };

      setSettings(next);
      await saveSettings(next);
    },
    [settings, saveSettings]
  );

  const handleSafetyAlertsPreferenceChange = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        try {
          const currentPermission =
            await Notifications.getPermissionsAsync();

          const permission = currentPermission.granted
            ? currentPermission
            : currentPermission.canAskAgain === false
              ? currentPermission
              : await Notifications.requestPermissionsAsync();

          const deviceAllowsNotifications =
            permission.granted ||
            permission.ios?.status ===
              Notifications.IosAuthorizationStatus.PROVISIONAL;

          const next: ProfileSettings = {
            ...settings,
            notificationsEnabled: true,
          };

          setSettings(next);
          const saved = await saveSettings(next);

          if (saved && !deviceAllowsNotifications) {
            Alert.alert(
              "Notifications Are Not Allowed",
              "SafeRoute's Safety Alerts preference is on, but your device is not allowing notifications. Open Device Settings and enable notifications for SafeRoute to receive them.",
              [
                { text: "Not Now", style: "cancel" },
                {
                  text: "Open Settings",
                  onPress: () => {
                    void Linking.openSettings();
                  },
                },
              ]
            );
          }
        } catch {
          Alert.alert(
            "Notification Settings Unavailable",
            "SafeRoute couldn't check notification permission. Your preference will still be saved."
          );

          const next: ProfileSettings = {
            ...settings,
            notificationsEnabled: true,
          };

          setSettings(next);
          await saveSettings(next);
        }

        return;
      }

      const next: ProfileSettings = {
        ...settings,
        notificationsEnabled: false,
      };

      setSettings(next);
      await saveSettings(next);
    },
    [settings, saveSettings]
  );

  const handleLocationPreferenceChange = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        try {
          const permission =
            await Location.requestForegroundPermissionsAsync();

          if (permission.status !== "granted") {
            const next: ProfileSettings = {
              ...settings,
              locationEnabled: false,
            };

            setSettings(next);
            await saveSettings(next);

            Alert.alert(
              "Location Permission Required",
              "SafeRoute needs foreground location permission to use your current location. You can enable it in your device settings.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Open Settings",
                  onPress: () => {
                    void Linking.openSettings();
                  },
                },
              ]
            );

            return;
          }

          const next: ProfileSettings = {
            ...settings,
            locationEnabled: true,
          };

          setSettings(next);
          await saveSettings(next);
        } catch {
          Alert.alert(
            "Location Error",
            "SafeRoute couldn't check or request location permission. Please try again."
          );
        }

        return;
      }

      const next: ProfileSettings = {
        ...settings,
        locationEnabled: false,
      };

      setSettings(next);

      const saved = await saveSettings(next);

      if (saved) {
        Alert.alert(
          "Location Preference Updated",
          "Your SafeRoute location preference is now off. This does not revoke your phone's location permissions. To prevent the app from accessing your location, open device settings and revoke its location permission.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ]
        );
      }
    },
    [settings, saveSettings]
  );

  const isGuest = currentUser?.isAnonymous === true;
  const shouldShowLogin = isGuest || !currentUser;
  const accountName = displayName || currentUser?.displayName || "";

  const openProfileEditor = () => {
    setEditingName(accountName);
    setDialog("profile");
  };

  const saveProfile = async () => {
    const trimmedName = editingName.trim();

    if (!trimmedName) {
      Alert.alert("Name Required", "Please enter a display name.");
      return;
    }

    setSavingProfile(true);

    try {
      if (currentUser) {
        await updateProfile(currentUser, { displayName: trimmedName });
      }

      await AsyncStorage.setItem(PROFILE_NAME_KEY, trimmedName);
      setDisplayName(trimmedName);
      setDialog(null);

      Alert.alert("Profile Updated", "Your display name has been saved.");
    } catch {
      Alert.alert(
        "Could Not Save",
        "Your profile could not be updated. Please try again."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of SafeRoute?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut(firebaseAuth);
              router.replace("/auth");
            } catch {
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

  const handleAccountAction = () => {
    if (shouldShowLogin) {
      router.push("/auth");
      return;
    }

    handleSignOut();
  };

  const openTrips = () => router.push("/trips");
  const openMap = () => router.push("/map");
  const openEmergencyCenter = () => router.push("/emergency");

  const showSafetyScore = () => {
    Alert.alert(
      "Your Safety Score",
      "SafeRoute's route safety scores help compare route factors. The score displayed on this profile is a general overview, not a guarantee that a route is safe.",
      [
        { text: "Close", style: "cancel" },
        { text: "Plan a Trip", onPress: openMap },
      ]
    );
  };

  const openDeviceSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        "Settings Unavailable",
        "Open your device's Settings app to manage SafeRoute permissions."
      );
    }
  };

  const openSupportEmail = async () => {
    const url = "mailto:support@saferoute.app?subject=SafeRoute%20Support";

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Email Unavailable",
        "We couldn't open an email app on this device. You can still use the Emergency Center for emergency tools."
      );
    }
  };

  const confirmResetSettings = () => {
    Alert.alert(
      "Reset Preferences",
      "Restore the default SafeRoute profile preferences?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          onPress: async () => {
            const defaults = { ...DEFAULT_SETTINGS };
            setSettings(defaults);

            const saved = await saveSettings(defaults);

            if (saved) {
              setDialog(null);
              Alert.alert(
                "Preferences Reset",
                "Your profile preferences have been restored. Device location permission itself has not changed."
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
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SAFEROUTE PROFILE</Text>
            <Text style={styles.title}>Profile</Text>
          </View>

          <View style={styles.headerBadge}>
            <Ionicons name="shield-checkmark" size={23} color="#4ADE80" />
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="shield-checkmark" size={34} color="#7DD3FC" />
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.name} numberOfLines={1}>
              {accountName || (isGuest ? "Guest Traveler" : "SafeRoute User")}
            </Text>

            <Text style={styles.email} numberOfLines={2}>
              {isGuest
                ? "Guest account"
                : currentUser?.email ?? "Not signed in"}
            </Text>

            <View style={styles.memberBadge}>
              <Ionicons
                name="checkmark-circle"
                size={11}
                color="#4ADE80"
                style={styles.memberBadgeIcon}
              />
              <Text style={styles.memberBadgeText}>
                {isGuest
                  ? "GUEST TRAVELER"
                  : currentUser
                    ? "SAFE TRAVELER"
                    : "SIGNED OUT"}
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.pressed,
            ]}
            onPress={openProfileEditor}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.scoreCard,
            pressed && styles.rowPressed,
          ]}
          onPress={showSafetyScore}
          accessibilityRole="button"
        >
          <View style={styles.scoreLeft}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreNumber}>92</Text>
              <Text style={styles.scoreSmall}>/100</Text>
            </View>

            <View>
              <Text style={styles.scoreTitle}>Safety Score</Text>
              <Text style={styles.scoreSubtitle}>
                Tap to learn about route safety
              </Text>
            </View>
          </View>

          <View style={styles.scoreArrow}>
            <Ionicons name="chevron-forward" size={20} color="#7DD3FC" />
          </View>
        </Pressable>

        <Text style={styles.sectionTitle}>ACCOUNT</Text>

        <View style={styles.sectionCard}>
          <MenuRow
            icon="person-outline"
            title="Personal Information"
            subtitle="Name and account details"
            onPress={openProfileEditor}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="people-outline"
            title="Trusted Contacts"
            subtitle="Manage contacts and trip sharing"
            onPress={openEmergencyCenter}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="location-outline"
            title="Saved Places"
            subtitle="Manage destinations and saved places"
            onPress={openTrips}
          />
        </View>

        <Text style={styles.sectionTitle}>SAFETY SETTINGS</Text>

        <View style={styles.sectionCard}>
          <SettingRow
            icon="notifications-outline"
            title="Safety Alerts"
            subtitle="Allow alerts when device notification permission is granted"
            value={settings.notificationsEnabled}
            color={SETTING_COLORS.orange}
            onValueChange={(value) =>
              void handleSafetyAlertsPreferenceChange(value)
            }
            disabled={!settingsLoaded || settingsSaving}
          />

          <View style={styles.divider} />

          <SettingRow
            icon="moon-outline"
            title="Night Safety Mode"
            subtitle="Remember your night safety preference"
            value={settings.nightSafetyEnabled}
            color={SETTING_COLORS.purple}
            onValueChange={(value) =>
              void updatePreference("nightSafetyEnabled", value)
            }
            disabled={!settingsLoaded || settingsSaving}
          />

          <View style={styles.divider} />

          <SettingRow
            icon="navigate-outline"
            title="Location Preference"
            subtitle={
              settings.locationEnabled
                ? "Location preference enabled"
                : "Location preference disabled"
            }
            value={settings.locationEnabled}
            color={SETTING_COLORS.blue}
            onValueChange={(value) =>
              void handleLocationPreferenceChange(value)
            }
            disabled={!settingsLoaded || settingsSaving}
          />

          <Pressable
            style={({ pressed }) => [
              styles.deviceSettingsButton,
              pressed && styles.rowPressed,
            ]}
            onPress={() => void openDeviceSettings()}
            accessibilityRole="button"
          >
            <Ionicons
              name="settings-outline"
              size={18}
              color="#7DD3FC"
            />
            <Text style={styles.deviceSettingsText}>
              Open Device Settings
            </Text>
            <Ionicons name="open-outline" size={16} color="#7DD3FC" />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>APP</Text>

        <View style={styles.sectionCard}>
          <MenuRow
            icon="lock-closed-outline"
            title="Privacy & Security"
            subtitle="Learn about account and location privacy"
            onPress={() => setDialog("privacy")}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="help-circle-outline"
            title="Help & Support"
            subtitle="Support information and emergency access"
            onPress={() => setDialog("help")}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="refresh-outline"
            title="Reset Preferences"
            subtitle="Restore default profile switches"
            onPress={confirmResetSettings}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.accountActionButton,
            shouldShowLogin && styles.loginButton,
            pressed && styles.pressed,
          ]}
          onPress={handleAccountAction}
          accessibilityRole="button"
        >
          <Ionicons
            name={shouldShowLogin ? "log-in-outline" : "log-out-outline"}
            size={21}
            color={shouldShowLogin ? "#4ADE80" : "#F87171"}
            style={styles.accountActionIcon}
          />
          <Text
            style={[
              styles.accountActionText,
              shouldShowLogin && styles.loginButtonText,
            ]}
          >
            {shouldShowLogin ? "Log In / Sign Up" : "Sign Out"}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.emergencyCard,
            pressed && styles.pressed,
          ]}
          onPress={openEmergencyCenter}
          accessibilityRole="button"
        >
          <View style={styles.emergencyIcon}>
            <Ionicons name="alert-circle" size={27} color="#F87171" />
          </View>

          <View style={styles.emergencyText}>
            <Text style={styles.emergencyTitle}>Emergency Center</Text>
            <Text style={styles.emergencySubtitle}>
              Quickly access emergency tools
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={21} color="#F87171" />
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>SafeRoute</Text>
          <Text style={styles.footerText}>
            Safer routes. Smarter decisions.
          </Text>
          <Text style={styles.version}>
            Version 1.0.0 • Congressional App Challenge
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={dialog !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDialog(null)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              {dialog === "profile" && (
                <>
                  <ModalHeading
                    icon="person-circle-outline"
                    title="Edit Profile"
                    subtitle="Update the name displayed on your profile."
                    onClose={() => setDialog(null)}
                  />

                  <Text style={styles.inputLabel}>DISPLAY NAME</Text>
                  <TextInput
                    value={editingName}
                    onChangeText={setEditingName}
                    placeholder="Enter your name"
                    placeholderTextColor="#6F8499"
                    autoCapitalize="words"
                    autoCorrect={false}
                    maxLength={60}
                    returnKeyType="done"
                    onSubmitEditing={() => void saveProfile()}
                    style={styles.nameInput}
                  />

                  <Text style={styles.modalHint}>
                    Your sign-in email is managed by your authentication
                    account and cannot be changed here.
                  </Text>

                  <View style={styles.modalButtons}>
                    <ModalButton
                      title="Cancel"
                      onPress={() => setDialog(null)}
                      secondary
                    />
                    <ModalButton
                      title={savingProfile ? "Saving..." : "Save Changes"}
                      onPress={() => void saveProfile()}
                      disabled={savingProfile}
                    />
                  </View>
                </>
              )}

              {dialog === "appearance" && (
                <>
                  <ModalHeading
                    icon="color-palette-outline"
                    title="Appearance"
                    subtitle="SafeRoute currently uses a dark interface."
                    onClose={() => setDialog(null)}
                  />

                  <View style={styles.infoPanel}>
                    <Ionicons name="moon" size={24} color="#7DD3FC" />
                    <View style={styles.infoPanelText}>
                      <Text style={styles.menuTitle}>Dark appearance</Text>
                      <Text style={styles.menuSubtitle}>
                        Active app theme
                      </Text>
                    </View>
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color="#4ADE80"
                    />
                  </View>

                  <Text style={styles.modalHint}>
                    A light theme is not configured in this version.
                  </Text>

                  <View style={styles.modalButtons}>
                    <ModalButton
                      title="Done"
                      onPress={() => setDialog(null)}
                    />
                  </View>
                </>
              )}

              {dialog === "privacy" && (
                <>
                  <ModalHeading
                    icon="shield-checkmark-outline"
                    title="Privacy & Security"
                    subtitle="Understand what these profile settings control."
                    onClose={() => setDialog(null)}
                  />

                  <View style={styles.privacyItem}>
                    <Ionicons
                      name="person-circle-outline"
                      size={22}
                      color="#7DD3FC"
                    />
                    <View style={styles.privacyText}>
                      <Text style={styles.menuTitle}>Account</Text>
                      <Text style={styles.modalBody}>
                        Sign-in and account access are handled by Firebase
                        Authentication. Guest accounts are anonymous accounts.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.privacyItem}>
                    <Ionicons
                      name="navigate-outline"
                      size={22}
                      color="#7DD3FC"
                    />
                    <View style={styles.privacyText}>
                      <Text style={styles.menuTitle}>Location</Text>
                      <Text style={styles.modalBody}>
                        Location Preference requests foreground permission
                        when enabled. Turning the preference off does not
                        revoke device permission; manage that in your phone
                        settings.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.privacyItem}>
                    <Ionicons
                      name="settings-outline"
                      size={22}
                      color="#7DD3FC"
                    />
                    <View style={styles.privacyText}>
                      <Text style={styles.menuTitle}>Saved preferences</Text>
                      <Text style={styles.modalBody}>
                        Profile switches and your display-name preference are
                        stored locally on this device.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalButtons}>
                    <ModalButton
                      title="Device Settings"
                      onPress={() => void openDeviceSettings()}
                      secondary
                    />
                    <ModalButton
                      title="Done"
                      onPress={() => setDialog(null)}
                    />
                  </View>
                </>
              )}

              {dialog === "help" && (
                <>
                  <ModalHeading
                    icon="help-circle-outline"
                    title="Help & Support"
                    subtitle="Choose an action below."
                    onClose={() => setDialog(null)}
                  />

                  <Pressable
                    style={({ pressed }) => [
                      styles.helpAction,
                      pressed && styles.rowPressed,
                    ]}
                    onPress={() => {
                      setDialog(null);
                      openEmergencyCenter();
                    }}
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={23}
                      color="#F87171"
                    />
                    <View style={styles.helpActionText}>
                      <Text style={styles.menuTitle}>Emergency Center</Text>
                      <Text style={styles.menuSubtitle}>
                        Open emergency tools
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#5E7891"
                    />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.helpAction,
                      pressed && styles.rowPressed,
                    ]}
                    onPress={() => void openSupportEmail()}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={23}
                      color="#7DD3FC"
                    />
                    <View style={styles.helpActionText}>
                      <Text style={styles.menuTitle}>Contact Support</Text>
                      <Text style={styles.menuSubtitle}>
                        Try opening your email app
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#5E7891"
                    />
                  </Pressable>

                  <Text style={styles.modalHint}>
                    Make sure the support email address is configured for your
                    project before release.
                  </Text>

                  <View style={styles.modalButtons}>
                    <ModalButton
                      title="Done"
                      onPress={() => setDialog(null)}
                    />
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuRow,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={21} color="#7DD3FC" />
      </View>
      <View style={styles.menuText}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color="#5E7891" />
    </Pressable>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  value,
  color,
  onValueChange,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  value: boolean;
  color: string;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={21} color={color} />
      </View>

      <View style={styles.menuText}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: "#304357",
          true: color,
        }}
        thumbColor={value ? "#FFFFFF" : "#AAB7C4"}
        accessibilityLabel={title}
      />
    </View>
  );
}

function ModalHeading({
  icon,
  title,
  subtitle,
  onClose,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  return (
    <View style={styles.modalHeading}>
      <View style={styles.modalHeadingIcon}>
        <Ionicons name={icon} size={24} color="#7DD3FC" />
      </View>
      <View style={styles.modalHeadingText}>
        <Text style={styles.modalTitle}>{title}</Text>
        <Text style={styles.modalSubtitle}>{subtitle}</Text>
      </View>
      <Pressable
        onPress={onClose}
        style={styles.closeButton}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Ionicons name="close" size={22} color="#AFC1D3" />
      </Pressable>
    </View>
  );
}

function ModalButton({
  title,
  onPress,
  secondary,
  disabled,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.modalButton,
        secondary && styles.modalButtonSecondary,
        disabled && styles.modalButtonDisabled,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      <Text
        style={[
          styles.modalButtonText,
          secondary && styles.modalButtonSecondaryText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07111F",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 63,
    paddingBottom: 70,
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
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#142B43",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 3,
  },
  email: {
    color: "#8195AA",
    fontSize: 12,
    marginBottom: 8,
  },
  memberBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#12352B",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  memberBadgeIcon: {
    marginRight: 4,
  },
  memberBadgeText: {
    color: "#4ADE80",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#142B43",
    marginLeft: 8,
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
    flex: 1,
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
    fontSize: 11,
  },
  scoreArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#142B43",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
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
  menuText: {
    flex: 1,
    minWidth: 0,
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
  divider: {
    height: 1,
    backgroundColor: "#182E43",
    marginLeft: 68,
  },
  deviceSettingsButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderTopWidth: 1,
    borderTopColor: "#182E43",
  },
  deviceSettingsText: {
    flex: 1,
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "700",
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
  accountActionButton: {
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
  accountActionIcon: {
    marginRight: 9,
  },
  accountActionText: {
    color: "#F87171",
    fontSize: 14,
    fontWeight: "700",
  },
  loginButton: {
    backgroundColor: "#12352B",
    borderColor: "#246B50",
  },
  loginButtonText: {
    color: "#4ADE80",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center",
    padding: 20,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "#0D1B2A",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#24415F",
    padding: 20,
  },
  modalHeading: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },
  modalHeadingIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#142B43",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  modalHeadingText: {
    flex: 1,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 4,
  },
  modalSubtitle: {
    color: "#8195AA",
    fontSize: 11,
    lineHeight: 16,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#172A40",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  inputLabel: {
    color: "#7D94AB",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  nameInput: {
    color: "#FFFFFF",
    backgroundColor: "#07111F",
    borderColor: "#29445E",
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
  },
  modalHint: {
    color: "#71869B",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 13,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  modalButton: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#20C997",
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonSecondary: {
    backgroundColor: "#172A40",
    borderWidth: 1,
    borderColor: "#29445E",
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    color: "#07111F",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  modalButtonSecondaryText: {
    color: "#C7D5E5",
  },
  infoPanel: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#071827",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#203A53",
  },
  infoPanelText: {
    flex: 1,
    marginHorizontal: 12,
  },
  privacyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
    gap: 12,
  },
  privacyText: {
    flex: 1,
  },
  modalBody: {
    color: "#8195AA",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },
  helpAction: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 13,
    marginBottom: 8,
    backgroundColor: "#102238",
  },
  helpActionText: {
    flex: 1,
    marginHorizontal: 12,
  },
});