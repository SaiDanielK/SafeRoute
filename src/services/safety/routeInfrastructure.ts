export type RouteSafetyData = {
  infrastructureScore?: number;
  infrastructureCoverage?: number;
  pedestrianAccessScore?: number;
  pedestrianAccessCoverage?: number;
  trafficScore?: number;
  trafficCoverage?: number;
  trafficExplanation?: string;
  explanation?: string;
};

type InfrastructureProfile =
  | "foot-walking"
  | "cycling-regular"
  | "driving-car";

const WALKING_WAY_TYPE_SCORES: Record<number, number> = {
  1: 25,
  2: 40,
  3: 55,
  4: 78,
  5: 58,
  6: 65,
  7: 92,
  8: 45,
  9: 50,
  10: 10,
};

const CYCLING_WAY_TYPE_SCORES: Record<number, number> = {
  1: 25,
  2: 45,
  3: 60,
  4: 70,
  5: 55,
  6: 95,
  7: 30,
  8: 10,
  9: 50,
  10: 10,
};

const WALKING_ACCESS_SCORES: Record<number, number> = {
  1: 25,
  2: 42,
  3: 58,
  4: 78,
  5: 50,
  6: 60,
  7: 95,
  8: 48,
  9: 50,
  10: 10,
};

const CYCLING_ACCESS_SCORES: Record<number, number> = {
  1: 30,
  2: 48,
  3: 60,
  4: 72,
  5: 52,
  6: 94,
  7: 32,
  8: 12,
  9: 50,
  10: 10,
};

export function scoreRouteInfrastructure(
  summary: Array<{
    value?: number;
    distance?: number;
  }>,
  routeDistanceMeters: number,
  profile: InfrastructureProfile
): RouteSafetyData | undefined {
  const wayTypeScores =
    profile === "foot-walking"
      ? WALKING_WAY_TYPE_SCORES
      : profile === "cycling-regular"
        ? CYCLING_WAY_TYPE_SCORES
        : null;
  const accessScores =
    profile === "foot-walking"
      ? WALKING_ACCESS_SCORES
      : profile === "cycling-regular"
        ? CYCLING_ACCESS_SCORES
        : null;

  if (!wayTypeScores || !accessScores || routeDistanceMeters <= 0) {
    return undefined;
  }

  let mappedDistance = 0;
  let weightedScore = 0;
  let accessWeightedScore = 0;

  for (const entry of summary) {
    const score =
      typeof entry.value === "number"
        ? wayTypeScores[entry.value]
        : undefined;
    const distance = entry.distance;

    if (
      score === undefined ||
      typeof distance !== "number" ||
      !Number.isFinite(distance) ||
      distance <= 0
    ) {
      continue;
    }

    mappedDistance += distance;
    weightedScore += score * distance;
    accessWeightedScore += accessScores[entry.value!] * distance;
  }

  if (mappedDistance === 0) {
    return undefined;
  }

  const profileLabel =
    profile === "foot-walking"
      ? "walking"
      : "cycling";

  return {
    infrastructureScore: Math.round(
      weightedScore / mappedDistance
    ),
    infrastructureCoverage: Math.min(
      100,
      Math.round(
        (mappedDistance / routeDistanceMeters) * 100
      )
    ),
    pedestrianAccessScore: Math.round(
      accessWeightedScore / mappedDistance
    ),
    pedestrianAccessCoverage: Math.min(
      100,
      Math.round(
        (mappedDistance / routeDistanceMeters) * 100
      )
    ),
    explanation:
      `Preliminary ${profileLabel} infrastructure and access estimates from ORS mapped way types. These classifications do not confirm sidewalk protection, lighting, or current hazards.`,
  };
}