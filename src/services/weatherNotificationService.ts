
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import type { NWSAlert } from "./nwsService";
import {
  requestSafetyNotificationPermission,
} from "./notificationService";

const NOTIFIED_ALERTS_KEY = "@saferoute_notified_weather_alerts";
const MAX_REMEMBERED_ALERTS = 100;

// Only notify for significant weather events.
function isSignificantWeatherAlert(alert: NWSAlert): boolean {
  const severity = alert.severity.toLowerCase();
  const urgency = alert.urgency.toLowerCase();
  const event = alert.event.toLowerCase();

  const severeWeatherEvents = [
    "tornado",
    "severe thunderstorm",
    "flash flood",
    "flood warning",
    "hurricane",
    "tropical storm",
    "blizzard",
    "winter storm",
    "ice storm",
    "extreme wind",
    "storm surge",
    "tsunami",
    "extreme heat",
    "extreme cold",
    "red flag",
  ];

  const matchesSevereEvent = severeWeatherEvents.some(
    (keyword) => event.includes(keyword)
  );

  return (
    severity === "extreme" ||
    severity === "severe" ||
    (
      matchesSevereEvent &&
      (urgency === "immediate" || urgency === "expected")
    )
  );
}

async function getNotifiedAlertIds(): Promise<string[]> {
  try {
    const saved = await AsyncStorage.getItem(
      NOTIFIED_ALERTS_KEY
    );

    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);

    return Array.isArray(parsed)
      ? parsed.filter(
          (value): value is string =>
            typeof value === "string"
        )
      : [];
  } catch {
    return [];
  }
}

/**
 * Notify once for each significant NWS alert ID.
 * Uses the existing SafeRoute notification permission flow.
 */
export async function notifyForSevereWeatherAlerts(
  alerts: NWSAlert[]
): Promise<number> {
  try {
    const significantAlerts = alerts.filter(
      isSignificantWeatherAlert
    );

    if (significantAlerts.length === 0) {
      return 0;
    }

    const permissionGranted =
      await requestSafetyNotificationPermission();

    if (!permissionGranted) {
      return 0;
    }

    const previouslyNotified = await getNotifiedAlertIds();
    const notifiedSet = new Set(previouslyNotified);
    let sentCount = 0;

    for (const alert of significantAlerts) {
      if (notifiedSet.has(alert.id)) {
        continue;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Weather Alert: ${alert.event}`,
          body:
            alert.headline ||
            `A significant weather alert affects ${alert.areaDesc}.`,
          sound: "default",
          data: {
            type: "severe-weather",
            alertId: alert.id,
            event: alert.event,
            severity: alert.severity,
            area: alert.areaDesc,
            url: alert.web,
          },
        },
        trigger: null,
      });

      notifiedSet.add(alert.id);
      sentCount += 1;
    }

    // Keep the stored history bounded.
    const updatedIds = Array.from(notifiedSet).slice(
      -MAX_REMEMBERED_ALERTS
    );

    await AsyncStorage.setItem(
      NOTIFIED_ALERTS_KEY,
      JSON.stringify(updatedIds)
    );

    return sentCount;
  } catch (error) {
    console.warn(
      "SafeRoute could not send weather notifications:",
      error
    );

    return 0;
  }
}
