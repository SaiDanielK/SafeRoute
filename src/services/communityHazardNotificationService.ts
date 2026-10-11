import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import {
  getRecentHazards,
  type CommunityHazard,
} from "./hazardService";

import { requestSafetyNotificationPermission } from "./notificationService";

import {
  areSafetyNotificationsEnabled,
} from "./notificationPreferences";

const NOTIFIED_HAZARDS_KEY =
  "@saferoute_notified_community_hazards";

const MAX_NOTIFIED_IDS = 200;
const MAX_HAZARD_AGE_MS = 24 * 60 * 60 * 1000;
const NEARBY_RADIUS_METERS = 500;

export type CommunityHazardNotificationLocation = {
  latitude: number;
  longitude: number;
};

function isValidLocation(
  location: CommunityHazardNotificationLocation
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

function distanceMeters(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number }
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;

  const latitudeDifference = toRadians(
    second.latitude - first.latitude
  );
  const longitudeDifference = toRadians(
    second.longitude - first.longitude
  );

  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  return (
    2 *
    earthRadiusMeters *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(Math.max(0, 1 - a))
    )
  );
}

function getCreatedAtMilliseconds(
  createdAt: unknown
): number | null {
  if (createdAt == null) {
    return null;
  }

  if (
    typeof createdAt === "number" &&
    Number.isFinite(createdAt)
  ) {
    // Firestore timestamps are not ordinarily raw numbers.
    // Treat numeric values as milliseconds since epoch.
    return createdAt;
  }

  if (typeof createdAt === "string") {
    const parsed = Date.parse(createdAt);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof createdAt === "object") {
    const timestamp = createdAt as {
      toMillis?: () => number;
      seconds?: number;
      _seconds?: number;
    };

    try {
      if (typeof timestamp.toMillis === "function") {
        const milliseconds = timestamp.toMillis();

        return Number.isFinite(milliseconds)
          ? milliseconds
          : null;
      }

      if (typeof timestamp.seconds === "number") {
        return timestamp.seconds * 1000;
      }

      if (typeof timestamp._seconds === "number") {
        return timestamp._seconds * 1000;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function getHazardLabel(
  type: CommunityHazard["type"]
): string {
  switch (type) {
    case "accident":
      return "Accident";
    case "road_closed":
      return "Road closure";
    case "construction":
      return "Construction";
    case "unsafe_area":
      return "Reported unsafe area";
    case "flooding":
      return "Flooding";
    case "debris":
      return "Road debris";
    case "traffic":
      return "Traffic hazard";
    default:
      return "Community hazard";
  }
}

async function getNotifiedHazardIds(): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(
      NOTIFIED_HAZARDS_KEY
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
      "Could not read notified community hazards:",
      error
    );

    return [];
  }
}

async function saveNotifiedHazardIds(
  ids: Set<string>
): Promise<void> {
  const limitedIds = Array.from(ids).slice(-MAX_NOTIFIED_IDS);

  await AsyncStorage.setItem(
    NOTIFIED_HAZARDS_KEY,
    JSON.stringify(limitedIds)
  );
}

/**
 * Checks for recent community hazards within 500 metres.
 *
 * Returns the number of notifications successfully scheduled.
 *
 * Call this function while the app is active and a valid location
 * is available. It does not create a background polling task.
 */
export async function checkNearbyCommunityHazards(
  location: CommunityHazardNotificationLocation
): Promise<number> {
  if (!isValidLocation(location)) {
    return 0;
  }

  try {
    // Respect Profile > Safety Alerts.
    if (!(await areSafetyNotificationsEnabled())) {
      return 0;
    }

    // Do not request notification permission when alerts are disabled.
    const permissionGranted =
      await requestSafetyNotificationPermission();

    if (!permissionGranted) {
      return 0;
    }

    // Check again in case the preference changed during permission handling.
    if (!(await areSafetyNotificationsEnabled())) {
      return 0;
    }

    const hazards = await getRecentHazards(50);

    if (!Array.isArray(hazards) || hazards.length === 0) {
      return 0;
    }

    const notifiedIds = new Set(
      await getNotifiedHazardIds()
    );

    const now = Date.now();
    let sentCount = 0;

    for (const hazard of hazards) {
      if (!hazard?.id || notifiedIds.has(hazard.id)) {
        continue;
      }

      if (
        !Number.isFinite(hazard.latitude) ||
        !Number.isFinite(hazard.longitude) ||
        hazard.latitude < -90 ||
        hazard.latitude > 90 ||
        hazard.longitude < -180 ||
        hazard.longitude > 180
      ) {
        continue;
      }

      const createdAt = getCreatedAtMilliseconds(
        hazard.createdAt
      );

      // Only notify when the report's age can be verified.
      if (createdAt === null) {
        continue;
      }

      const age = now - createdAt;

      if (age < 0 || age > MAX_HAZARD_AGE_MS) {
        continue;
      }

      const distance = distanceMeters(location, {
        latitude: hazard.latitude,
        longitude: hazard.longitude,
      });

      if (distance > NEARBY_RADIUS_METERS) {
        continue;
      }

      // Recheck immediately before scheduling each notification.
      if (!(await areSafetyNotificationsEnabled())) {
        break;
      }

      const title = getHazardLabel(hazard.type);
      const description =
        typeof hazard.title === "string" &&
        hazard.title.trim().length > 0
          ? hazard.title.trim()
          : "A recent community hazard was reported near you.";

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Nearby hazard: ${title}`,
          body: description.slice(0, 300),
          data: {
            type: "community-hazard",
            hazardId: hazard.id,
            hazardType: hazard.type,
            latitude: hazard.latitude,
            longitude: hazard.longitude,
          },
        },
        trigger: null,
      });

      // Save after scheduling so the same report is not repeatedly
      // announced if the next iteration or request fails.
      notifiedIds.add(hazard.id);

      await saveNotifiedHazardIds(notifiedIds);

      sentCount += 1;
    }

    return sentCount;
  } catch (error) {
    console.warn(
      "Could not check nearby community hazard notifications:",
      error
    );

    return 0;
  }
}

/**
 * Clears the local duplicate-notification history.
 *
 * This does not delete community reports from Firestore.
 */
export async function resetCommunityHazardNotificationHistory(): Promise<void> {
  await AsyncStorage.removeItem(NOTIFIED_HAZARDS_KEY);
}