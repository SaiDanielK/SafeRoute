export type AmberAlert = {
  id: string;
  sent: string | null;
  event: string;
  headline: string;
  description: string;
  instruction: string;
  expires: string | null;
  senderName: string;
  areaDesc: string;
  web: string | null;
};

type FEMAResponse = {
  features?: Array<{
    attributes?: {
      identifier?: string;
      sent?: number | null;
      info_event?: string;
      info_headline?: string;
      info_description?: string;
      info_instruction?: string;
      info_expires?: number | null;
      info_sendername?: string;
      info_web?: string;
      info_area_areadesc?: string;
    };
  }>;
};

const FEMA_IPAWS_URL =
  "https://gis.fema.gov/arcgis/rest/services/FEMA/IPAWS_Archive/FeatureServer/1/query";

function cleanText(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

function convertFemaDate(
  value: number | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export async function getAmberAlerts(): Promise<AmberAlert[]> {
  const params = new URLSearchParams({
    where: "info_event = 'Child Abduction Emergency'",
    outFields:
      "identifier,sent,info_event,info_headline,info_description,info_instruction,info_expires,info_sendername,info_web,info_area_areadesc",
    orderByFields: "sent DESC",
    resultRecordCount: "10",
    returnGeometry: "false",
    f: "json",
  });

  const response = await fetch(
    `${FEMA_IPAWS_URL}?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `FEMA IPAWS request failed with status ${response.status}.`
    );
  }

  const data = (await response.json()) as FEMAResponse;

  return (data.features ?? [])
    .map((feature, index): AmberAlert | null => {
      const attributes = feature.attributes;

      if (!attributes) {
        return null;
      }

      return {
        id:
          cleanText(attributes.identifier) ||
          `amber-alert-${index}`,

        sent: convertFemaDate(attributes.sent),

        event:
          cleanText(attributes.info_event) ||
          "Child Abduction Emergency",

        headline:
          cleanText(attributes.info_headline) ||
          "AMBER Alert",

        description:
          cleanText(attributes.info_description) ||
          "A Child Abduction Emergency has been issued.",

        instruction:
          cleanText(attributes.info_instruction),

        expires: convertFemaDate(attributes.info_expires),

        senderName:
          cleanText(attributes.info_sendername) ||
          "FEMA IPAWS",

        areaDesc:
          cleanText(attributes.info_area_areadesc) ||
          "Area information unavailable",

        web:
          cleanText(attributes.info_web) || null,
      };
    })
    .filter(
      (alert): alert is AmberAlert => alert !== null
    );
}