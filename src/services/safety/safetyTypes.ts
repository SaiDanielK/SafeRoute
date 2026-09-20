export type SafetyFactorName =
  | "pedestrianInfrastructure"
  | "roadRisk"
  | "trafficRisk"
  | "communityReports"
  | "hazards"
  | "lighting"
  | "timeOfDay";

export type SafetyFactor = {
  name: SafetyFactorName;
  score: number;
  weight: number;
  explanation: string;
};

export type SafetyScore = {
  score: number;
  label: "Very Safe" | "Safer" | "Moderate" | "Caution" | "High Caution";
  factors: SafetyFactor[];
  explanation: string;
};

export type SafetyRouteInput = {
  distanceMeters: number;
  durationSeconds: number;

  pedestrianInfrastructure?: number;
  roadRisk?: number;
  trafficRisk?: number;
  communityReports?: number;
  hazards?: number;
  lighting?: number;
  timeOfDay?: number;
};