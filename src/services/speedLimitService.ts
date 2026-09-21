const OVERPASS_URL =
  "https://overpass-api.de/api/interpreter";

export type SpeedLimitResult = {
  speedLimitMph: number | null;
  roadName: string | null;
  distanceMeters: number | null;
};

type OverpassElement = {
  type: string;
  id: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: {
    highway?: string;
    name?: string;
    maxspeed?: string;
    "maxspeed:forward"?: string;
    "maxspeed:backward"?: string;
  };
};

/**
 * Converts an OpenStreetMap maxspeed value into MPH.
 *
 * Examples:
 *   "35"       -> 35 mph
 *   "35 mph"   -> 35 mph
 *   "50 km/h"  -> 31 mph
 *   "50"       -> 31 mph in the US
 */
function parseMaxspeed(
  value?: string
): number | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase();

  if (
    normalized === "none" ||
    normalized === "signals" ||
    normalized === "variable" ||
    normalized === "walk"
  ) {
    return null;
  }

  const numberMatch =
    normalized.match(/\d+(?:\.\d+)?/);

  if (!numberMatch) {
    return null;
  }

  const number = Number(numberMatch[0]);

  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }

  if (
    normalized.includes("km/h") ||
    normalized.includes("kph") ||
    normalized.includes("kmh")
  ) {
    return Math.round(
      number * 0.621371
    );
  }

  if (
    normalized.includes("mph") ||
    normalized.includes("mi/h")
  ) {
    return Math.round(number);
  }

  // In the United States, a bare numeric maxspeed
  // is generally interpreted as MPH.
  return Math.round(number);
}

function getDistanceMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number {
  const earthRadius = 6371000;

  const lat1 =
    (latitude1 * Math.PI) / 180;
  const lat2 =
    (latitude2 * Math.PI) / 180;

  const deltaLat =
    ((latitude2 - latitude1) * Math.PI) /
    180;

  const deltaLon =
    ((longitude2 - longitude1) * Math.PI) /
    180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
}

function getElementLocation(
  element: OverpassElement
): {
  latitude: number;
  longitude: number;
} | null {
  if (element.center) {
    return {
      latitude: element.center.lat,
      longitude: element.center.lon,
    };
  }

  return null;
}

function chooseSpeedLimit(
  tags?: OverpassElement["tags"]
): number | null {
  if (!tags) {
    return null;
  }

  // Prefer the normal road speed limit first.
  const normalSpeed = parseMaxspeed(
    tags.maxspeed
  );

  if (normalSpeed !== null) {
    return normalSpeed;
  }

  // Direction-specific speed limits can exist in OSM.
  const forwardSpeed = parseMaxspeed(
    tags["maxspeed:forward"]
  );

  if (forwardSpeed !== null) {
    return forwardSpeed;
  }

  const backwardSpeed = parseMaxspeed(
    tags["maxspeed:backward"]
  );

  if (backwardSpeed !== null) {
    return backwardSpeed;
  }

  return null;
}

/**
 * Finds the nearest mapped road with a usable maxspeed value.
 *
 * This intentionally searches a relatively small area around
 * the user so we don't make unnecessarily large Overpass
 * requests while navigating.
 */
export async function getSpeedLimit(
  latitude: number,
  longitude: number
): Promise<SpeedLimitResult> {
  try {
    const radiusMeters = 80;

    const query = `
[out:json][timeout:10];

way(
  around:${radiusMeters},${latitude},${longitude}
)
[highway]
["maxspeed"];

out center tags;
`;

    const response = await fetch(
      OVERPASS_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body:
          "data=" +
          encodeURIComponent(query),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Overpass request failed: ${response.status}`
      );
    }

    const data =
      await response.json();

    const elements =
      (data.elements ??
        []) as OverpassElement[];

    let closest: SpeedLimitResult = {
      speedLimitMph: null,
      roadName: null,
      distanceMeters: null,
    };

    for (const element of elements) {
      const location =
        getElementLocation(element);

      if (!location) {
        continue;
      }

      const speedLimit =
        chooseSpeedLimit(element.tags);

      if (speedLimit === null) {
        continue;
      }

      const distance =
        getDistanceMeters(
          latitude,
          longitude,
          location.latitude,
          location.longitude
        );

      if (
        closest.distanceMeters === null ||
        distance <
          closest.distanceMeters
      ) {
        closest = {
          speedLimitMph: speedLimit,
          roadName:
            element.tags?.name ??
            null,
          distanceMeters: distance,
        };
      }
    }

    return closest;
  } catch (error) {
    console.warn(
      "Speed limit lookup failed:",
      error
    );

    return {
      speedLimitMph: null,
      roadName: null,
      distanceMeters: null,
    };
  }
}