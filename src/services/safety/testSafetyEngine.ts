import { calculateSafetyScore } from "./SafetyEngine";

const safety = calculateSafetyScore({
  distanceMeters: 1800,
  durationSeconds: 1200,

  pedestrianInfrastructure: 95,
  roadRisk: 90,
  trafficRisk: 85,
  communityReports: 92,
  hazards: 95,
  lighting: 90,
  timeOfDay: 95,
});

console.log("=================================");
console.log("       SAFEROUTE SAFETY TEST");
console.log("=================================");
console.log("Safety Score:", safety.score);
console.log("Safety Label:", safety.label);
console.log("Explanation:", safety.explanation);
console.log("Factors:", safety.factors);
console.log("=================================");