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
};

export type RouteResult = {
  coordinates: RouteCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
  alternatives?: RouteAlternative[];
};

const ORS_BASE_URL =
  "https://api.heigit.org/openrouteservice/v2/directions";

const MAX_ROUTE_DISTANCE_METERS = 6_000_000;

function parseRouteFeature(
  feature: any
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

  return {
    coordinates,
    distanceMeters,
    durationSeconds,
    steps,
  };
}

export async function getRoute(
  start: RouteCoordinate,
  destination: RouteCoordinate,
  profile: RouteProfile = "foot-walking"
): Promise<RouteResult> {
  const apiKey =
    process.env.EXPO_PUBLIC_ORS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenRouteService API key is missing."
    );
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
      body: JSON.stringify({
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

        /*
         * Ask ORS for additional route choices.
         *
         * target_count = 3 means ORS will try
         * to return the main route plus up to
         * two alternatives.
         */
        alternative_routes: {
          target_count: 3,
          weight_factor: 1.4,
          share_factor: 0.6,
        },
      }),
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

    throw new Error(
      `OpenRouteService error ${response.status}: ${responseText}`
    );
  }

  let data: any;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "OpenRouteService returned an invalid response."
    );
  }

  const features =
    data.features ?? [];

  if (features.length === 0) {
    throw new Error(
      "OpenRouteService did not return a route."
    );
  }

  const parsedRoutes =
    features.map(
      (feature: any) =>
        parseRouteFeature(feature)
    );

  const primaryRoute =
    parsedRoutes[0];

  if (
    primaryRoute.distanceMeters >
    MAX_ROUTE_DISTANCE_METERS
  ) {
    throw new Error(
      "This destination is too far away. SafeRoute currently supports routes up to 6,000 km."
    );
  }

  const alternatives =
    parsedRoutes
      .slice(1)
      .filter(
        (route: RouteAlternative) =>
          route.coordinates.length > 1
      )
      .filter(
        (route: RouteAlternative) =>
          route.distanceMeters <=
          MAX_ROUTE_DISTANCE_METERS
      );

  return {
    ...primaryRoute,
    alternatives,
  };
}