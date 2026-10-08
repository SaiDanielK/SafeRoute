import { calculateSafetyScore } from "./SafetyEngine";
import { scoreRouteInfrastructure } from "./routeInfrastructure";
import {
  getRecommendedRouteIndex,
  getRouteComparison,
} from "./routeRecommendation";
import { scoreTrafficFlow } from "./trafficScoring";

function assert(
  condition: boolean,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const route = {
  distanceMeters: 1800,
  durationSeconds: 1200,
};

const baseline = calculateSafetyScore(route);
assert(baseline.score === 50, "Missing inputs should produce the neutral estimate.");
assert(baseline.dataCoverage === 0, "Fallback estimates should have zero evidence coverage.");
assert(
  baseline.label === "Estimated",
  "The score should be labeled as an estimate rather than insufficient."
);
assert(baseline.factors.length === 5, "All requested safety factors should be present.");
assert(
  baseline.factors.every((factor) => factor.score === 50),
  "Unknown factors should use a neutral baseline rather than appearing missing."
);

const measuredFactors = calculateSafetyScore({
  ...route,
  lighting: 92,
  lightingCoverage: 0,
  lightingExplanation: "Daylight proxy.",
  pedestrianAccess: 85,
  pedestrianAccessCoverage: 80,
  traffic: 78,
  trafficCoverage: 90,
  hazards: 50,
  hazardsCoverage: 0,
  routeInfrastructure: 89,
  routeInfrastructureCoverage: 95,
});
assert(measuredFactors.dataCoverage === 53, "Coverage should reflect measured factor evidence.");
assert(measuredFactors.score === 79, "The composite score should average the five equally weighted factors.");
assert(measuredFactors.label === "Data-informed", "Routes with substantial mapped/live coverage should not be labeled as generic estimates.");
assert(
  measuredFactors.factors.find((factor) => factor.name === "hazards")?.score === 50,
  "Unreported hazards should retain the documented neutral baseline."
);

const lowerScoringRoute = calculateSafetyScore({
  ...route,
  lighting: 40,
  lightingCoverage: 0,
  pedestrianAccess: 45,
  pedestrianAccessCoverage: 90,
  traffic: 55,
  trafficCoverage: 80,
  hazards: 50,
  hazardsCoverage: 0,
  routeInfrastructure: 48,
  routeInfrastructureCoverage: 90,
});
assert(
  measuredFactors.score !== lowerScoringRoute.score,
  "Different route-level factor data should produce different composite scores."
);

const walkingInfrastructure = scoreRouteInfrastructure(
  [
    { value: 7, distance: 800 },
    { value: 1, distance: 200 },
    { value: 0, distance: 100 },
  ],
  1100,
  "foot-walking"
);
assert(walkingInfrastructure?.infrastructureScore === 79, "Way types should be distance-weighted.");
assert(walkingInfrastructure?.infrastructureCoverage === 91, "Unknown way types should reduce coverage.");
assert(walkingInfrastructure?.pedestrianAccessScore === 81, "Pedestrian access should be scored separately from general infrastructure.");
assert(walkingInfrastructure?.pedestrianAccessCoverage === 91, "Pedestrian coverage should reflect mapped way types.");
assert(scoreTrafficFlow(50, 50) === 100, "Free-flow traffic should score at the top of the scale.");
assert(scoreTrafficFlow(30, 60) === 50, "Traffic should scale with observed versus free-flow speed.");
assert(scoreTrafficFlow(30, 60, true) === 0, "A road closure should receive the lowest traffic score.");
assert(scoreTrafficFlow(30, 0) === 50, "Invalid flow values should use the neutral fallback.");
assert(
  scoreRouteInfrastructure(
    [{ value: 6, distance: 1000 }],
    1000,
    "cycling-regular"
  )?.infrastructureScore === 95,
  "Cycleways should receive the cycling-specific infrastructure score."
);
assert(
  scoreRouteInfrastructure(
    [{ value: 1, distance: 1000 }],
    1000,
    "driving-car"
  ) === undefined,
  "Driving routes should not infer safety from road class alone."
);

assert(
  getRecommendedRouteIndex([
    { score: 80, durationSeconds: 600 },
    { score: 91, durationSeconds: 720 },
    { score: 90, durationSeconds: 500 },
  ]) === 1,
  "The highest-scoring route should be recommended even when slower."
);
assert(
  getRecommendedRouteIndex([
    { score: 90, durationSeconds: 700 },
    { score: 90, durationSeconds: 500 },
  ]) === 1,
  "The faster route should win a safety-score tie."
);
assert(
  getRecommendedRouteIndex([
    { score: null, durationSeconds: 600 },
    { score: null, durationSeconds: 700 },
  ]) === 0,
  "The provider's primary route should remain the fallback without scores."
);

const routeComparison = getRouteComparison([
  { score: 76, durationSeconds: 24 * 60 },
  { score: 92, durationSeconds: 29 * 60 },
]);
assert(routeComparison?.fastestIndex === 0, "Comparison should identify the fastest route.");
assert(routeComparison?.safestIndex === 1, "Comparison should identify the safest estimate.");
assert(routeComparison?.sameRoute === false, "Distinct fastest and safest options should stay distinct.");
assert(routeComparison?.safetyDifference === 16, "Comparison should calculate score difference.");
assert(routeComparison?.timeDifferenceSeconds === 5 * 60, "Comparison should calculate time difference.");

const sameRouteComparison = getRouteComparison([
  { score: 92, durationSeconds: 24 * 60 },
  { score: 80, durationSeconds: 29 * 60 },
  { score: 85, durationSeconds: 26 * 60 },
]);
assert(sameRouteComparison?.fastestIndex === 0, "The shortest route should remain fastest.");
assert(sameRouteComparison?.safestIndex === 0, "The highest score should identify the safest option.");
assert(sameRouteComparison?.sameRoute === true, "The chooser should identify when both badges belong on one route.");
assert(sameRouteComparison?.safetyDifference === 0, "Identical route comparisons should have zero score difference.");

console.log("Safety engine checks passed.");