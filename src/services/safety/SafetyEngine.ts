import {
  SafetyRouteInput,
  SafetyScore,
  SafetyFactor,
} from "./safetyTypes";

const DEFAULT_FACTORS = {
  pedestrianInfrastructure: 75,
  roadRisk: 75,
  trafficRisk: 75,
  communityReports: 80,
  hazards: 85,
  lighting: 75,
  timeOfDay: 80,
};

const WEIGHTS = {
  pedestrianInfrastructure: 0.20,
  roadRisk: 0.18,
  trafficRisk: 0.15,
  communityReports: 0.15,
  hazards: 0.15,
  lighting: 0.10,
  timeOfDay: 0.07,
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function getLabel(score: number): SafetyScore["label"] {
  if (score >= 90) return "Very Safe";
  if (score >= 80) return "Safer";
  if (score >= 65) return "Moderate";
  if (score >= 50) return "Caution";

  return "High Caution";
}

function createExplanation(
  score: number,
  factors: SafetyFactor[]
): string {
  const strongestFactors = [...factors]
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const weakestFactor = [...factors].sort(
    (a, b) => a.score - b.score
  )[0];

  const strongText = strongestFactors
    .map((factor) => factor.explanation)
    .join(" ");

  return `This route has a safety score of ${score}/100. ${strongText} The factor needing the most attention is ${weakestFactor.name}.`;
}

export function calculateSafetyScore(
  input: SafetyRouteInput
): SafetyScore {
  const values = {
    pedestrianInfrastructure:
      input.pedestrianInfrastructure ??
      DEFAULT_FACTORS.pedestrianInfrastructure,

    roadRisk:
      input.roadRisk ??
      DEFAULT_FACTORS.roadRisk,

    trafficRisk:
      input.trafficRisk ??
      DEFAULT_FACTORS.trafficRisk,

    communityReports:
      input.communityReports ??
      DEFAULT_FACTORS.communityReports,

    hazards:
      input.hazards ??
      DEFAULT_FACTORS.hazards,

    lighting:
      input.lighting ??
      DEFAULT_FACTORS.lighting,

    timeOfDay:
      input.timeOfDay ??
      DEFAULT_FACTORS.timeOfDay,
  };

  const factors: SafetyFactor[] = [
    {
      name: "pedestrianInfrastructure",
      score: clampScore(values.pedestrianInfrastructure),
      weight: WEIGHTS.pedestrianInfrastructure,
      explanation:
        "Pedestrian infrastructure contributes positively to route safety.",
    },

    {
      name: "roadRisk",
      score: clampScore(values.roadRisk),
      weight: WEIGHTS.roadRisk,
      explanation:
        "Road characteristics were considered when calculating the route score.",
    },

    {
      name: "trafficRisk",
      score: clampScore(values.trafficRisk),
      weight: WEIGHTS.trafficRisk,
      explanation:
        "Traffic conditions are included in the safety calculation.",
    },

    {
      name: "communityReports",
      score: clampScore(values.communityReports),
      weight: WEIGHTS.communityReports,
      explanation:
        "Community safety reports contribute to the route assessment.",
    },

    {
      name: "hazards",
      score: clampScore(values.hazards),
      weight: WEIGHTS.hazards,
      explanation:
        "Known hazards along the route affect the safety assessment.",
    },

    {
      name: "lighting",
      score: clampScore(values.lighting),
      weight: WEIGHTS.lighting,
      explanation:
        "Lighting conditions can affect how suitable a route is, especially at night.",
    },

    {
      name: "timeOfDay",
      score: clampScore(values.timeOfDay),
      weight: WEIGHTS.timeOfDay,
      explanation:
        "The time of day is considered when evaluating route conditions.",
    },
  ];

  const weightedScore = factors.reduce(
    (total, factor) =>
      total + factor.score * factor.weight,
    0
  );

  const score = Math.round(clampScore(weightedScore));

  return {
    score,
    label: getLabel(score),
    factors,
    explanation: createExplanation(score, factors),
  };
}