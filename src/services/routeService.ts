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

export type RouteResult = {
  coordinates: RouteCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
};

const ORS_BASE_URL =
  "https://api.heigit.org/openrouteservice/v2/directions";

const MAX_ROUTE_DISTANCE_METERS = 6_000_000;

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
          [start.longitude, start.latitude],
          [destination.longitude, destination.latitude],
        ],
        instructions: true,
        instructions_format: "text",
        language: "en",
      }),
    }
  );

  const responseText = await response.text();

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

  const feature = data.features?.[0];

  if (!feature) {
    throw new Error(
      "OpenRouteService did not return a route."
    );
  }

  const distanceMeters =
    feature.properties?.summary?.distance ?? 0;

  const durationSeconds =
    feature.properties?.summary?.duration ?? 0;

  // SafeRoute maximum route distance:
  // 6,000,000 meters = 6,000 km
  if (distanceMeters > MAX_ROUTE_DISTANCE_METERS) {
    throw new Error(
      "This destination is too far away. SafeRoute currently supports routes up to 6,000 km."
    );
  }

  const coordinates =
    feature.geometry.coordinates.map(
      ([longitude, latitude]: [
        number,
        number
      ]) => ({
        latitude,
        longitude,
      })
    );

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
            type: step.type ?? 0,
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