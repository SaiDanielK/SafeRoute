import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import {
  getAmberAlerts,
  type AmberAlert,
} from "./amberAlertService";

import {
  requestSafetyNotificationPermission,
} from "./notificationService";

import {
  areSafetyNotificationsEnabled,
} from "./notificationPreferences";

const NOTIFIED_AMBER_ALERTS_KEY = "@saferoute_notified_amber_alerts";
const MAX_STORED_ALERT_IDS = 200;

// The FEMA endpoint used by this app is an archive, not a guaranteed
// real-time feed. Only consider recently issued, non-expired records.
const MAX_ALERT_AGE_MS = 30 * 60 * 1000;

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const timestamp =
    typeof value === "number" ? value : Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : null;
}

function isRecentlyIssued(alert: AmberAlert, now: number): boolean {
  const sentAt = parseTimestamp(alert.sent);

  if (sentAt === null) {
    return false;
  }

  const age = now - sentAt;

  return age >= 0 && age <= MAX_ALERT_AGE_MS;
}

function isNotExpired(alert: AmberAlert, now: number): boolean {
  // Without a known expiration time, we cannot safely treat an archived
  // record as an active emergency.
  const expiresAt = parseTimestamp(alert.expires);

  return expiresAt !== null && expiresAt > now;
}

async function loadNotifiedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFIED_AMBER_ALERTS_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.filter(
          (value): value is string => typeof value === "string"
        )
      : [];
  } catch {
    return [];
  }
}

async function saveNotifiedIds(ids: Set<string>): Promise<void> {
  await AsyncStorage.setItem(
    NOTIFIED_AMBER_ALERTS_KEY,
    JSON.stringify(Array.from(ids).slice(-MAX_STORED_ALERT_IDS))
  );
}

/**
 * Checks the available AMBER records and schedules local notifications
 * only for recently issued, non-expired alerts that have not been
 * announced before.
 *
 * Respects Profile > Safety Alerts and iOS notification permission.
 *
 * IMPORTANT:
 * The current FEMA IPAWS Archive source is not a guaranteed live feed.
 * This function cannot guarantee immediate AMBER Alert delivery and
 * must not be treated as an emergency notification service.
 *
 * @returns Number of notifications successfully scheduled.
 */
export async function checkAmberAlertNotifications(): Promise<number> {
  try {
    if (!(await areSafetyNotificationsEnabled())) {
      return 0;
    }

    const permissionGranted =
      await requestSafetyNotificationPermission();

    if (!permissionGranted) {
      return 0;
    }

    // Recheck in case the user disabled alerts during the permission check.
    if (!(await areSafetyNotificationsEnabled())) {
      return 0;
    }

    const alerts = await getAmberAlerts();
    const now = Date.now();
    const notifiedIds = new Set(await loadNotifiedIds());

    let sentCount = 0;

    for (const alert of alerts) {
      if (!alert.id || notifiedIds.has(alert.id)) {
        continue;
      }

      // Never announce old archive entries as new emergencies.
      if (!isRecentlyIssued(alert, now) || !isNotExpired(alert, now)) {
        continue;
      }

      // Respect the user's preference immediately before scheduling.
      if (!(await areSafetyNotificationsEnabled())) {
        break;
      }

      const title =
        alert.headline?.trim() ||
        alert.event?.trim() ||
        "AMBER Alert";

      const description =
        alert.instruction?.trim() ||
        alert.description?.trim() ||
        "An AMBER Alert record was reported. Check official local authorities for current information.";

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `AMBER Alert: ${title}`,
          body: description.slice(0, 350),
          data: {
            type: "amber-alert",
            alertId: alert.id,
            areaDesc: alert.areaDesc,
            url: alert.web,
            sent: alert.sent,
            expires: alert.expires,
          },
        },
        trigger: null,
      });

      notifiedIds.add(alert.id);
      sentCount += 1;

      // Persist after each scheduled notification to avoid duplicate alerts
      // if processing a later record fails.
      await saveNotifiedIds(notifiedIds);
    }

    return sentCount;
  } catch (error) {
    console.warn("Could not check AMBER alert notifications:", error);
    return 0;
  }
}