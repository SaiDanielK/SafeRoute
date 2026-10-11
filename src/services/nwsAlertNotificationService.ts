import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { getActiveNWSAlerts } from "./nwsService";
import { requestSafetyNotificationPermission } from "./notificationService";
import { areSafetyNotificationsEnabled } from "./notificationPreferences";

const NOTIFIED_NWS_ALERTS_KEY =
  "@saferoute_notified_nws_alerts";

const MAX_STORED_ALERT_IDS = 200;

export type NWSAlertNotificationLocation = {
  latitude: number;
  longitude: number;
};

function isValidLocation(
  latitude: number,
  longitude: number
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

async function getNotifiedAlertIds(): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(
      NOTIFIED_NWS_ALERTS_KEY
    );

    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (id): id is string => typeof id === "string"
    );
  } catch (error) {
    console.warn(
      "SafeRoute could not read previously notified weather alerts:",
      error
    );

    return [];
  }
}

async function saveNotifiedAlertIds(
  ids: Set<string>
): Promise<void> {
  const limitedIds = Array.from(ids).slice(
    -MAX_STORED_ALERT_IDS
  );

  await AsyncStorage.setItem(
    NOTIFIED_NWS_ALERTS_KEY,
    JSON.stringify(limitedIds)
  );
}

function getAlertNotificationText(alert: {
  event?: string;
  headline?: string;
  description?: string;
  instruction?: string;
}): {
  title: string;
  body: string;
} {
  const event = alert.event?.trim();
  const headline = alert.headline?.trim();

  const titleText =
    headline || event || "Active weather alert";

  const bodyText =
    alert.instruction?.trim() ||
    alert.description?.trim() ||
    "Check the official National Weather Service alert for safety instructions.";

  return {
    title: `Weather alert: ${titleText}`.slice(0, 150),
    body: bodyText.slice(0, 350),
  };
}

function isAlertExpired(expires: string | null | undefined): boolean {
  if (!expires) {
    // An alert without an expiry can still be active according to
    // the NWS active-alert endpoint.
    return false;
  }

  const expiryTime = Date.parse(expires);

  // Ignore malformed expiry dates rather than silently treating
  // an unparseable date as proof that the alert has expired.
  if (!Number.isFinite(expiryTime)) {
    return false;
  }

  return expiryTime <= Date.now();
}

/**
 * Checks active National Weather Service alerts for the supplied
 * coordinates and schedules local notifications for unseen alerts.
 *
 * Call while the app is active and a valid location is available.
 * This function does not run automatically in the background.
 *
 * Returns the number of notifications scheduled.
 */
export async function checkNWSAlertNotifications(
  latitude: number,
  longitude: number
): Promise<number> {
  if (!isValidLocation(latitude, longitude)) {
    return 0;
  }

  try {
    // Respect Profile > Safety Alerts.
    if (!(await areSafetyNotificationsEnabled())) {
      return 0;
    }

    const permissionGranted =
      await requestSafetyNotificationPermission();

    if (!permissionGranted) {
      return 0;
    }

    // The user may have switched alerts off while permission was handled.
    if (!(await areSafetyNotificationsEnabled())) {
      return 0;
    }

    const alerts = await getActiveNWSAlerts(
      latitude,
      longitude
    );

    if (!Array.isArray(alerts) || alerts.length === 0) {
      return 0;
    }

    const notifiedIds = new Set(
      await getNotifiedAlertIds()
    );

    let scheduledCount = 0;

    for (const alert of alerts) {
      if (!alert.id || notifiedIds.has(alert.id)) {
        continue;
      }

      if (isAlertExpired(alert.expires)) {
        continue;
      }

      // Recheck the preference immediately before each notification.
      if (!(await areSafetyNotificationsEnabled())) {
        break;
      }

      const { title, body } =
        getAlertNotificationText(alert);

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: "default",
          data: {
            type: "nws-weather-alert",
            alertId: alert.id,
            event: alert.event,
            url: alert.web,
            latitude,
            longitude,
          },
        },
        trigger: null,
      });

      // Save the ID after successfully scheduling the notification.
      notifiedIds.add(alert.id);
      await saveNotifiedAlertIds(notifiedIds);

      scheduledCount += 1;
    }

    return scheduledCount;
  } catch (error) {
    console.warn(
      "SafeRoute could not check NWS weather notifications:",
      error
    );

    return 0;
  }
}

/**
 * Clears local duplicate-notification history.
 *
 * This does not change NWS alerts or cancel notifications
 * that have already been scheduled.
 */
export async function resetNWSAlertNotificationHistory(): Promise<void> {
  await AsyncStorage.removeItem(NOTIFIED_NWS_ALERTS_KEY);
}