import {
  RouteCoordinate,
} from "./routeService";
import { scoreTrafficFlow } from "./safety/trafficScoring";

export type TrafficColor =
  | "blue"
  | "yellow"
  | "red";

export type TrafficRouteSegment = {
  coordinates: RouteCoordinate[];
  color: TrafficColor;
};

export type TrafficSafetyAssessment = {
  score: number;
  coverage: number;
  explanation: string;
};

type TomTomFlowResponse = {
  flowSegmentData?: {
    currentSpeed?: number;
    freeFlowSpeed?: number;
    confidence?: number;
    roadClosure?: boolean;
    coordinates?: {
      coordinate?: Array<{
        latitude: number;
        longitude: number;
      }>;
    };
  };
};

const TOMTOM_API_KEY =
  process.env.EXPO_PUBLIC_TOMTOM_API_KEY;

const TOMTOM_BASE_URL =
  "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/14/json";

const BLUE_THRESHOLD = 0.85;
const YELLOW_THRESHOLD = 0.60;

const toRadians = (value: number) =>
  (value * Math.PI) / 180;

function haversineDistance(
  a: RouteCoordinate,
  b: RouteCoordinate
): number {
  const R = 6371000;

  const dLat = toRadians(
    b.latitude - a.latitude
  );

  const dLon = toRadians(
    b.longitude - a.longitude
  );

  const lat1 = toRadians(
    a.latitude
  );

  const lat2 = toRadians(
    b.latitude
  );

  const x =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.sin(dLon / 2) *
      Math.sin(dLon / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(x),
      Math.sqrt(1 - x)
    );

  return R * c;
}

function distanceSquared(
  a: RouteCoordinate,
  b: RouteCoordinate
): number {
  const latitudeScale =
    Math.cos(
      toRadians(
        (a.latitude + b.latitude) / 2
      )
    );

  const latitudeDifference =
    a.latitude - b.latitude;

  const longitudeDifference =
    (a.longitude - b.longitude) *
    latitudeScale;

  return (
    latitudeDifference *
      latitudeDifference +
    longitudeDifference *
      longitudeDifference
  );
}

function findClosestRouteIndex(
  route: RouteCoordinate[],
  coordinate: RouteCoordinate
): number {
  if (route.length === 0) {
    return -1;
  }

  let closestIndex = 0;

  let closestDistance =
    Number.POSITIVE_INFINITY;

  for (
    let i = 0;
    i < route.length;
    i++
  ) {
    const distance =
      distanceSquared(
        route[i],
        coordinate
      );

    if (
      distance <
      closestDistance
    ) {
      closestDistance =
        distance;

      closestIndex = i;
    }
  }

  return closestIndex;
}

function getTrafficColor(
  data:
    | TomTomFlowResponse["flowSegmentData"]
    | undefined
): TrafficColor {
  if (!data) {
    return "blue";
  }

  if (data.roadClosure) {
    return "red";
  }

  const currentSpeed =
    data.currentSpeed;

  const freeFlowSpeed =
    data.freeFlowSpeed;

  if (
    typeof currentSpeed !== "number" ||
    typeof freeFlowSpeed !== "number" ||
    freeFlowSpeed <= 0
  ) {
    return "blue";
  }

  const ratio =
    currentSpeed /
    freeFlowSpeed;

  if (
    ratio >= BLUE_THRESHOLD
  ) {
    return "blue";
  }

  if (
    ratio >= YELLOW_THRESHOLD
  ) {
    return "yellow";
  }

  return "red";
}

async function fetchTrafficPoint(
  coordinate: RouteCoordinate
): Promise<TomTomFlowResponse | null> {
  if (!TOMTOM_API_KEY) {
    console.warn(
      "TomTom API key is missing. Add EXPO_PUBLIC_TOMTOM_API_KEY to .env."
    );

    return null;
  }

  const url =
    `${TOMTOM_BASE_URL}` +
    `?key=${encodeURIComponent(
      TOMTOM_API_KEY
    )}` +
    `&point=${encodeURIComponent(
      `${coordinate.latitude},${coordinate.longitude}`
    )}` +
    `&unit=mph`;

  try {
    const response =
      await fetch(url);

    if (!response.ok) {
      console.warn(
        `TomTom traffic request failed: ${response.status}`
      );

      return null;
    }

    return (
      (await response.json()) as TomTomFlowResponse
    );
  } catch (error) {
    console.warn(
      "TomTom traffic request failed:",
      error
    );

    return null;
  }
}

export async function getTrafficSafetyAssessment(
  route: RouteCoordinate[]
): Promise<TrafficSafetyAssessment> {
  const fallback: TrafficSafetyAssessment = {
    score: 50,
    coverage: 0,
    explanation:
      "Neutral traffic estimate; live TomTom flow data is unavailable.",
  };

  if (route.length < 2 || !TOMTOM_API_KEY) {
    return fallback;
  }

  const sampleCount = Math.min(5, route.length);
  const samplePoints = Array.from(
    { length: sampleCount },
    (_, index) =>
      route[
        Math.round(
          (index * (route.length - 1)) /
            Math.max(1, sampleCount - 1)
        )
      ]
  ).filter(
    (coordinate): coordinate is RouteCoordinate =>
      coordinate !== undefined
  );

  const responses = await Promise.all(
    samplePoints.map(fetchTrafficPoint)
  );

  let weightedScore = 0;
  let totalConfidence = 0;
  let measuredCount = 0;

  for (const response of responses) {
    const flow = response?.flowSegmentData;

    if (
      !flow ||
      typeof flow.currentSpeed !== "number" ||
      typeof flow.freeFlowSpeed !== "number" ||
      flow.freeFlowSpeed <= 0
    ) {
      continue;
    }

    const confidence =
      typeof flow.confidence === "number" &&
      Number.isFinite(flow.confidence)
        ? Math.max(0.1, Math.min(1, flow.confidence))
        : 0.5;
    const score = scoreTrafficFlow(
      flow.currentSpeed,
      flow.freeFlowSpeed,
      flow.roadClosure
    );

    weightedScore += score * confidence;
    totalConfidence += confidence;
    measuredCount += 1;
  }

  if (totalConfidence === 0) {
    return fallback;
  }

  return {
    score: Math.round(weightedScore / totalConfidence),
    coverage: Math.round(
      (totalConfidence / samplePoints.length) * 100
    ),
    explanation:
      `Traffic estimate from ${measuredCount} sampled TomTom flow points; speed is compared with free-flow speed and weighted by provider confidence.`,
  };
}

function buildTomTomSegment(
  route: RouteCoordinate[],
  data:
    | TomTomFlowResponse["flowSegmentData"]
    | undefined
): TrafficRouteSegment | null {
  if (
    !data ||
    !data.coordinates?.coordinate ||
    data.coordinates.coordinate.length < 2
  ) {
    return null;
  }

  const tomTomCoordinates =
    data.coordinates.coordinate.map(
      (coordinate) => ({
        latitude:
          coordinate.latitude,
        longitude:
          coordinate.longitude,
      })
    );

  const firstTomTomPoint =
    tomTomCoordinates[0];

  const lastTomTomPoint =
    tomTomCoordinates[
      tomTomCoordinates.length - 1
    ];

  if (
    !firstTomTomPoint ||
    !lastTomTomPoint
  ) {
    return null;
  }

  const startIndex =
    findClosestRouteIndex(
      route,
      firstTomTomPoint
    );

  const endIndex =
    findClosestRouteIndex(
      route,
      lastTomTomPoint
    );

  if (
    startIndex < 0 ||
    endIndex < 0
  ) {
    return null;
  }

  const normalizedStart =
    Math.min(
      startIndex,
      endIndex
    );

  const normalizedEnd =
    Math.max(
      startIndex,
      endIndex
    );

  if (
    normalizedEnd <=
    normalizedStart
  ) {
    return null;
  }

  const routeCoordinates =
    route.slice(
      normalizedStart,
      normalizedEnd + 1
    );

  if (
    routeCoordinates.length < 2
  ) {
    return null;
  }

  return {
    coordinates:
      routeCoordinates,
    color:
      getTrafficColor(data),
  };
}

export async function getTrafficRouteSegments(
  route: RouteCoordinate[]
): Promise<TrafficRouteSegment[]> {
  if (route.length < 2) {
    return [];
  }

  if (!TOMTOM_API_KEY) {
    console.warn(
      "TomTom API key is missing. Traffic colors will remain blue."
    );

    return [];
  }

  /*
   * Query TomTom for every coordinate in the
   * ORS route.
   *
   * There is no artificial sampling distance,
   * maximum sample count, concurrency limit,
   * confidence cutoff, or route-match tolerance.
   */
  const results: Array<
    TomTomFlowResponse | null
  > = new Array(
    route.length
  ).fill(null);

  await Promise.all(
    route.map(
      async (
        coordinate,
        index
      ) => {
        results[index] =
          await fetchTrafficPoint(
            coordinate
          );
      }
    )
  );

  const segments: TrafficRouteSegment[] =
    [];

  for (
    let i = 0;
    i < results.length;
    i++
  ) {
    const result =
      results[i];

    const segment =
      buildTomTomSegment(
        route,
        result?.flowSegmentData
      );

    if (!segment) {
      continue;
    }

    segments.push(
      segment
    );
  }

  /*
   * Merge adjacent segments that have
   * the same TomTom-derived traffic color.
   */
  const cleanedSegments:
    TrafficRouteSegment[] =
    [];

  for (
    const segment of segments
  ) {
    const previous =
      cleanedSegments[
        cleanedSegments.length - 1
      ];

    if (
      previous &&
      previous.color ===
        segment.color
    ) {
      const previousEnd =
        previous.coordinates[
          previous.coordinates.length - 1
        ];

      const currentStart =
        segment.coordinates[0];

      if (
        previousEnd &&
        currentStart &&
        haversineDistance(
          previousEnd,
          currentStart
        ) < 100
      ) {
        previous.coordinates =
          previous.coordinates.concat(
            segment.coordinates.slice(1)
          );

        continue;
      }
    }

    cleanedSegments.push(
      segment
    );
  }

  return cleanedSegments;
}