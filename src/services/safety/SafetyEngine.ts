import {
  SafetyRouteInput,
  SafetyScore,
  SafetyFactor,
  SafetyFactorName,
} from "./safetyTypes";

const FACTORS: Array<{
  name: SafetyFactorName;
  weight: number;
  fallbackScore: number;
}> = [
  { name: "lighting", weight: 0.2, fallbackScore: 50 },
  { name: "pedestrianAccess", weight: 0.2, fallbackScore: 50 },
  { name: "traffic", weight: 0.2, fallbackScore: 50 },
  { name: "hazards", weight: 0.2, fallbackScore: 50 },
  { name: "routeInfrastructure", weight: 0.2, fallbackScore: 50 },
];

const INPUTS: Record<
  SafetyFactorName,
  {
    score: keyof SafetyRouteInput;
    coverage: keyof SafetyRouteInput;
    explanation: keyof SafetyRouteInput;
    fallbackExplanation: string;
  }
> = {
  lighting: {
    score: "lighting",
    coverage: "lightingCoverage",
    explanation: "lightingExplanation",
    fallbackExplanation: "Lighting is a day/night estimate; mapped streetlight data is not connected.",
  },
  pedestrianAccess: {
    score: "pedestrianAccess",
    coverage: "pedestrianAccessCoverage",
    explanation: "pedestrianAccessExplanation",
    fallbackExplanation: "Pedestrian access uses ORS route-way classifications where available.",
  },
  traffic: {
    score: "traffic",
    coverage: "trafficCoverage",
    explanation: "trafficExplanation",
    fallbackExplanation: "Traffic uses sampled TomTom flow data where available.",
  },
  hazards: {
    score: "hazards",
    coverage: "hazardsCoverage",
    explanation: "hazardsExplanation",
    fallbackExplanation: "Neutral hazard estimate until a community report feed is connected.",
  },
  routeInfrastructure: {
    score: "routeInfrastructure",
    coverage: "routeInfrastructureCoverage",
    explanation: "routeInfrastructureExplanation",
    fallbackExplanation: "Infrastructure uses ORS route-way classifications where available.",
  },
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

export function calculateSafetyScore(
  input: SafetyRouteInput
): SafetyScore {
  const factors: SafetyFactor[] = FACTORS.map((factor) => {
    const inputKeys = INPUTS[factor.name];
    const rawScore = input[inputKeys.score];
    const rawCoverage = input[inputKeys.coverage];
    const rawExplanation = input[inputKeys.explanation];
    const score =
      typeof rawScore === "number" && Number.isFinite(rawScore)
        ? clampScore(rawScore)
        : factor.fallbackScore;
    const coverage =
      typeof rawCoverage === "number" && Number.isFinite(rawCoverage)
        ? clampScore(rawCoverage)
        : typeof rawScore === "number" && Number.isFinite(rawScore)
          ? 100
          : 0;

    return {
      name: factor.name,
      score,
      weight: factor.weight,
      coverage,
      explanation:
        typeof rawExplanation === "string"
          ? rawExplanation
          : inputKeys.fallbackExplanation,
    };
  });

  const score = Math.round(
    factors.reduce(
      (total, factor) => total + factor.score * factor.weight,
      0
    )
  );
  const dataCoverage = Math.round(
    factors.reduce(
      (total, factor) => total + factor.coverage * factor.weight,
      0
    )
  );
  const explanation =
    `Estimated route score ${score}/100. ${dataCoverage}% of factor weight uses mapped or live data; the remainder uses disclosed estimates.`;

  return {
    score,
    label:
      dataCoverage >= 50
        ? "Data-informed"
        : "Estimated",
    dataCoverage,
    factors,
    explanation,
  };
}