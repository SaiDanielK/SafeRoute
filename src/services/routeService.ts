import { scoreRouteInfrastructure } from "./safety/routeInfrastructure";
import type { RouteSafetyData } from "./safety/routeInfrastructure";
import { getTrafficSafetyAssessment } from "./trafficService";

export type RouteProfile =
  | "driving-car"
  | "cycling-regular"
  | "foot-walking";

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type RouteStep = {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  type: number;
  name: string;
  wayPoints: [number, number];
};

export type RouteAlternative = {
  coordinates: RouteCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
  safetyData?: RouteSafetyData;
};

export type RouteResult = {
  coordinates: RouteCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
  safetyData?: RouteSafetyData;
  alternatives?: RouteAlternative[];
};

const ORS_BASE_URL =
  "https://api.heigit.org/openrouteservice/v2/directions";

const MAX_ROUTE_DISTANCE_METERS = 6_000_000;

// ORS's alternative-routes algorithm has a 100 km limit.
const MAX_ALTERNATIVE_DISTANCE_METERS = 100_000;

function getStraightLineDistanceMeters(
  start: RouteCoordinate,
  destination: RouteCoordinate
): number {
  const earthRadiusMeters = 6_371_000;

  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180;

  const latitude1 = toRadians(start.latitude);
  const latitude2 = toRadians(destination.latitude);

  const deltaLatitude = toRadians(
    destination.latitude - start.latitude
  );

  const deltaLongitude = toRadians(
    destination.longitude - start.longitude
  );

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(deltaLongitude / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadiusMeters * c;
}

function parseRouteFeature(
  feature: any,
  profile: RouteProfile
): RouteAlternative {
  const distanceMeters =
    feature.properties?.summary?.distance ?? 0;

  const durationSeconds =
    feature.properties?.summary?.duration ?? 0;

  const coordinates =
    feature.geometry?.coordinates?.map(
      ([longitude, latitude]: [
        number,
        number
      ]) => ({
        latitude,
        longitude,
      })
    ) ?? [];

  const segments =
    feature.properties?.segments ?? [];

  const steps: RouteStep[] =
    segments.flatMap(
      (segment: any) =>
        (segment.steps ?? []).map(
          (step: any) => ({
            instruction:
              step.instruction ??
              "Continue on the route",
            distanceMeters:
              step.distance ?? 0,
            durationSeconds:
              step.duration ?? 0,
            type:
              step.type ?? 0,
            name:
              step.name ?? "",
            wayPoints:
              step.way_points ?? [0, 0],
          })
        )
    );

    const wayTypeSummary =
      feature.properties?.extras?.waytypes?.summary ??
      feature.properties?.extras?.waytype?.summary;

    const safetyData =
      Array.isArray(wayTypeSummary)
        ? scoreRouteInfrastructure(
            wayTypeSummary,
            distanceMeters,
            profile
          )
        : undefined;

  return {
    coordinates,
    distanceMeters,
    durationSeconds,
    steps,
      safetyData,
  };
}

async function requestRoute(
  start: RouteCoordinate,
  destination: RouteCoordinate,
  profile: RouteProfile,
  useAlternatives: boolean
): Promise<{
  features: any[];
  responseText: string;
}> {
  const apiKey =
    process.env.EXPO_PUBLIC_ORS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenRouteService API key is missing."
    );
  }

  const requestBody: any = {
    coordinates: [
      [
        start.longitude,
        start.latitude,
      ],
      [
        destination.longitude,
        destination.latitude,
      ],
    ],

    instructions: true,
    instructions_format: "text",
    language: "en",
  };

  if (useAlternatives) {
    requestBody.alternative_routes = {
      target_count: 3,
      weight_factor: 1.4,
      share_factor: 0.6,
    };
  }

  if (profile !== "driving-car") {
    requestBody.extra_info = ["waytype"];
  }

  const response = await fetch(
    `${ORS_BASE_URL}/${profile}/geojson`,
    {
      method: "POST",
      headers: {
        Authorization: apiKey.trim(),
        "Content-Type": "application/json",
        Accept: "application/geo+json",
      },
      body: JSON.stringify(requestBody),
    }
  );

  const responseText =
    await response.text();

  if (!response.ok) {
    console.error(
      "OpenRouteService error:",
      response.status,
      responseText
    );

    const error = new Error(
      `OpenRouteService error ${response.status}: ${responseText}`
    );

    // Preserve the response information so getRoute()
    // can recognize the specific alternative-route limit.
    (error as any).status = response.status;
    (error as any).responseText =
      responseText;

    throw error;
  }

  let data: any;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "OpenRouteService returned an invalid response."
    );
  }

  return {
    features: data.features ?? [],
    responseText,
  };
}

export async function getRoute(
  start: RouteCoordinate,
  destination: RouteCoordinate,
  profile: RouteProfile = "foot-walking"
): Promise<RouteResult> {
  const straightLineDistance =
    getStraightLineDistanceMeters(
      start,
      destination
    );

  /*
   * If the straight-line distance is already greater
   * than 100 km, the actual route cannot reasonably
   * be used with ORS's alternative-routes algorithm.
   *
   * We still request the normal route.
   */
  let useAlternatives =
    straightLineDistance <=
    MAX_ALTERNATIVE_DISTANCE_METERS;

  let features: any[];

  try {
    const result = await requestRoute(
      start,
      destination,
      profile,
      useAlternatives
    );

    features = result.features;
  } catch (error: any) {
    /*
     * For borderline cases, ORS may determine that
     * the actual route exceeds the 100 km alternative
     * limit even though the straight-line distance
     * was under 100 km.
     *
     * In that case, retry once without alternatives.
     */
    const responseText =
      error?.responseText ?? "";

    const isAlternativeRouteLimit =
      responseText.includes(
        "alternative Routes algorithm"
      ) ||
      responseText.includes(
        "100000.0 meters"
      );

    if (
      useAlternatives &&
      isAlternativeRouteLimit
    ) {
      console.warn(
        "ORS alternative-route limit reached. Retrying with the primary route only."
      );

      useAlternatives = false;

      const fallback =
        await requestRoute(
          start,
          destination,
          profile,
          false
        );

      features = fallback.features;
    } else {
      throw error;
    }
  }

  if (features.length === 0) {
    throw new Error(
      "OpenRouteService did not return a route."
    );
  }

  const parsedRoutes =
    await Promise.all(
      features.map(
        async (feature: any) => {
          const route = parseRouteFeature(
            feature,
            profile
          );
          const traffic =
            await getTrafficSafetyAssessment(
              route.coordinates
            );

          return {
            ...route,
            safetyData: {
              ...route.safetyData,
              trafficScore: traffic.score,
              trafficCoverage: traffic.coverage,
              trafficExplanation: traffic.explanation,
            },
          };
        }
      )
    );

  const primaryRoute =
    parsedRoutes[0];

  /*
   * This is SafeRoute's overall maximum route
   * distance. This remains 6,000 km.
   */
  if (
    primaryRoute.distanceMeters >
    MAX_ROUTE_DISTANCE_METERS
  ) {
    throw new Error(
      "This destination is too far away. SafeRoute currently supports routes up to 6,000 km."
    );
  }

  /*
   * If alternatives were not requested, or ORS only
   * returned the primary route, this simply becomes [].
   */
  const alternatives =
    useAlternatives
      ? parsedRoutes
          .slice(1)
          .filter(
            (route: RouteAlternative) =>
              route.coordinates.length > 1
          )
          .filter(
            (route: RouteAlternative) =>
              route.distanceMeters <=
              MAX_ROUTE_DISTANCE_METERS
          )
      : [];

  return {
    ...primaryRoute,
    alternatives,
  };
}