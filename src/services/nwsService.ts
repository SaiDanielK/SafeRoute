export type NWSAlert = {
  id: string;
  event: string;
  headline: string;
  description: string;
  instruction: string;
  severity: string;
  urgency: string;
  certainty: string;
  areaDesc: string;
  effective: string | null;
  expires: string | null;
  senderName: string;
  web: string | null;
};

type NWSApiResponse = {
  features?: Array<{
    id?: string;
    properties?: {
      event?: string;
      headline?: string;
      description?: string;
      instruction?: string;
      severity?: string;
      urgency?: string;
      certainty?: string;
      areaDesc?: string;
      effective?: string | null;
      expires?: string | null;
      senderName?: string;
      web?: string | null;
    };
  }>;
};

const NWS_API_BASE = "https://api.weather.gov";

const NWS_HEADERS = {
  Accept: "application/geo+json",
  "User-Agent": "SafeRoute Congressional App Challenge",
};

function cleanText(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

export async function getActiveNWSAlerts(
  latitude: number,
  longitude: number
): Promise<NWSAlert[]> {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Invalid coordinates for NWS alert request.");
  }

  const url =
    `${NWS_API_BASE}/alerts/active?point=` +
    `${encodeURIComponent(latitude)},${encodeURIComponent(longitude)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: NWS_HEADERS,
  });

  if (!response.ok) {
    throw new Error(
      `NWS request failed with status ${response.status}.`
    );
  }

  const data = (await response.json()) as NWSApiResponse;

  return (data.features ?? [])
    .map((feature, index): NWSAlert | null => {
      const properties = feature.properties;

      if (!properties) {
        return null;
      }

      return {
        id:
          feature.id ??
          `nws-alert-${index}-${properties.event ?? "unknown"}`,

        event: cleanText(properties.event) || "Weather Alert",

        headline:
          cleanText(properties.headline) ||
          cleanText(properties.event) ||
          "Weather Alert",

        description: cleanText(properties.description),

        instruction: cleanText(properties.instruction),

        severity: cleanText(properties.severity) || "Unknown",

        urgency: cleanText(properties.urgency) || "Unknown",

        certainty: cleanText(properties.certainty) || "Unknown",

        areaDesc:
          cleanText(properties.areaDesc) ||
          "Your current area",

        effective: properties.effective ?? null,

        expires: properties.expires ?? null,

        senderName:
          cleanText(properties.senderName) ||
          "National Weather Service",

        web: properties.web ?? null,
      };
    })
    .filter((alert): alert is NWSAlert => alert !== null);
}

export function getNWSAlertColor(
  severity: string
): string {
  switch (severity.toLowerCase()) {
    case "extreme":
      return "#FF3B30";

    case "severe":
      return "#FF9500";

    case "moderate":
      return "#FFD60A";

    case "minor":
      return "#30D158";

    default:
      return "#8E8E93";
  }
}

export function getNWSAlertIcon(
  event: string
): string {
  const normalized = event.toLowerCase();

  if (normalized.includes("tornado")) {
    return "🌪️";
  }

  if (
    normalized.includes("thunderstorm") ||
    normalized.includes("lightning")
  ) {
    return "⛈️";
  }

  if (
    normalized.includes("flood") ||
    normalized.includes("flash flood")
  ) {
    return "🌊";
  }

  if (
    normalized.includes("heat") ||
    normalized.includes("excessive heat")
  ) {
    return "🌡️";
  }

  if (
    normalized.includes("winter") ||
    normalized.includes("snow") ||
    normalized.includes("blizzard") ||
    normalized.includes("ice")
  ) {
    return "❄️";
  }

  if (
    normalized.includes("wind") ||
    normalized.includes("high wind")
  ) {
    return "💨";
  }

  if (
    normalized.includes("fire") ||
    normalized.includes("red flag")
  ) {
    return "🔥";
  }

  if (
    normalized.includes("hurricane") ||
    normalized.includes("tropical")
  ) {
    return "🌀";
  }

  if (normalized.includes("coastal")) {
    return "🌊";
  }

  return "⚠️";
}