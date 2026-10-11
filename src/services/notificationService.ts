import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import {
  areSafetyNotificationsEnabled,
} from "./notificationPreferences";

const LOW_SAFETY_SCORE_THRESHOLD = 30;
const LOW_SCORE_COOLDOWN_MS = 30 * 60 * 1000;
const LOW_SCORE_STATE_KEY =
  "@saferoute_low_score_notification_state";

export type SafetyNotificationLocation = {
  latitude: number;
  longitude: number;
  label?: string;
};

type LowScoreNotificationState = {
  areaKey: string;
  lastSentAt: number;
};

let notificationHandlerConfigured = false;

/**
 * Configure foreground notification presentation.
 * Callers can safely invoke this more than once.
 */
export function configureSafetyNotificationHandler(): void {
  if (notificationHandlerConfigured) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  notificationHandlerConfigured = true;
}

function isValidLocation(
  location: SafetyNotificationLocation
): boolean {
  return (
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

function getAreaKey(
  location: SafetyNotificationLocation
): string {
  // Group nearby coordinates to reduce repeated alerts for one area.
  return `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;
}

async function deviceAllowsNotifications(): Promise<boolean> {
  try {
    const permission = await Notifications.getPermissionsAsync();

    return (
      permission.granted ||
      permission.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  } catch (error) {
    console.warn(
      "SafeRoute could not check notification permission:",
      error
    );

    return false;
  }
}

/**
 * Requests the operating system's notification permission.
 *
 * This checks OS permission only. SafeRoute's Profile preference
 * is checked separately before sending app-generated notifications.
 */
export async function requestSafetyNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();

    if (
      current.granted ||
      current.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL
    ) {
      return true;
    }

    if (current.canAskAgain === false) {
      return false;
    }

    const requested =
      await Notifications.requestPermissionsAsync();

    return (
      requested.granted ||
      requested.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  } catch (error) {
    console.warn(
      "SafeRoute could not request notification permission:",
      error
    );

    return false;
  }
}

/**
 * Sends a local notification when the route safety score is below 30.
 *
 * Returns true when a notification is successfully scheduled,
 * or false when it is skipped or an error occurs.
 */
export async function notifyForLowSafetyScore(
  score: number,
  location: SafetyNotificationLocation
): Promise<boolean> {
  if (
    !Number.isFinite(score) ||
    !isValidLocation(location)
  ) {
    return false;
  }

  try {
    // Never send if the Profile switch is OFF.
    if (!(await areSafetyNotificationsEnabled())) {
      return false;
    }

    if (!(await deviceAllowsNotifications())) {
      return false;
    }

    const areaKey = getAreaKey(location);

    // If the route is no longer low-scoring, clear its cooldown.
    if (score >= LOW_SAFETY_SCORE_THRESHOLD) {
      const rawState = await AsyncStorage.getItem(
        LOW_SCORE_STATE_KEY
      );

      if (rawState) {
        try {
          const state = JSON.parse(
            rawState
          ) as LowScoreNotificationState;

          if (state.areaKey === areaKey) {
            await AsyncStorage.removeItem(LOW_SCORE_STATE_KEY);
          }
        } catch {
          await AsyncStorage.removeItem(LOW_SCORE_STATE_KEY);
        }
      }

      return false;
    }

    const now = Date.now();
    const rawState = await AsyncStorage.getItem(
      LOW_SCORE_STATE_KEY
    );

    if (rawState) {
      try {
        const state = JSON.parse(
          rawState
        ) as LowScoreNotificationState;

        const sameArea = state.areaKey === areaKey;
        const validTimestamp =
          Number.isFinite(state.lastSentAt);

        const cooldownActive =
          validTimestamp &&
          now - state.lastSentAt < LOW_SCORE_COOLDOWN_MS;

        if (sameArea && cooldownActive) {
          return false;
        }
      } catch {
        await AsyncStorage.removeItem(LOW_SCORE_STATE_KEY);
      }
    }

    // Recheck immediately before scheduling.
    if (!(await areSafetyNotificationsEnabled())) {
      return false;
    }

    if (!(await deviceAllowsNotifications())) {
      return false;
    }

    configureSafetyNotificationHandler();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "SafeRoute safety alert",
        body:
          `Your selected route has a low safety score (${Math.round(score)}/100). ` +
          "Review your route and consider a safer alternative.",
        data: {
          type: "low-safety-score",
          score: Math.round(score),
          latitude: location.latitude,
          longitude: location.longitude,
          label: location.label ?? null,
        },
        sound: "default",
      },
      trigger: null,
    });

    await AsyncStorage.setItem(
      LOW_SCORE_STATE_KEY,
      JSON.stringify({
        areaKey,
        lastSentAt: now,
      } satisfies LowScoreNotificationState)
    );

    return true;
  } catch (error) {
    console.warn(
      "SafeRoute could not send a low-safety-score notification:",
      error
    );

    return false;
  }
}

/**
 * Sends a test notification when Safety Alerts are enabled
 * and the operating system permits notifications.
 */
export async function sendTestSafetyNotification(): Promise<boolean> {
  try {
    if (!(await areSafetyNotificationsEnabled())) {
      return false;
    }

    if (!(await deviceAllowsNotifications())) {
      return false;
    }

    // Check the preference again before scheduling.
    if (!(await areSafetyNotificationsEnabled())) {
      return false;
    }

    configureSafetyNotificationHandler();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "SafeRoute notifications are working",
        body: "Safety Alerts are enabled on this device.",
        data: {
          type: "safety-notification-test",
        },
        sound: "default",
      },
      trigger: null,
    });

    return true;
  } catch (error) {
    console.warn(
      "SafeRoute could not send a test notification:",
      error
    );

    return false;
  }
}