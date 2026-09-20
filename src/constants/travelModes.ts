export type TravelMode = {
  id: "foot-walking" | "cycling-regular" | "driving-car";
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
};

export const TRAVEL_MODES: TravelMode[] = [
  {
    id: "driving-car",
    label: "Driving",
    shortLabel: "Drive",
    icon: "🚗",
    description: "Driving route",
  },
  {
    id: "cycling-regular",
    label: "Cycling",
    shortLabel: "Bike",
    icon: "🚲",
    description: "Cycling route",
  },
  {
    id: "foot-walking",
    label: "Walking",
    shortLabel: "Walk",
    icon: "🚶",
    description: "Walking route",
  },
];