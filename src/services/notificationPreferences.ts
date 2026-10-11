
import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS_KEY = "@saferoute_profile_settings";

type StoredProfileSettings = {
  notificationsEnabled?: unknown;
};

/**
 * Returns whether SafeRoute safety notifications are enabled
 * in Profile > Safety Alerts.
 *
 * Defaults to enabled when settings have never been saved,
 * matching the default setting in profile.tsx.
 *
 * If stored settings are unreadable or corrupted, returns false
 * to avoid sending notifications when the user's preference
 * cannot be verified.
 */
export async function areSafetyNotificationsEnabled(): Promise<boolean> {
  try {
    const rawSettings = await AsyncStorage.getItem(SETTINGS_KEY);

    // No saved preferences yet: match Profile's default (ON).
    if (rawSettings === null) {
      return true;
    }

    const settings: unknown = JSON.parse(rawSettings);

    if (
      settings === null ||
      typeof settings !== "object" ||
      Array.isArray(settings)
    ) {
      return false;
    }

    const profileSettings = settings as StoredProfileSettings;

    // A missing value uses the Profile default.
    if (typeof profileSettings.notificationsEnabled !== "boolean") {
      return true;
    }

    return profileSettings.notificationsEnabled;
  } catch (error) {
    console.warn(
      "SafeRoute could not read the Safety Alerts preference:",
      error
    );

    // Fail closed if the preference cannot be read.
    return false;
  }
}

/**
 * Saves the Safety Alerts preference.
 *
 * Use this helper if another part of the app needs to update
 * the preference without replacing the user's other Profile settings.
 */
export async function setSafetyNotificationsEnabled(
  enabled: boolean
): Promise<void> {
  const rawSettings = await AsyncStorage.getItem(SETTINGS_KEY);

  let existingSettings: Record<string, unknown> = {};

  if (rawSettings !== null) {
    try {
      const parsed: unknown = JSON.parse(rawSettings);

      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        existingSettings = parsed as Record<string, unknown>;
      }
    } catch {
      // Recover from invalid JSON while preserving the requested setting.
      existingSettings = {};
    }
  }

  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...existingSettings,
      notificationsEnabled: enabled,
    })
  );
}