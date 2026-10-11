
import { getRoute, type RouteCoordinate } from "../routeService";
import {
  getRecentHazards,
  type CommunityHazard,
} from "../hazardService";
import { calculateSafetyScore } from "./SafetyEngine";
import type { SafetyScore } from "./safetyTypes";

const HAZARD_SEARCH_RADIUS_METERS = 300;

function distanceMeters(
  first: RouteCoordinate,
  second: RouteCoordinate
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6_371_000;

  const lat1 = radians(first.latitude);
  const lat2 = radians(second.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = radians(second.longitude - first.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) ** 2;

  return earthRadius * 2 * Math.atan2(
    Math.sqrt(a),
    Math.sqrt(Math.max(0, 1 - a))
  );
}

function getHazardTime(value: unknown): number | null {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();

    return date instanceof Date ? date.getTime() : null;
  }

  if (typeof value === "string" || typeof value === "number") {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
  }

  return null;
}

function getHazardSeverity(type: string): number {
  switch (type.toLowerCase()) {
    case "road_closed":
      return 46;
    case "flooding":
      return 38;
    case "accident":
      return 32;
    case "unsafe_area":
      return 28;
    case "debris":
      return 23;
    case "construction":
      return 17;
    case "traffic":
      return 12;
    default:
      return 10;
  }
}

function getHazardRecency(createdAt: unknown): number {
  const timestamp = getHazardTime(createdAt);

  if (timestamp === null) return 0.5;

  const ageDays = Math.max(
    0,
    (Date.now() - timestamp) / 86_400_000
  );

  if (ageDays <= 1) return 1;
  if (ageDays <= 7) return 0.85;
  if (ageDays <= 30) return 0.6;

  return 0.3;
}

function scoreNearbyHazards(
  routeCoordinates: RouteCoordinate[],
  hazards: CommunityHazard[]
): {
  score: number;
  coverage: number;
  explanation: string;
} {
  if (routeCoordinates.length === 0) {
    return {
      score: 50,
      coverage: 0,
      explanation: "Route geometry is unavailable for nearby hazard assessment.",
    };
  }

  const nearby = hazards.filter((hazard) => {
    const point = {
      latitude: hazard.latitude,
      longitude: hazard.longitude,
    };

    return routeCoordinates.some(
      (coordinate) =>
        distanceMeters(point, coordinate) <=
        HAZARD_SEARCH_RADIUS_METERS
    );
  });

  if (nearby.length === 0) {
    return {
      score: 50,
      coverage: 0,
      explanation:
        "No community reports were found near this route. This does not confirm that the route is hazard-free.",
    };
  }

  let penalty = 0;

  for (const hazard of nearby) {
    const point = {
      latitude: hazard.latitude,
      longitude: hazard.longitude,
    };

    let nearestDistance = Infinity;

    for (const coordinate of routeCoordinates) {
      nearestDistance = Math.min(
        nearestDistance,
        distanceMeters(point, coordinate)
      );
    }

    const proximityMultiplier =
      nearestDistance <= 40
        ? 1
        : nearestDistance <= 100
          ? 0.75
          : nearestDistance <= 200
            ? 0.45
            : 0.2;

    penalty +=
      getHazardSeverity(String(hazard.type ?? "")) *
      proximityMultiplier *
      getHazardRecency(hazard.createdAt);
  }

  penalty = Math.min(50, penalty);

  return {
    score: Math.max(0, Math.min(100, Math.round(50 - penalty))),
    coverage: Math.min(100, 60 + nearby.length * 10),
    explanation:
      `${nearby.length} community hazard report(s) were found near this route. Reports may be incomplete or outdated.`,
  };
}

/**
 * Estimates safety along a short walking route starting near
 * the user's current GPS coordinates. This is not a guarantee
 * of overall neighborhood safety.
 */
export async function getCurrentLocationSafetyScore(
  location: RouteCoordinate
): Promise<SafetyScore> {
  // Approximately 110 metres north of the current GPS location.
  const destination: RouteCoordinate = {
    latitude: Math.max(
      -90,
      Math.min(90, location.latitude + 0.001)
    ),
    longitude: location.longitude,
  };

  const [route, hazards] = await Promise.all([
    getRoute(location, destination, "foot-walking"),
    getRecentHazards(100),
  ]);

  const hazardAssessment = scoreNearbyHazards(
    route.coordinates,
    hazards
  );

  const hour = new Date().getHours();
  const daytimeEstimate = hour >= 7 && hour < 19;

  return calculateSafetyScore({
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,

    routeInfrastructure:
      route.safetyData?.infrastructureScore,
    routeInfrastructureCoverage:
      route.safetyData?.infrastructureCoverage,
    routeInfrastructureExplanation:
      route.safetyData?.explanation,

    pedestrianAccess:
      route.safetyData?.pedestrianAccessScore,
    pedestrianAccessCoverage:
      route.safetyData?.pedestrianAccessCoverage,
    pedestrianAccessExplanation:
      "Estimated from ORS route-way classifications; sidewalk conditions are not verified.",

    traffic: route.safetyData?.trafficScore,
    trafficCoverage: route.safetyData?.trafficCoverage,
    trafficExplanation:
      route.safetyData?.trafficExplanation,

    lighting: daytimeEstimate ? 70 : 35,
    lightingCoverage: 0,
    lightingExplanation: daytimeEstimate
      ? "Daytime proxy only; mapped streetlight data is not connected."
      : "Nighttime proxy only; mapped streetlight data is not connected.",

    hazards: hazardAssessment.score,
    hazardsCoverage: hazardAssessment.coverage,
    hazardsExplanation: hazardAssessment.explanation,
  });
}