export type SafetyFactorName =
  | "lighting"
  | "pedestrianAccess"
  | "traffic"
  | "hazards"
  | "routeInfrastructure";

export type SafetyFactor = {
  name: SafetyFactorName;
  score: number;
  weight: number;
  coverage: number;
  explanation: string;
};

export type SafetyScore = {
  score: number;
  label: "Data-informed" | "Estimated";
  dataCoverage: number;
  factors: SafetyFactor[];
  explanation: string;
};

export type SafetyRouteInput = {
  distanceMeters: number;
  durationSeconds: number;

  routeInfrastructure?: number;
  routeInfrastructureCoverage?: number;
  routeInfrastructureExplanation?: string;
  pedestrianAccess?: number;
  pedestrianAccessCoverage?: number;
  pedestrianAccessExplanation?: string;
  traffic?: number;
  trafficCoverage?: number;
  trafficExplanation?: string;
  hazards?: number;
  hazardsCoverage?: number;
  hazardsExplanation?: string;
  lighting?: number;
  lightingCoverage?: number;
  lightingExplanation?: string;
};