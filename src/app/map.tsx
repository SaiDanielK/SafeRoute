import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { Ionicons } from "@expo/vector-icons";
import { Region } from "react-native-maps";

import SafeRouteMap from "../components/SafeRouteMap";
import DestinationSearch from "../components/DestinationSearch";
import NavigationPanel, {
  type NavigationPreviewStep,
} from "../components/NavigationPanel";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getRoute,
  RouteCoordinate,
  RouteResult,
  RouteStep,
} from "../services/routeService";

import { getSpeedLimit } from "../services/speedLimitService";
import { getRecentHazards, type CommunityHazard } from "../services/hazardService";

import {
  calculateSafetyScore,
} from "../services/safety/SafetyEngine";

import {
  SafetyFactorName,
  SafetyScore,
} from "../services/safety/safetyTypes";

import {
  getRecommendedRouteIndex,
  getRouteComparison,
} from "../services/safety/routeRecommendation";

import {
  getTrafficRouteSegments,
  TrafficRouteSegment,
} from "../services/trafficService";

import {
  formatDuration,
} from "../utils/formatters";

import { saveCompletedTrip } from "../services/tripHistoryService";

type TravelMode =
  | "driving-car"
  | "cycling-regular"
  | "foot-walking";

const TRAVEL_MODES: Record<
  TravelMode,
  {
    label: string;
    icon: string;
  }
> = {
  "foot-walking": {
    label: "Walk",
    icon: "walk",
  },

  "cycling-regular": {
    label: "Bike",
    icon: "bicycle",
  },

  "driving-car": {
    label: "Drive",
    icon: "car",
  },
};

type Destination = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type LivePosition = {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
};

const ARRIVAL_DISTANCE_WALKING = 35;
const ARRIVAL_DISTANCE_DRIVING = 60;

const OFF_ROUTE_DISTANCE_WALKING = 65;
const OFF_ROUTE_DISTANCE_DRIVING = 95;

const OFF_ROUTE_REQUIRED_UPDATES = 2;
const REROUTE_COOLDOWN_MS = 8000;

const VOICE_ADVANCE_WALKING = 120;
const VOICE_ADVANCE_DRIVING = 250;

const COMPACT_SCREEN_RATIO = 0.99;

const TRAFFIC_REFRESH_MS = 60000;

const PROFILE_SETTINGS_KEY = "@saferoute_profile_settings";

const toRadians = (value: number) =>
  (value * Math.PI) / 180;

function haversineDistance(
  a: RouteCoordinate,
  b: RouteCoordinate
): number {
  const R = 6371000;

  const dLat =
    toRadians(
      b.latitude - a.latitude
    );

  const dLon =
    toRadians(
      b.longitude - a.longitude
    );

  const lat1 =
    toRadians(a.latitude);

  const lat2 =
    toRadians(b.latitude);

  const x =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.sin(dLon / 2) *
      Math.sin(dLon / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(x),
      Math.sqrt(1 - x)
    );

  return R * c;
}

function closestRouteIndex(
  position: RouteCoordinate,
  route: RouteCoordinate[]
): number {
  if (!route.length) {
    return 0;
  }

  let closestIndex = 0;
  let closestDistance = Infinity;

  route.forEach(
    (point, index) => {
      const distance =
        haversineDistance(
          position,
          point
        );

      if (
        distance <
        closestDistance
      ) {
        closestDistance =
          distance;

        closestIndex =
          index;
      }
    }
  );

  return closestIndex;
}

function distanceToRoute(
  position: RouteCoordinate,
  route: RouteCoordinate[]
): number {
  if (!route.length) {
    return Infinity;
  }

  let closest = Infinity;

  route.forEach((point) => {
    const distance =
      haversineDistance(
        position,
        point
      );

    if (distance < closest) {
      closest = distance;
    }
  });

  return closest;
}

function getCurrentStepIndex(
  position: RouteCoordinate,
  route: RouteCoordinate[],
  steps: RouteStep[],
  fallbackIndex: number
): number {
  if (
    !steps.length ||
    !route.length
  ) {
    return fallbackIndex;
  }

  const closestIndex =
    closestRouteIndex(
      position,
      route
    );

  let current = 0;

  steps.forEach(
    (step, index) => {
      const endIndex =
        step.wayPoints?.[1];

      if (
        typeof endIndex ===
          "number" &&
        closestIndex >=
          endIndex
      ) {
        current = index;
      }
    }
  );

  return Math.min(
    current,
    steps.length - 1
  );
}

function getRemainingRouteDistance(
  position: RouteCoordinate,
  route: RouteCoordinate[]
): number {
  if (!route.length) {
    return 0;
  }

  const index =
    closestRouteIndex(
      position,
      route
    );

  let remaining =
    haversineDistance(
      position,
      route[index]
    );

  for (
    let i = index;
    i < route.length - 1;
    i++
  ) {
    remaining +=
      haversineDistance(
        route[i],
        route[i + 1]
      );
  }

  return remaining;
}

function formatDistance(
  meters: number
): string {
  if (
    !Number.isFinite(meters)
  ) {
    return "0 m";
  }

  if (meters < 1000) {
    return `${Math.max(
      1,
      Math.round(meters)
    )} m`;
  }

  return `${(
    meters / 1000
  ).toFixed(1)} km`;
}

function getAdvanceDistance(
  travelMode: TravelMode
): number {
  if (
    travelMode ===
    "driving-car"
  ) {
    return VOICE_ADVANCE_DRIVING;
  }

  return VOICE_ADVANCE_WALKING;
}

function speak(text: string) {
  Speech.stop();

  Speech.speak(text, {
    rate: 0.8,
    pitch: 1.0,
  });
}

const HAZARD_ROUTE_SEARCH_RADIUS_METERS = 300;

type HazardImpact = {
  score: number;
  coverage: number;
  explanation: string;
  nearbyCount: number;
  penalty: number;
};

function getDistanceToRouteSegmentMeters(
  point: RouteCoordinate,
  start: RouteCoordinate,
  end: RouteCoordinate
): number {
  const latitudeScale = Math.cos(toRadians(point.latitude));
  const startX = (start.longitude - point.longitude) * latitudeScale * 111320;
  const startY = (start.latitude - point.latitude) * 111320;
  const endX = (end.longitude - point.longitude) * latitudeScale * 111320;
  const endY = (end.latitude - point.latitude) * 111320;
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.sqrt(startX * startX + startY * startY);
  }

  const t = Math.max(
    0,
    Math.min(1, -(startX * dx + startY * dy) / lengthSquared)
  );
  const closestX = startX + t * dx;
  const closestY = startY + t * dy;

  return Math.sqrt(closestX * closestX + closestY * closestY);
}

function getDistanceToRouteMeters(
  point: RouteCoordinate,
  route: RouteCoordinate[]
): number {
  if (!route.length) return Number.POSITIVE_INFINITY;
  if (route.length === 1) {
    const latitudeDifference = (route[0].latitude - point.latitude) * 111320;
    const longitudeDifference =
      (route[0].longitude - point.longitude) *
      111320 *
      Math.cos(toRadians(point.latitude));
    return Math.sqrt(
      latitudeDifference * latitudeDifference +
      longitudeDifference * longitudeDifference
    );
  }

  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < route.length - 1; index += 1) {
    minimum = Math.min(
      minimum,
      getDistanceToRouteSegmentMeters(point, route[index], route[index + 1])
    );
  }
  return minimum;
}

function getHazardTimestamp(value: unknown): number | null {
  try {
    if (
      value &&
      typeof value === "object" &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate === "function"
    ) {
      const date = (value as { toDate: () => Date }).toDate();
      const timestamp = date.getTime();
      return Number.isFinite(timestamp) ? timestamp : null;
    }

    if (value instanceof Date) {
      const timestamp = value.getTime();
      return Number.isFinite(timestamp) ? timestamp : null;
    }

    if (typeof value === "string" || typeof value === "number") {
      const timestamp = new Date(value).getTime();
      return Number.isFinite(timestamp) ? timestamp : null;
    }
  } catch {
    return null;
  }

  return null;
}

function getHazardSeverity(type: string): number {
  switch (type) {
    case "road_closed": return 46;
    case "flooding": return 38;
    case "accident": return 32;
    case "unsafe_area": return 28;
    case "debris": return 23;
    case "construction": return 17;
    case "traffic": return 12;
    default: return 10;
  }
}

function getHazardAlertLabel(type: string): string {
  switch (type) {
    case "road_closed": return "Road closure";
    case "flooding": return "Flooding";
    case "accident": return "Accident";
    case "unsafe_area": return "Unsafe area";
    case "debris": return "Road debris";
    case "construction": return "Construction";
    case "traffic": return "Traffic";
    default: return "Reported hazard";
  }
}

function getHazardRecencyMultiplier(createdAt: unknown): number {
  const timestamp = getHazardTimestamp(createdAt);
  if (timestamp === null) return 0.5;

  const ageDays = Math.max(0, Date.now() - timestamp) / 86400000;
  if (ageDays <= 1) return 1;
  if (ageDays <= 7) return 0.85;
  if (ageDays <= 30) return 0.6;
  return 0.3;
}

function getRouteHazardImpact(
  route: RouteResult,
  communityHazards: CommunityHazard[]
): HazardImpact {
  if (!route.coordinates || route.coordinates.length < 2) {
    return {
      score: 50,
      coverage: 0,
      explanation: "Route geometry is unavailable for community-hazard analysis.",
      nearbyCount: 0,
      penalty: 0,
    };
  }

  const nearbyHazards = communityHazards
    .map((hazard) => ({
      hazard,
      distance: getDistanceToRouteMeters(
        { latitude: hazard.latitude, longitude: hazard.longitude },
        route.coordinates
      ),
    }))
    .filter(({ distance }) => distance <= HAZARD_ROUTE_SEARCH_RADIUS_METERS);

  if (!nearbyHazards.length) {
    return {
      score: 50,
      coverage: 0,
      explanation:
        "No community reports were found within 300 m. This does not confirm the route is hazard-free.",
      nearbyCount: 0,
      penalty: 0,
    };
  }

  let totalPenalty = 0;
  for (const { hazard, distance } of nearbyHazards) {
    const proximityMultiplier =
      distance <= 40 ? 1 :
      distance <= 100 ? 0.75 :
      distance <= 200 ? 0.45 : 0.2;

    totalPenalty +=
      getHazardSeverity(hazard.type) *
      proximityMultiplier *
      getHazardRecencyMultiplier(hazard.createdAt);
  }

  // Cap the penalty so duplicate reports cannot create negative scores.
  const penalty = Math.min(50, totalPenalty);
  const score = Math.max(0, Math.min(100, Math.round(50 - penalty)));
  const countLabel = nearbyHazards.length === 1 ? "report" : "reports";

  return {
    score,
    coverage: Math.min(100, 60 + nearbyHazards.length * 10),
    explanation:
      `${nearbyHazards.length} community ${countLabel} found within 300 m. ` +
      "The hazard score considers report category, distance from the route, and report age. Reports are community-submitted and unverified.",
    nearbyCount: nearbyHazards.length,
    penalty,
  };
}

function getRouteSafetyScore(
  route: RouteResult,
  communityHazards: CommunityHazard[] = []
): SafetyScore {
  const localHour = new Date().getHours();
  const isDaylightEstimate = localHour >= 7 && localHour < 19;
  const hazardImpact = getRouteHazardImpact(route, communityHazards);

  return calculateSafetyScore({
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    routeInfrastructure: route.safetyData?.infrastructureScore,
    routeInfrastructureCoverage: route.safetyData?.infrastructureCoverage,
    routeInfrastructureExplanation: route.safetyData?.explanation,
    pedestrianAccess: route.safetyData?.pedestrianAccessScore,
    pedestrianAccessCoverage: route.safetyData?.pedestrianAccessCoverage,
    pedestrianAccessExplanation:
      "Estimated from ORS way types; this does not verify sidewalk condition or separation from traffic.",
    traffic: route.safetyData?.trafficScore,
    trafficCoverage: route.safetyData?.trafficCoverage,
    trafficExplanation: route.safetyData?.trafficExplanation,
    lighting: isDaylightEstimate ? 70 : 35,
    lightingCoverage: 0,
    lightingExplanation: isDaylightEstimate
      ? "Daytime proxy only; mapped streetlight data is not connected."
      : "Nighttime proxy only; mapped streetlight data is not connected.",
    hazards: hazardImpact.score,
    hazardsCoverage: hazardImpact.coverage,
    hazardsExplanation: hazardImpact.explanation,
  });
}

function getSafetyFactorLabel(
  factorName: SafetyFactorName
): string {
  switch (factorName) {
    case "lighting":
      return "Lighting";
    case "pedestrianAccess":
      return "Pedestrian access";
    case "traffic":
      return "Traffic";
    case "hazards":
      return "Hazards";
    case "routeInfrastructure":
      return "Infrastructure";
  }
}

function getRecommendedRouteIndexForRoutes(
  routes: RouteResult[],
  communityHazards: CommunityHazard[] = []
): number {
  return getRecommendedRouteIndex(
    routes.map((route) => ({
      score: getRouteSafetyScore(route, communityHazards).score,
      durationSeconds: route.durationSeconds,
    }))
  );
}

function getRouteComparisonLabel(
  index: number,
  routes: RouteResult[],
  communityHazards: CommunityHazard[] = []
): string {
  if (index === getRecommendedRouteIndexForRoutes(routes, communityHazards)) {
    return "Recommended";
  }

  if (!routes[index] || routes.length === 0) {
    return "Alternative";
  }

  const fastestDuration = Math.min(
    ...routes.map((route) => route.durationSeconds)
  );
  const difference =
    routes[index].durationSeconds - fastestDuration;

  return difference <= 60
    ? "Similar time"
    : "Alternative";
}

function formatRouteTimeDifference(
  differenceSeconds: number
): string {
  if (differenceSeconds === 0) {
    return "Same time";
  }

  if (Math.abs(differenceSeconds) < 60) {
    const sign = differenceSeconds > 0 ? "+" : "-";
    return `${sign}${Math.abs(differenceSeconds)} sec`;
  }

  const sign = differenceSeconds > 0 ? "+" : "-";
  return `${sign}${Math.round(
    Math.abs(differenceSeconds) / 60
  )} min`;
}

function toMapRegion(
  latitude: number,
  longitude: number
): Region {
  return {
    latitude,
    longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
}

export default function MapScreen() {
  const handledDestinationParams = useRef("");
  const params = useLocalSearchParams<{
    saveSlot?: string;
    saveName?: string;
    saveId?: string;
    routeDestinationName?: string;
    routeDestinationAddress?: string;
    routeDestinationLatitude?: string;
    routeDestinationLongitude?: string;
  }>();

  const [region, setRegion] =
    useState<Region | null>(null);

  const [destination, setDestination] =
    useState<Destination | null>(
      null
    );

  const [previewStepIndex, setPreviewStepIndex] =
    useState<number | null>(null);  

  const [
    routeCoordinates,
    setRouteCoordinates,
  ] = useState<
    RouteCoordinate[]
  >([]);

  const [routeInfo, setRouteInfo] =
    useState<RouteResult | null>(
      null
    );

  const [
    availableRoutes,
    setAvailableRoutes,
  ] = useState<RouteResult[]>([]);

  const [
    selectedRouteIndex,
    setSelectedRouteIndex,
  ] = useState(0);

  const [
    routeLoading,
    setRouteLoading,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [
    locationEnabled,
    setLocationEnabled,
  ] = useState(false);

  const [locationPreferenceLoaded, setLocationPreferenceLoaded] =
    useState(false);
  const colorScheme = useColorScheme();
  const isDarkTheme = colorScheme === "dark";

  const [
    travelMode,
    setTravelMode,
  ] = useState<TravelMode>(
    "foot-walking"
  );

  const [
    navigationActive,
    setNavigationActive,
  ] = useState(false);

  const [
    navigationStepIndex,
    setNavigationStepIndex,
  ] = useState(0);

  const [
    navigationPosition,
    setNavigationPosition,
  ] = useState<LivePosition | null>(
    null
  );

  const [
    remainingDistanceMeters,
    setRemainingDistanceMeters,
  ] = useState(0);

  const [
    remainingDurationSeconds,
    setRemainingDurationSeconds,
  ] = useState(0);

  const [
    speedLimit,
    setSpeedLimit,
  ] = useState<number | null>(
    null
  );

  const [
    voiceEnabled,
    setVoiceEnabled,
  ] = useState(true);

  const [
    navigationNightMode,
    setNavigationNightMode,
  ] = useState(false);

  const [
    recalculating,
    setRecalculating,
  ] = useState(false);

  const [arrived, setArrived] =
    useState(false);

  const [
    routePanelExpanded,
    setRoutePanelExpanded,
  ] = useState(true);

  const [
    compactScreen,
    setCompactScreen,
  ] = useState(false);

  const [
    mapFollowingUser,
    setMapFollowingUser,
  ] = useState(true);

  const [
    map3DEnabled,
    setMap3DEnabled,
  ] = useState(false);

  const [
    safetyScore,
    setSafetyScore,
  ] = useState<SafetyScore | null>(
    null
  );

  const [communityHazards, setCommunityHazards] =
    useState<CommunityHazard[]>([]);
  const [communityHazardsLoaded, setCommunityHazardsLoaded] =
    useState(false);
  const [activeHazardAlert, setActiveHazardAlert] =
    useState<{ hazard: CommunityHazard; distanceMeters: number } | null>(null);
  const alertedHazardIdsRef = useRef<Set<string>>(new Set());
  const hasManuallySelectedRouteRef = useRef(false);
  const arrivalSavedRef = useRef(false);
const navigationStartedAtRef = useRef<number | null>(null);
const navigationStartedFromRef = useRef<LivePosition | null>(null);
const safetyScoreRef = useRef<SafetyScore | null>(null);

useEffect(() => {
  safetyScoreRef.current = safetyScore;
}, [safetyScore]);

  const [
    trafficSegments,
    setTrafficSegments,
  ] = useState<
    TrafficRouteSegment[]
  >([]);

  const locationSubscription =
    useRef<Location.LocationSubscription | null>(
      null
    );

  const routeCoordinatesRef =
    useRef<RouteCoordinate[]>([]);

  const routeInfoRef =
    useRef<RouteResult | null>(
      null
    );

  const destinationRef =
    useRef<Destination | null>(
      null
    );

  const travelModeRef =
    useRef<TravelMode>(
      travelMode
    );

  const navigationActiveRef =
    useRef(false);

  const navigationPositionRef =
    useRef<LivePosition | null>(
      null
    );

  const voiceEnabledRef =
    useRef(voiceEnabled);

  const navigationStepIndexRef =
    useRef(0);

  const announcedStepRef =
    useRef<number | null>(null);

  const offRouteCountRef =
    useRef(0);

  const lastRerouteRef =
    useRef(0);

  const speedLookupRef =
    useRef(0);

  const routeRequestIdRef =
    useRef(0);

  const trafficRequestIdRef =
    useRef(0);

  useEffect(() => {
    travelModeRef.current =
      travelMode;
  }, [travelMode]);

  useEffect(() => {
    voiceEnabledRef.current =
      voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    navigationActiveRef.current =
      navigationActive;
  }, [navigationActive]);

  useEffect(() => {
    destinationRef.current =
      destination;
  }, [destination]);

  useEffect(() => {
    routeCoordinatesRef.current =
      routeCoordinates;
  }, [routeCoordinates]);

  useEffect(() => {
    routeInfoRef.current =
      routeInfo;
  }, [routeInfo]);

  useEffect(() => {
    navigationPositionRef.current =
      navigationPosition;
  }, [navigationPosition]);

  useEffect(() => {
    navigationStepIndexRef.current =
      navigationStepIndex;
  }, [navigationStepIndex]);

  

  /*
   * TomTom traffic.
   *
   * ORS continues to provide the route geometry.
   * TomTom only provides live traffic information
   * used to color the selected route.
   *
   * Traffic is refreshed when:
   * 1. Navigation starts.
   * 2. The active route changes.
   * 3. A reroute creates a new route.
   * 4. Every 60 seconds while navigating.
   */
  useEffect(() => {
    if (
      !navigationActive ||
      !routeCoordinates.length
    ) {
      trafficRequestIdRef.current += 1;
      setTrafficSegments([]);
      return;
    }

    let cancelled = false;

    const refreshTraffic =
      async () => {
        const requestId =
          ++trafficRequestIdRef.current;

        try {
          const segments =
            await getTrafficRouteSegments(
              routeCoordinates
            );

          if (
            cancelled ||
            requestId !==
              trafficRequestIdRef.current
          ) {
            return;
          }

          setTrafficSegments(
            segments
          );
        } catch (error) {
          console.error(
            "TomTom traffic lookup failed:",
            error
          );

          if (
            cancelled ||
            requestId !==
              trafficRequestIdRef.current
          ) {
            return;
          }

          /*
           * Keep the route usable even if
           * traffic data is unavailable.
           * SafeRouteMap will leave the
           * selected route blue.
           */
          setTrafficSegments([]);
        }
      };

    refreshTraffic();

    const interval =
      setInterval(
        refreshTraffic,
        TRAFFIC_REFRESH_MS
      );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    navigationActive,
    routeCoordinates,
  ]);

  const getCurrentLocation =
    useCallback(async () => {
      try {
        setLoading(true);

        // The Profile preference is the in-app source of truth.
        // The map never prompts for permission by itself.
        const savedSettings = await AsyncStorage.getItem(
          PROFILE_SETTINGS_KEY
        );
        const settings = savedSettings ? JSON.parse(savedSettings) : {};

        if (settings.locationEnabled !== true) {
          setLocationEnabled(false);
          locationSubscription.current?.remove();
          locationSubscription.current = null;
          setLoading(false);
          return null;
        }

        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          setLocationEnabled(false);
          locationSubscription.current?.remove();
          locationSubscription.current = null;
          navigationActiveRef.current = false;
          setNavigationActive(false);
          await AsyncStorage.setItem(
            PROFILE_SETTINGS_KEY,
            JSON.stringify({ ...settings, locationEnabled: false })
          );
          setRegion(null);
          setNavigationPosition(null);
          navigationPositionRef.current = null;
          setLoading(false);
          return null;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        setLocationEnabled(true);
        setRegion(
          toMapRegion(
            current.coords.latitude,
            current.coords.longitude
          )
        );

        const position: LivePosition = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          heading: current.coords.heading ?? undefined,
          speed: current.coords.speed ?? undefined,
        };

        setNavigationPosition(position);
        navigationPositionRef.current = position;
        return current.coords;
      } catch (error) {
        console.error("Unable to get current location:", error);
        return null;
      } finally {
        setLoading(false);
      }
    }, []);

  // Only clean up on unmount. Location permission is loaded on screen focus below.
  useEffect(() => {
    return () => {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
      Speech.stop();
      trafficRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCommunityHazards = async () => {
      try {
        const reports = await getRecentHazards(100);
        if (cancelled) return;

        setCommunityHazards(
          reports.filter(
            (hazard) =>
              Number.isFinite(hazard.latitude) &&
              Number.isFinite(hazard.longitude) &&
              hazard.latitude >= -90 &&
              hazard.latitude <= 90 &&
              hazard.longitude >= -180 &&
              hazard.longitude <= 180
          )
        );
      } catch (error) {
        console.warn("Unable to load community hazards for route scoring:", error);
      } finally {
        if (!cancelled) setCommunityHazardsLoaded(true);
      }
    };

    void loadCommunityHazards();
    const refreshId = setInterval(() => {
      void loadCommunityHazards();
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(refreshId);
    };
  }, []);

  const calculateAndSetSafetyScore =
    useCallback(
      (route: RouteResult) => {
        const score = getRouteSafetyScore(route, communityHazards);

        setSafetyScore(score);

        return score;
      },
      [communityHazards]
    );

  const buildRouteList =
    useCallback(
      (
        result: RouteResult
      ): RouteResult[] => {
        return [
          result,
          ...(result.alternatives ?? []),
        ];
      },
      []
    );

  const applyRouteResult =
    useCallback(
      (
        result: RouteResult
      ) => {
        const routes =
          buildRouteList(result);

        if (!routes.length) {
          return;
        }

        hasManuallySelectedRouteRef.current = false;

        const selectedIndex =
          getRecommendedRouteIndexForRoutes(
            routes,
            communityHazards
          );
        const selected =
          routes[selectedIndex] ?? routes[0];

        setAvailableRoutes(
          routes
        );

        setSelectedRouteIndex(
          selectedIndex
        );

        setRouteInfo(
          selected
        );

        setRouteCoordinates(
          selected.coordinates
        );

        routeInfoRef.current =
          selected;

        routeCoordinatesRef.current =
          selected.coordinates;

        setRemainingDistanceMeters(
          selected.distanceMeters
        );

        setRemainingDurationSeconds(
          selected.durationSeconds
        );

        calculateAndSetSafetyScore(
          selected
        );

        setNavigationStepIndex(
          0
        );

        navigationStepIndexRef.current =
          0;

        announcedStepRef.current =
          null;

        offRouteCountRef.current =
          0;
      },
      [
        buildRouteList,
        calculateAndSetSafetyScore,
        communityHazards,
      ]
    );

  const calculateRoute =
    useCallback(
      async (
        start: RouteCoordinate,
        end: RouteCoordinate,
        mode: TravelMode
      ) => {
        const requestId =
          ++routeRequestIdRef.current;

        setRouteLoading(true);

        try {
          const result =
            await getRoute(
              start,
              end,
              mode
            );

          if (
            requestId !==
            routeRequestIdRef.current
          ) {
            return null;
          }

          applyRouteResult(
            result
          );

          return result;
        } catch (error: any) {
          if (
            requestId !==
            routeRequestIdRef.current
          ) {
            return null;
          }

          console.error(
            "Route calculation failed:",
            error
          );

          const message =
            String(
              error?.message ?? ""
            );

          if (
            message.includes(
              "SafeRoute currently supports routes up to 6,000 km"
            )
          ) {
            Alert.alert(
              "Route Too Far",
              "This destination is more than 6,000 km away. SafeRoute currently supports routes up to 6,000 km."
            );

            return null;
          }

          Alert.alert(
            "Route unavailable",
            "SafeRoute couldn't calculate a route to that destination."
          );

          return null;
        } finally {
          if (
            requestId ===
            routeRequestIdRef.current
          ) {
            setRouteLoading(false);
          }
        }
      },
      [applyRouteResult]
    );

  const handleTravelModeChange =
    useCallback(
      async (mode: TravelMode) => {
        if (
          mode ===
          travelModeRef.current
        ) {
          return;
        }

        travelModeRef.current =
          mode;

        setTravelMode(mode);

        if (
          !destinationRef.current
        ) {
          return;
        }

        let start =
          navigationPositionRef.current;

        if (!start && region) {
          start = {
            latitude:
              region.latitude,
            longitude:
              region.longitude,
          };
        }

        if (!start) {
          Alert.alert(
            "Location unavailable",
            "SafeRoute is still waiting for your current location."
          );

          return;
        }

        const requestId =
          ++routeRequestIdRef.current;

        setSelectedRouteIndex(0);

        setRouteLoading(true);

        try {
          const result =
            await getRoute(
              {
                latitude:
                  start.latitude,
                longitude:
                  start.longitude,
              },
              {
                latitude:
                  destinationRef.current
                    .latitude,
                longitude:
                  destinationRef.current
                    .longitude,
              },
              mode
            );

          if (
            requestId !==
            routeRequestIdRef.current
          ) {
            return;
          }

          applyRouteResult(
            result
          );
        } catch (error: any) {
          if (
            requestId !==
            routeRequestIdRef.current
          ) {
            return;
          }

          if (
            !destinationRef.current
          ) {
            return;
          }

          const message =
            String(
              error?.message ?? ""
            );

          console.error(
            "Travel mode route calculation failed:",
            error
          );

          if (
            message.includes(
              "SafeRoute currently supports routes up to 6,000 km"
            )
          ) {
            Alert.alert(
              "Route Too Far",
              "This destination is more than 6,000 km away. SafeRoute currently supports routes up to 6,000 km."
            );
          } else {
            Alert.alert(
              "Route unavailable",
              `SafeRoute couldn't calculate a ${TRAVEL_MODES[mode].label.toLowerCase()} route to that destination.`
            );
          }
        } finally {
          if (
            requestId ===
            routeRequestIdRef.current
          ) {
            setRouteLoading(false);
          }
        }
      },
      [
        applyRouteResult,
        region,
      ]
    );

  const handleSelectRoute =
    useCallback(
      (
        index: number,
        collapsePanel = false
      ) => {
        if (
          index < 0 ||
          index >=
            availableRoutes.length
        ) {
          return;
        }

        hasManuallySelectedRouteRef.current = true;

        const selected =
          availableRoutes[index];

        if (
          !selected ||
          selected.coordinates.length <
            2
        ) {
          return;
        }

        setSelectedRouteIndex(
          index
        );

        setRouteInfo(
          selected
        );

        setRouteCoordinates(
          selected.coordinates
        );

        routeInfoRef.current =
          selected;

        routeCoordinatesRef.current =
          selected.coordinates;

        setRemainingDistanceMeters(
          selected.distanceMeters
        );

        setRemainingDurationSeconds(
          selected.durationSeconds
        );

        calculateAndSetSafetyScore(
          selected
        );

        setNavigationStepIndex(
          0
        );

        navigationStepIndexRef.current =
          0;

        announcedStepRef.current =
          null;

        offRouteCountRef.current =
          0;

        setRoutePanelExpanded(
          !collapsePanel
        );
      },
      [
        availableRoutes,
        calculateAndSetSafetyScore,
      ]
    );

  useEffect(() => {
    const selectedRoute = availableRoutes[selectedRouteIndex];
    if (selectedRoute) {
      setSafetyScore(getRouteSafetyScore(selectedRoute, communityHazards));
    }
  }, [communityHazards, availableRoutes, selectedRouteIndex]);

  useEffect(() => {
    if (
      !communityHazardsLoaded ||
      hasManuallySelectedRouteRef.current ||
      availableRoutes.length === 0
    ) {
      return;
    }

    const recommendedIndex = getRecommendedRouteIndexForRoutes(
      availableRoutes,
      communityHazards
    );
    if (recommendedIndex === selectedRouteIndex) return;

    const recommendedRoute = availableRoutes[recommendedIndex];
    if (!recommendedRoute || recommendedRoute.coordinates.length < 2) return;

    setSelectedRouteIndex(recommendedIndex);
    setRouteInfo(recommendedRoute);
    setRouteCoordinates(recommendedRoute.coordinates);
    routeInfoRef.current = recommendedRoute;
    routeCoordinatesRef.current = recommendedRoute.coordinates;
    setRemainingDistanceMeters(recommendedRoute.distanceMeters);
    setRemainingDurationSeconds(recommendedRoute.durationSeconds);
    setSafetyScore(getRouteSafetyScore(recommendedRoute, communityHazards));
    setNavigationStepIndex(0);
    navigationStepIndexRef.current = 0;
    announcedStepRef.current = null;
    offRouteCountRef.current = 0;
  }, [
    communityHazards,
    communityHazardsLoaded,
    availableRoutes,
    selectedRouteIndex,
  ]);

  // Warn once per hazard per navigation session when an upcoming report
  // is close to the selected route and within 500 m of the user's position.
  useEffect(() => {
    if (!navigationActive || !navigationPosition || routeCoordinates.length < 2) {
      if (!navigationActive) setActiveHazardAlert(null);
      return;
    }

    const currentRouteIndex = closestRouteIndex(navigationPosition, routeCoordinates);
    const candidates = communityHazards
      .filter((hazard) => !alertedHazardIdsRef.current.has(hazard.id))
      .map((hazard) => {
        const point = { latitude: hazard.latitude, longitude: hazard.longitude };
        const routeDistance = getDistanceToRouteMeters(point, routeCoordinates);
        const userDistance = haversineDistance(navigationPosition, point);
        const hazardRouteIndex = closestRouteIndex(point, routeCoordinates);
        return { hazard, routeDistance, userDistance, hazardRouteIndex };
      })
      .filter(({ routeDistance, userDistance, hazardRouteIndex }) =>
        routeDistance <= 150 &&
        userDistance <= 500 &&
        userDistance >= 15 &&
        hazardRouteIndex >= Math.max(0, currentRouteIndex - 2)
      )
      .sort((a, b) => a.userDistance - b.userDistance);

    const candidate = candidates[0];
    if (!candidate) return;

    alertedHazardIdsRef.current.add(candidate.hazard.id);
    setActiveHazardAlert({
      hazard: candidate.hazard,
      distanceMeters: Math.round(candidate.userDistance),
    });

    const category = getHazardAlertLabel(candidate.hazard.type);
    const distanceText = candidate.userDistance < 100
      ? `about ${Math.max(10, Math.round(candidate.userDistance / 10) * 10)} meters ahead`
      : `about ${Math.round(candidate.userDistance / 50) * 50} meters away`;

    if (voiceEnabledRef.current) {
      speak(`Caution. Community report: ${category}, ${distanceText}. Please use your judgment.`);
    }
  }, [
    navigationActive,
    navigationPosition?.latitude,
    navigationPosition?.longitude,
    routeCoordinates,
    communityHazards,
  ]);

  const createCoordinateDestination =
    (
      latitude: number,
      longitude: number
    ): Destination => ({
      name: "Pinned location",
      address: `${latitude.toFixed(
        5
      )}, ${longitude.toFixed(
        5
      )}`,
      latitude,
      longitude,
    });

  const routeToCoordinate =
    useCallback(
      async (
        latitude: number,
        longitude: number
      ) => {
        if (!locationEnabled) {
          Alert.alert(
            "Location Access is denied",
            "Go to the Profile tab and turn on Location Preferences to use the map."
          );
          return;
        }

        const newDestination =
          createCoordinateDestination(
            latitude,
            longitude
          );

        setDestination(
          newDestination
        );

        destinationRef.current =
          newDestination;

        setMapFollowingUser(
          true
        );

        const start =
          navigationPositionRef.current ??
          (region
            ? {
                latitude:
                  region.latitude,
                longitude:
                  region.longitude,
              }
            : null);

        if (!start) {
          Alert.alert(
            "Location unavailable",
            "SafeRoute is still waiting for your current location."
          );

          return;
        }

        await calculateRoute(
          {
            latitude:
              start.latitude,
            longitude:
              start.longitude,
          },
          {
            latitude,
            longitude,
          },
          travelModeRef.current
        );
      },
      [
        calculateRoute,
        region,
        locationEnabled,
      ]
    );

  const handleSelectDestination =
    useCallback(
      async (
        selectedDestination: Destination
      ) => {
        if (!locationEnabled && params.saveSlot !== "home" && params.saveSlot !== "school" && params.saveSlot !== "custom") {
          Alert.alert(
            "Location Access is denied",
            "Go to the Profile tab and turn on Location Preferences to use the map."
          );
          return;
        }

        if (
          params.saveSlot === "home" ||
          params.saveSlot === "school" ||
          params.saveSlot === "custom"
        ) {
          try {
            const storageKey = "@saferoute/saved_destinations";
            const raw = await AsyncStorage.getItem(storageKey);

            const existingDestinations = raw ? JSON.parse(raw) : [];

            const validDestinations = Array.isArray(existingDestinations)
              ? existingDestinations
              : [];

            const slot = params.saveSlot;
            const saveId = params.saveId;
            const name =
              params.saveName?.trim() ||
              (slot === "home" ? "Home" : slot === "school" ? "School" : "Saved place");

            const savedDestination = {
              id:
                saveId ||
                `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              name,
              address: selectedDestination.address,
              latitude: selectedDestination.latitude,
              longitude: selectedDestination.longitude,
              slot,
            };

            const updatedDestinations =
              slot === "custom" && saveId
                ? validDestinations.map((item: { id?: string }) =>
                    item.id === saveId ? savedDestination : item
                  )
                : slot === "custom"
                  ? [...validDestinations, savedDestination]
                  : [
                      ...validDestinations.filter(
                        (item: { slot?: string }) => item.slot !== slot
                      ),
                      savedDestination,
                    ];

            await AsyncStorage.setItem(
              storageKey,
              JSON.stringify(updatedDestinations)
            );

            Alert.alert(
              "Destination saved!",
              `${name} has been saved successfully.`,
              [
                {
                  text: "OK",
                  onPress: () => router.back(),
                },
              ]
            );
          } catch (error) {
            console.error("Failed to save destination:", error);

            Alert.alert(
              "Couldn't save destination",
              "Please try selecting the address again."
            );
          }

          return;
        }
        setDestination(
          selectedDestination
        );

        destinationRef.current =
          selectedDestination;

        setMapFollowingUser(
          true
        );

        const start =
          navigationPositionRef.current ??
          (region
            ? {
                latitude:
                  region.latitude,
                longitude:
                  region.longitude,
              }
            : null);

        if (!start) {
          Alert.alert(
            "Location unavailable",
            "SafeRoute is still waiting for your current location."
          );

          return;
        }

        await calculateRoute(
          {
            latitude:
              start.latitude,
            longitude:
              start.longitude,
          },
          {
            latitude:
              selectedDestination.latitude,
            longitude:
              selectedDestination.longitude,
          },
          travelModeRef.current
        );
      },
      [
        calculateRoute,
        region,
        locationEnabled,
      ]
    );
    useEffect(() => {
  const name = params.routeDestinationName;
  const address = params.routeDestinationAddress;
  const latitude = Number(params.routeDestinationLatitude);
  const longitude = Number(params.routeDestinationLongitude);

  if (
    !name ||
    !address ||
    !params.routeDestinationLatitude ||
    !params.routeDestinationLongitude ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return;
  }

  const requestKey = `${name}|${address}|${latitude}|${longitude}`;

  if (handledDestinationParams.current === requestKey) {
    return;
  }

  // Wait for the user's current location before routing.
  if (!navigationPosition && !region) {
    return;
  }

  handledDestinationParams.current = requestKey;

  void handleSelectDestination({
    name,
    address,
    latitude,
    longitude,
  });
}, [
  params.routeDestinationName,
  params.routeDestinationAddress,
  params.routeDestinationLatitude,
  params.routeDestinationLongitude,
  navigationPosition,
  region,
  handleSelectDestination,
]);
const isSavingDestination =
  params.saveSlot === "home" ||
  params.saveSlot === "school" ||
  params.saveSlot === "custom";
  const handleDroppedPin = useCallback(
  async (coordinate: RouteCoordinate) => {
    if (navigationActiveRef.current) {
      return;
    }

    setRoutePanelExpanded(true);

    // When adding or editing a Quick Destination,
    // save the dropped pin instead of calculating a route.
    if (isSavingDestination) {
      await handleSelectDestination(
        createCoordinateDestination(
          coordinate.latitude,
          coordinate.longitude
        )
      );
      return;
    }

    // Normal map behavior: calculate a route to the pin.
    await routeToCoordinate(
      coordinate.latitude,
      coordinate.longitude
    );
  },
  [
    isSavingDestination,
    handleSelectDestination,
    routeToCoordinate,
  ]
);
  const stopNavigation =
    useCallback(() => {
      locationSubscription.current?.remove();

      locationSubscription.current =
        null;

      navigationActiveRef.current =
        false;

      setNavigationActive(
        false
      );

      setTrafficSegments([]);

      trafficRequestIdRef.current +=
        1;

      setArrived(false);
      setActiveHazardAlert(null);

      setRecalculating(
        false
      );

      Speech.stop();

      offRouteCountRef.current =
        0;

      announcedStepRef.current =
        null;
    }, []);

  const clearDestination =
    useCallback(() => {
      stopNavigation();

      routeRequestIdRef.current +=
        1;

      trafficRequestIdRef.current +=
        1;

      setTrafficSegments([]);

      setDestination(null);

      destinationRef.current =
        null;

      setRouteCoordinates([]);

      routeCoordinatesRef.current =
        [];

      setRouteInfo(null);

      routeInfoRef.current =
        null;

      setAvailableRoutes([]);

      setSelectedRouteIndex(0);

      setRemainingDistanceMeters(
        0
      );

      setRemainingDurationSeconds(
        0
      );

      setSafetyScore(null);

      setArrived(false);
    }, [stopNavigation]);

  const rerouteFromLocation =
    useCallback(
      async (
        position: LivePosition
      ) => {
        const currentDestination =
          destinationRef.current;

        if (
          !currentDestination
        ) {
          return;
        }

        const now = Date.now();

        if (
          now -
            lastRerouteRef.current <
          REROUTE_COOLDOWN_MS
        ) {
          return;
        }

        lastRerouteRef.current =
          now;

        setRecalculating(
          true
        );

        try {
          const result =
            await getRoute(
              {
                latitude:
                  position.latitude,
                longitude:
                  position.longitude,
              },
              {
                latitude:
                  currentDestination.latitude,
                longitude:
                  currentDestination.longitude,
              },
              travelModeRef.current
            );

          const routes =
            buildRouteList(
              result
            );

          hasManuallySelectedRouteRef.current = false;

          const selectedIndex =
            getRecommendedRouteIndexForRoutes(
              routes,
              communityHazards
            );
          const selected =
            routes[selectedIndex] ?? routes[0];

          if (!selected) {
            return;
          }

          setSelectedRouteIndex(
            selectedIndex
          );

          setAvailableRoutes(
            routes
          );

          setRouteInfo(
            selected
          );

          setRouteCoordinates(
            selected.coordinates
          );

          routeInfoRef.current =
            selected;

          routeCoordinatesRef.current =
            selected.coordinates;

          setRemainingDistanceMeters(
            selected.distanceMeters
          );

          setRemainingDurationSeconds(
            selected.durationSeconds
          );

          calculateAndSetSafetyScore(
            selected
          );

          setNavigationStepIndex(
            0
          );

          navigationStepIndexRef.current =
            0;

          announcedStepRef.current =
            null;
        } catch (error) {
          console.error(
            "Reroute failed:",
            error
          );
        } finally {
          setRecalculating(
            false
          );
        }
      },
      [
        buildRouteList,
        calculateAndSetSafetyScore,
        communityHazards,
      ]
    );

const handleArrival = useCallback(() => {
  if (arrivalSavedRef.current) {
    return;
  }

  // Prevent duplicate saves if GPS reports arrival more than once.
  arrivalSavedRef.current = true;

  const completedDestination = destinationRef.current;
  const completedRoute = routeInfoRef.current;
  const startingPosition = navigationStartedFromRef.current;
  const startedAt = navigationStartedAtRef.current;

  if (completedDestination && completedRoute) {
    const elapsedSeconds =
      startedAt !== null
        ? Math.max(0, Math.round((Date.now() - startedAt) / 1000))
        : Math.round(completedRoute.durationSeconds);

    const routeStart = completedRoute.coordinates[0];

    void saveCompletedTrip({
      originName: "Starting location",
      destinationName: completedDestination.name,
      distanceMeters: completedRoute.distanceMeters,
      durationSeconds: elapsedSeconds,
      safetyScore: safetyScoreRef.current?.score ?? null,
      travelMode: travelModeRef.current,
      originLatitude:
        routeStart?.latitude ?? startingPosition?.latitude,
      originLongitude:
        routeStart?.longitude ?? startingPosition?.longitude,
      destinationLatitude: completedDestination.latitude,
      destinationLongitude: completedDestination.longitude,
    }).catch((error) => {
      console.error("Unable to save completed trip:", error);
    });
  }

  setArrived(true);

  if (voiceEnabledRef.current) {
    speak("You have arrived at your destination.");
  }

  locationSubscription.current?.remove();
  locationSubscription.current = null;

  navigationActiveRef.current = false;
  setNavigationActive(false);
  setTrafficSegments([]);

  trafficRequestIdRef.current += 1;
}, []);

  const speakUpcomingTurn =
    useCallback(
      (
        position: LivePosition,
        steps: RouteStep[],
        stepIndex: number,
        route: RouteCoordinate[]
      ) => {
        if (
          !voiceEnabledRef.current ||
          !steps.length ||
          !route.length
        ) {
          return;
        }

        const step =
          steps[stepIndex];

        if (!step) {
          return;
        }

        if (
          announcedStepRef.current ===
          stepIndex
        ) {
          return;
        }

        const startIndex =
          step.wayPoints?.[0] ??
          0;

        const boundedIndex =
          Math.min(
            Math.max(
              startIndex,
              0
            ),
            route.length - 1
          );

        const distance =
          haversineDistance(
            position,
            route[
              boundedIndex
            ]
          );

        if (
          distance >
          getAdvanceDistance(
            travelModeRef.current
          )
        ) {
          return;
        }

        const instruction =
          step.instruction?.trim();

        if (!instruction) {
          return;
        }

        announcedStepRef.current =
          stepIndex;

        speak(instruction);
      },
      []
    );

  const handleNavigationLocation =
    useCallback(
      async (
        location: Location.LocationObject
      ) => {
        const coords =
          location.coords;

        const position: LivePosition =
          {
            latitude:
              coords.latitude,
            longitude:
              coords.longitude,
            heading:
              coords.heading ??
              undefined,
            speed:
              coords.speed ??
              undefined,
          };

        setNavigationPosition(
          position
        );

        navigationPositionRef.current =
          position;

        setRegion(
          toMapRegion(
            coords.latitude,
            coords.longitude
          )
        );

        const route =
          routeCoordinatesRef.current;

        const currentRouteInfo =
          routeInfoRef.current;

        if (
          !route.length ||
          !currentRouteInfo
        ) {
          return;
        }

        const remaining =
          getRemainingRouteDistance(
            position,
            route
          );

        setRemainingDistanceMeters(
          remaining
        );

        const averageSpeed =
          Math.max(
            1,
            coords.speed ?? 1
          );

        const estimatedRemaining =
          remaining /
          averageSpeed;

        setRemainingDurationSeconds(
          Number.isFinite(
            estimatedRemaining
          )
            ? estimatedRemaining
            : currentRouteInfo.durationSeconds
        );

        const arrivalDistance =
          travelModeRef.current ===
          "driving-car"
            ? ARRIVAL_DISTANCE_DRIVING
            : ARRIVAL_DISTANCE_WALKING;

        if (
          destinationRef.current &&
          haversineDistance(
            position,
            {
              latitude:
                destinationRef.current
                  .latitude,
              longitude:
                destinationRef.current
                  .longitude,
            }
          ) <= arrivalDistance
        ) {
          handleArrival();
          return;
        }

        const offRouteDistance =
          travelModeRef.current ===
          "driving-car"
            ? OFF_ROUTE_DISTANCE_DRIVING
            : OFF_ROUTE_DISTANCE_WALKING;

        const routeDistance =
          distanceToRoute(
            position,
            route
          );

        if (
          routeDistance >
          offRouteDistance
        ) {
          offRouteCountRef.current +=
            1;

          if (
            offRouteCountRef.current >=
            OFF_ROUTE_REQUIRED_UPDATES
          ) {
            offRouteCountRef.current =
              0;

            await rerouteFromLocation(
              position
            );

            return;
          }
        } else {
          offRouteCountRef.current =
            0;
        }

        const steps =
          currentRouteInfo.steps ?? [];

        const currentStep =
          getCurrentStepIndex(
            position,
            route,
            steps,
            navigationStepIndexRef.current
          );

        if (
          currentStep !==
          navigationStepIndexRef.current
        ) {
          setNavigationStepIndex(
            currentStep
          );

          navigationStepIndexRef.current =
            currentStep;
        }

        speakUpcomingTurn(
          position,
          steps,
          currentStep,
          route
        );

        const now =
          Date.now();

        if (
          now -
            speedLookupRef.current >
          15000
        ) {
          speedLookupRef.current =
            now;

          try {
            const result =
              await getSpeedLimit(
                position.latitude,
                position.longitude
              );

            if (
              result &&
              typeof result.speedLimitMph ===
                "number"
            ) {
              setSpeedLimit(
                result.speedLimitMph
              );
            }
          } catch (error) {
            console.log(
              "Speed limit lookup failed:",
              error
            );
          }
        }
      },
      [
        handleArrival,
        rerouteFromLocation,
        speakUpcomingTurn,
      ]
    );

  const startNavigation =
    useCallback(
      async () => {
        if (!locationEnabled) {
          Alert.alert(
            "Location Access is denied",
            "Go to the Profile tab and turn on Location Preferences before starting navigation."
          );
          return;
        }

        if (
          !destinationRef.current
        ) {
          return;
        }

        let start =
          navigationPositionRef.current;

        if (!start && region) {
          start = {
            latitude:
              region.latitude,
            longitude:
              region.longitude,
          };
        }

        if (!start) {
          Alert.alert(
            "Location unavailable",
            "SafeRoute needs your current location before navigation can start."
          );

          return;
        }

        if (
          !routeCoordinatesRef.current
            .length
        ) {
          const result =
            await calculateRoute(
              {
                latitude:
                  start.latitude,
                longitude:
                  start.longitude,
              },
              {
                latitude:
                  destinationRef.current
                    .latitude,
                longitude:
                  destinationRef.current
                    .longitude,
              },
              travelModeRef.current
            );

          if (!result) {
            return;
          }
        }

setArrived(false);
arrivalSavedRef.current = false;
navigationStartedAtRef.current = Date.now();
navigationStartedFromRef.current = {
  latitude: start.latitude,
  longitude: start.longitude,
};
setActiveHazardAlert(null);
alertedHazardIdsRef.current.clear();

        setTrafficSegments([]);

        trafficRequestIdRef.current +=
          1;

        setNavigationActive(
          true
        );

        navigationActiveRef.current =
          true;

        setMapFollowingUser(
          true
        );

        offRouteCountRef.current =
          0;

        announcedStepRef.current =
          null;

        try {
          locationSubscription.current?.remove();

          locationSubscription.current =
            await Location.watchPositionAsync(
              {
                accuracy:
                  Location.Accuracy.High,
                distanceInterval: 5,
                timeInterval: 2000,
                mayShowUserSettingsDialog: true,
              },
              handleNavigationLocation
            );
        } catch (error) {
          console.error(
            "Navigation location tracking failed:",
            error
          );

          navigationActiveRef.current =
            false;

          setNavigationActive(
            false
          );

          setTrafficSegments([]);

          trafficRequestIdRef.current +=
            1;

          Alert.alert(
            "Navigation unavailable",
            "SafeRoute couldn't start live location tracking."
          );
        }
      },
      [
        calculateRoute,
        handleNavigationLocation,
        region,
        locationEnabled,
      ]
    );

  const finishNavigation =
    useCallback(() => {
      stopNavigation();

      setNavigationPosition(
        navigationPositionRef.current
      );

      setMapFollowingUser(
        true
      );
    }, [stopNavigation]);

  const toggleVoice =
    useCallback(() => {
      setVoiceEnabled(
        (current) => {
          const next =
            !current;

          voiceEnabledRef.current =
            next;

          if (!next) {
            Speech.stop();
          }

          return next;
        }
      );
    }, []);


const toggleNightMode = useCallback(() => {
  setNavigationNightMode((current) => {
    const next = !current;

    void (async () => {
      try {
        const savedSettings = await AsyncStorage.getItem(
          PROFILE_SETTINGS_KEY
        );

        const settings = savedSettings
          ? JSON.parse(savedSettings)
          : {};

        await AsyncStorage.setItem(
          PROFILE_SETTINGS_KEY,
          JSON.stringify({
            ...settings,
            nightSafetyEnabled: next,
          })
        );
      } catch (error) {
        console.warn("Could not save Night Safety Mode:", error);
      }
    })();

    return next;
  });
}, []);

    useEffect(() => {
  let isMounted = true;

  const loadNightSafetyMode = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem(
        PROFILE_SETTINGS_KEY
      );

      if (!savedSettings || !isMounted) return;

      const settings = JSON.parse(savedSettings);

      if (typeof settings.nightSafetyEnabled === "boolean") {
        setNavigationNightMode(settings.nightSafetyEnabled);
      }
    } catch (error) {
      console.warn("Could not load Night Safety Mode:", error);
    }
  };

  void loadNightSafetyMode();

  return () => {
    isMounted = false;
  };
}, []);
  
    useEffect(() => {
      let active = true;

      const loadNightSafetyPreference = async () => {
        try {
          const saved = await AsyncStorage.getItem(
            "@saferoute_profile_settings"
          );

          if (!active || !saved) return;

          const settings = JSON.parse(saved);

          if (typeof settings.nightSafetyEnabled === "boolean") {
            setNavigationNightMode(settings.nightSafetyEnabled);
          }
        } catch (error) {
          console.warn("Could not load night safety preference:", error);
        }
      };

      void loadNightSafetyPreference();

      return () => {
        active = false;
      };
    }, []);
      

  const toggleCompactScreen =
    useCallback(() => {
      setCompactScreen(
        (current) => !current
      );
    }, []);

  const getCurrentNavigationStep =
    useCallback(() => {
      if (
        !routeInfo ||
        !routeInfo.steps.length
      ) {
        return null;
      }

      return (
        routeInfo.steps[
          navigationStepIndex
        ] ?? null
      );
    }, [
      routeInfo,
      navigationStepIndex,
    ]);

  const getNextNavigationStep =
    useCallback(() => {
      if (
        !routeInfo ||
        !routeInfo.steps.length
      ) {
        return null;
      }

      return (
        routeInfo.steps[
          navigationStepIndex + 1
        ] ?? null
      );
    }, [
      routeInfo,
      navigationStepIndex,
    ]);
  const navigationPreviewSteps: NavigationPreviewStep[] = (
  routeInfo?.steps ?? []
).map((step) => {
  const route = routeCoordinates;

  const requestedIndex =
    step.wayPoints?.[1] ??
    step.wayPoints?.[0] ??
    0;

  const boundedIndex = Math.max(
    0,
    Math.min(requestedIndex, route.length - 1)
  );

  return {
    instruction: step.instruction,
    distanceMeters: step.distanceMeters,
    coordinate: route[boundedIndex] ?? null,
  };
});

const handlePreviewStepChange = useCallback(
  (index: number | null) => {
    setPreviewStepIndex(index);

    if (index === null) {
      // Returning to live navigation restores GPS following.
      setMapFollowingUser(true);
    } else {
      // Previewing a turn should not fight the map camera.
      setMapFollowingUser(false);
    }
  },
  []
);
  const screen =
    Dimensions.get("window");

  const isCompact =
    screen.width /
      screen.height <
    COMPACT_SCREEN_RATIO;

  useEffect(() => {
    if (
      isCompact &&
      !compactScreen
    ) {
      setCompactScreen(true);
    }
  }, [
    compactScreen,
    isCompact,
  ]);

  const routeSafetyScores =
    availableRoutes.map((route) =>
      getRouteSafetyScore(route, communityHazards)
    );
  const routeComparison =
    getRouteComparison(
      availableRoutes.map((route, index) => ({
        score:
          routeSafetyScores[index]?.score ?? 50,
        durationSeconds:
          route.durationSeconds,
      }))
    );

  // Re-read Profile settings whenever the map screen becomes active.
  // This makes turning Location Preferences off/on in Profile take effect
  // without requiring the user to open Android Settings.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const applyLocationPreference = async () => {
        try {
          const savedSettings = await AsyncStorage.getItem(PROFILE_SETTINGS_KEY);
          const settings = savedSettings ? JSON.parse(savedSettings) : {};
          const preferenceEnabled = settings.locationEnabled === true;

          if (cancelled) return;
          setLocationPreferenceLoaded(true);

          const permission = await Location.getForegroundPermissionsAsync();
          if (cancelled) return;

          if (!preferenceEnabled || permission.status !== "granted") {
            locationSubscription.current?.remove();
            locationSubscription.current = null;
            navigationActiveRef.current = false;
            setNavigationActive(false);
            setTrafficSegments([]);
            trafficRequestIdRef.current += 1;
            setActiveHazardAlert(null);
            setLocationEnabled(false);
            setRegion(null);
            setNavigationPosition(null);
            navigationPositionRef.current = null;
            setLoading(false);

            if (preferenceEnabled && permission.status !== "granted") {
              await AsyncStorage.setItem(
                PROFILE_SETTINGS_KEY,
                JSON.stringify({ ...settings, locationEnabled: false })
              );
            }
            return;
          }

          setLocationEnabled(true);
          await getCurrentLocation();
        } catch (error) {
          console.warn("Could not load Location Preferences:", error);
          if (!cancelled) {
            setLocationPreferenceLoaded(true);
            setLocationEnabled(false);
            setLoading(false);
          }
        }
      };

      void applyLocationPreference();
      return () => {
        cancelled = true;
      };
    }, [getCurrentLocation])
  );

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View
        style={styles.container}
      >
        <View
          style={styles.header}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to the previous screen"
            style={styles.headerButton}
            onPress={() =>
              router.back()
            }
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#111827"
            />
          </Pressable>

          <View
            style={
              styles.headerTitleContainer
            }
          >
            <Text
              style={
                styles.headerTitle
              }
            >
              SafeRoute
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              Safer navigation
            </Text>
          </View>

          <View
            style={styles.headerActions}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Center map on my location"
              style={
                styles.headerButton
              }
              onPress={async () => {
                if (!locationEnabled) {
                  Alert.alert(
                    "Location Access is denied",
                    "Go to the Profile tab and turn on Location Preferences to use your current location."
                  );
                  return;
                }

                setMapFollowingUser(true);
                await getCurrentLocation();
              }}
            >
              <Ionicons
                name="locate"
                size={21}
                color="#2563eb"
              />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                compactScreen
                  ? "Expand map screen"
                  : "Use compact map screen"
              }
              style={
                styles.headerButton
              }
              onPress={
                toggleCompactScreen
              }
            >
              <Ionicons
                name={
                  compactScreen
                    ? "expand"
                    : "contract"
                }
                size={20}
                color="#111827"
              />
            </Pressable>
          </View>
        </View>

        <View
          style={styles.mapContainer}
        >
          <SafeRouteMap
            region={region}
            destination={
              destination
            }
            routeCoordinates={
              routeCoordinates
            }
            alternativeRoutes={
              availableRoutes.map(
                (route) =>
                  route.coordinates
              )
            }
            selectedRouteIndex={
              selectedRouteIndex
            }
            onSelectRoute={
              handleSelectRoute
            }
            navigationActive={
              navigationActive
            }
            livePosition={
              navigationPosition
            }
            speedLimit={
              speedLimit
            }
            navigationNightMode={
              navigationNightMode
            }
            followUser={
              mapFollowingUser
            }
            onFollowUserChange={
              setMapFollowingUser
            }
            threeDEnabled={
              map3DEnabled
            }
            onToggle3D={() =>
              setMap3DEnabled(
                (current) =>
                  !current
              )
            }
            onUseDroppedPin={
              handleDroppedPin
            }
            onPinPlaced={() =>
              setRoutePanelExpanded(false)
            }
            trafficSegments={
              trafficSegments
            }
            previewSteps={navigationPreviewSteps}
            activeStepIndex={navigationStepIndex}
            previewStepIndex={previewStepIndex}
            onPreviewStepChange={handlePreviewStepChange}
          />

          {isSavingDestination && (
  <View style={styles.saveDestinationBanner}>
    <Ionicons
      name="location"
      size={22}
      color="#2563eb"
    />
    <View style={{ flex: 1 }}>
      <Text style={styles.saveDestinationTitle}>
        Choose a location
      </Text>
      <Text style={styles.saveDestinationSubtitle}>
        Search for an address or drop a pin on the map to save{" "}
        {params.saveName?.trim() ||
          (params.saveSlot === "home"
            ? "Home"
            : params.saveSlot === "school"
              ? "School"
              : "your destination")}
        .
      </Text>
    </View>
  </View>
)}

          {!navigationActive && (
            <View
              style={
                styles.searchContainer
              }
            >
              <DestinationSearch
                onSelectDestination={
                  handleSelectDestination
                }
              />
            </View>
          )}

          {!navigationActive && (
            <View
              style={
                styles.travelModeContainer
              }
            >
              {(
                Object.entries(
                  TRAVEL_MODES
                ) as [
                  TravelMode,
                  {
                    label: string;
                    icon: string;
                  }
                ][]
              ).map(
                ([
                  mode,
                  config,
                ]) => (
                  <Pressable
                    key={mode}
                    disabled={
                      routeLoading &&
                      travelMode ===
                        mode
                    }
                    style={[
                      styles.travelModeButton,
                      travelMode ===
                        mode &&
                        styles.travelModeButtonActive,
                    ]}
                    onPress={() =>
                      handleTravelModeChange(
                        mode
                      )
                    }
                  >
                    <Ionicons
                      name={
                        config.icon as any
                      }
                      size={17}
                      color={
                        travelMode ===
                        mode
                          ? "#ffffff"
                          : "#374151"
                      }
                    />

                    <Text
                      style={[
                        styles.travelModeText,
                        travelMode ===
                          mode &&
                          styles.travelModeTextActive,
                      ]}
                    >
                      {
                        config.label
                      }
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          )}

          {!locationEnabled &&
            !loading &&
            !navigationActive && (
              <View
                style={
                  styles.locationBadge
                }
              >
                <Ionicons
                  name="location-outline"
                  size={16}
                  color="#b45309"
                />

                <Text
                  style={
                    styles.locationBadgeText
                  }
                >
                  Location access is off
                </Text>
              </View>
            )}

          {loading && (
            <View
              style={
                styles.loadingCard
              }
            >
              <ActivityIndicator
                size="small"
                color="#2563eb"
              />

              <Text
                style={
                  styles.loadingText
                }
              >
                Getting your location...
              </Text>
            </View>
          )}

          {routeLoading && (
            <View
              style={
                styles.routeLoadingCard
              }
            >
              <ActivityIndicator
                size="small"
                color="#2563eb"
              />

              <Text
                style={
                  styles.routeLoadingText
                }
              >
                Finding your route...
              </Text>
            </View>
          )}

          {!navigationActive &&
            routeInfo &&
            destination && (
              <View style={styles.routeCard}>
                <View
                  style={
                    styles.routeCardHeader
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.routeCardTitle
                      }
                    >
                      Route ready
                    </Text>

                    <Text
                      style={
                        styles.routeDestination
                      }
                      numberOfLines={
                        1
                      }
                    >
                      {
                        destination.name
                      }
                    </Text>
                  </View>

                  <View style={styles.routeHeaderActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Clear current route"
                      onPress={clearDestination}
                      style={styles.routeClearButton}
                    >
                      <Ionicons name="close" size={18} color="#5f6368" />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        routePanelExpanded
                          ? "Collapse route comparison"
                          : "Expand route comparison"
                      }
                      onPress={() =>
                        setRoutePanelExpanded(
                          (current) => !current
                        )
                      }
                      style={styles.routeCollapseButton}
                    >
                      <Ionicons
                        name={routePanelExpanded ? "chevron-down" : "chevron-up"}
                        size={20}
                        color="#374151"
                      />
                    </Pressable>
                  </View>
                </View>

                {routePanelExpanded && (
                  <>
                    <ScrollView
                      style={styles.routeDetailsScroll}
                      contentContainerStyle={
                        styles.routeDetailsContent
                      }
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                    >
                    <View
                      style={
                        styles.routeStatsRow
                      }
                    >
                      <View
                        style={
                          styles.routeStat
                        }
                      >
                        <Text
                          style={
                            styles.routeStatValue
                          }
                        >
                          {formatDistance(
                            routeInfo.distanceMeters
                          )}
                        </Text>

                        <Text
                          style={
                            styles.routeStatLabel
                          }
                        >
                          Distance
                        </Text>
                      </View>

                      <View
                        style={
                          styles.routeStat
                        }
                      >
                        <Text
                          style={
                            styles.routeStatValue
                          }
                        >
                          {formatDuration(
                            routeInfo.durationSeconds
                          )}
                        </Text>

                        <Text
                          style={
                            styles.routeStatLabel
                          }
                        >
                          Time
                        </Text>
                      </View>

                      <View
                        style={
                          styles.routeStat
                        }
                      >
                        <Text
                          style={
                            styles.routeStatValue
                          }
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          {getRouteComparisonLabel(
                            selectedRouteIndex,
                            availableRoutes,
                            communityHazards
                          )}
                        </Text>

                        <Text
                          style={
                            styles.routeStatLabel
                          }
                        >
                          Route
                        </Text>
                      </View>
                    </View>

                    {safetyScore && (
                      <View
                        style={
                          styles.safetyScoreRow
                        }
                      >
                        <View
                          style={
                            styles.safetyScoreLeft
                          }
                        >
                          <View
                            style={[
                              styles.safetyIcon,
                              safetyScore.dataCoverage < 50 &&
                                styles.safetyIconLimited,
                            ]}
                          >
                            <Ionicons
                              name={
                                safetyScore.dataCoverage < 50
                                  ? "shield-outline"
                                  : "shield-checkmark"
                              }
                              size={21}
                              color={
                                safetyScore.dataCoverage < 50
                                  ? "#64748b"
                                  : "#16a34a"
                              }
                            />
                          </View>

                          <View>
                            <Text
                              style={
                                styles.safetyScoreTitle
                              }
                            >
                              Safety Score
                            </Text>

                            <Text
                              style={styles.safetyScoreLabel}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                            >
                              {safetyScore.label} · {safetyScore.dataCoverage}% mapped/live data
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={[
                            styles.safetyScoreNumber,
                            safetyScore.dataCoverage < 50 &&
                              styles.safetyScoreLimited,
                          ]}
                        >
                          {safetyScore.score}
                          /100
                        </Text>
                      </View>
                    )}


                    {safetyScore && (
                      <View style={styles.safetyFactorsSection}>
                        {safetyScore.factors.map((factor) => (
                          <View
                            key={factor.name}
                            style={styles.safetyFactorItem}
                            accessibilityLabel={`${getSafetyFactorLabel(
                              factor.name
                            )}: ${factor.score} out of 100. ${factor.explanation}`}
                          >
                            <View style={styles.safetyFactorLabelRow}>
                              <Text
                                style={styles.safetyFactorName}
                                numberOfLines={1}
                              >
                                {getSafetyFactorLabel(factor.name)}
                              </Text>
                              <Text style={styles.safetyFactorScore}>
                                {factor.score}
                              </Text>
                            </View>
                            <View style={styles.safetyFactorTrack}>
                              <View
                                style={[
                                  styles.safetyFactorFill,
                                  { width: `${factor.score}%` },
                                ]}
                              />
                            </View>
                          </View>
                        ))}
                        <Text style={styles.safetyEstimateNote}>
                          Scores combine available ORS route data, TomTom traffic data where supplied, and nearby community reports. Hazard reports are unverified and may be outdated; no reports does not mean a route is hazard-free.
                        </Text>
                      </View>
                    )}

                    {availableRoutes.length > 1 &&
                      routeComparison &&
                      (
                        <View style={styles.routeComparisonSection}>
                          <View style={styles.routeComparisonHeader}>
                            <Text style={styles.routeComparisonTitle}>
                              All routes
                            </Text>
                            <Text style={styles.routeComparisonHint}>
                              Tap to select
                            </Text>
                          </View>

                          <View style={styles.routeComparisonOptions}>
                            {availableRoutes.map((route, index) => {
                              const score =
                                routeSafetyScores[index];

                              if (!score) {
                                return null;
                              }

                              const isFastest =
                                index === routeComparison.fastestIndex;
                              const isSafest =
                                index === routeComparison.safestIndex;

                              return (
                                <Pressable
                                  key={`route-choice-${index}`}
                                  accessibilityRole="button"
                                  accessibilityState={{
                                    selected:
                                      selectedRouteIndex === index,
                                  }}
                                  accessibilityLabel={`Route ${index + 1}${
                                    isFastest ? ", fastest" : ""
                                  }${isSafest ? ", highest safety score" : ""}, ${formatDuration(
                                    route.durationSeconds
                                  )}, ${formatDistance(
                                    route.distanceMeters
                                  )}, safety ${score.score} out of 100`}
                                  style={[
                                    styles.routeComparisonOption,
                                    selectedRouteIndex === index &&
                                      styles.routeComparisonOptionSelected,
                                  ]}
                                  onPress={() =>
                                    handleSelectRoute(index, true)
                                  }
                                >
                                  <View
                                    style={
                                      styles.routeOptionHeading
                                    }
                                  >
                                    <Text
                                      style={
                                        styles.routeOptionNumber
                                      }
                                    >
                                      Route {index + 1}
                                    </Text>
                                    <View
                                      style={
                                        styles.routeOptionBadges
                                      }
                                    >
                                      {isFastest && (
                                        <Text
                                          style={[
                                            styles.routeBadge,
                                            styles.fastestBadge,
                                          ]}
                                        >
                                          FASTEST
                                        </Text>
                                      )}
                                      {isSafest && (
                                        <Text
                                          style={[
                                            styles.routeBadge,
                                            styles.safestBadge,
                                          ]}
                                        >
                                          SAFER
                                        </Text>
                                      )}
                                    </View>
                                  </View>
                                  <View
                                    style={
                                      styles.routeOptionMetrics
                                    }
                                  >
                                    <Text
                                      style={
                                        styles.routeComparisonTime
                                      }
                                    >
                                      {formatDuration(
                                        route.durationSeconds
                                      )}
                                    </Text>
                                    <Text
                                      style={
                                        styles.routeComparisonMeta
                                      }
                                    >
                                      {formatDistance(
                                        route.distanceMeters
                                      )}
                                    </Text>
                                    <Text
                                      style={
                                        styles.routeComparisonScore
                                      }
                                    >
                                      {score.score}/100
                                    </Text>
                                  </View>
                                </Pressable>
                              );
                            })}
                          </View>

                          <View style={styles.routeComparisonDelta}>
                            <Text style={styles.routeComparisonDeltaText}>
                              {routeComparison.sameRoute
                                ? "Fastest is also safest"
                                : routeComparison.safetyDifference === 0
                                  ? "No score difference"
                                  : `Safer route +${routeComparison.safetyDifference} pts`}
                            </Text>
                            <Text style={styles.routeComparisonDeltaText}>
                              {routeComparison.sameRoute
                                ? "No time trade-off"
                                : `Time ${formatRouteTimeDifference(
                                    routeComparison.timeDifferenceSeconds
                                  )}`}
                            </Text>
                          </View>
                        </View>
                      )}
                    </ScrollView>

                    <Pressable
                      accessibilityRole="button"
                      style={
                        styles.startButton
                      }
                      onPress={
                        startNavigation
                      }
                    >
                      <Ionicons
                        name="navigate"
                        size={20}
                        color="#ffffff"
                      />

                      <Text
                        style={
                          styles.startButtonText
                        }
                      >
                        Start Navigation
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}

          {navigationActive && activeHazardAlert && (
            <View style={styles.liveHazardAlert} accessibilityLiveRegion="assertive">
              <View style={styles.liveHazardAlertIcon}>
                <Ionicons name="warning" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.liveHazardAlertContent}>
                <Text style={styles.liveHazardAlertEyebrow}>HAZARD AHEAD</Text>
                <Text style={styles.liveHazardAlertTitle} numberOfLines={1}>
                  {getHazardAlertLabel(activeHazardAlert.hazard.type)}
                </Text>
                <Text style={styles.liveHazardAlertDescription} numberOfLines={2}>
                  {activeHazardAlert.hazard.title || activeHazardAlert.hazard.description || "Community-reported hazard"}
                  {` · ${activeHazardAlert.distanceMeters} m away`}
                </Text>
                <Text style={styles.liveHazardAlertDisclaimer}>
                  Community report; not independently verified.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss hazard warning"
                onPress={() => setActiveHazardAlert(null)}
                style={styles.liveHazardAlertClose}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          )}

          {navigationActive && (
            <View
              style={
                styles.navigationPill
              }
            >
              <View
                style={
                  styles.navigationPillDot
                }
              />

              <Text
                style={
                  styles.navigationPillText
                }
              >
                Navigating
              </Text>

              {recalculating && (
                <ActivityIndicator
                  size="small"
                  color="#ffffff"
                />
              )}
            </View>
          )}
        </View>

        {navigationActive && (
          <View>
            <NavigationPanel
              active={
                navigationActive
              }
              arrived={arrived}
              recalculating={
                recalculating
              }
              currentStep={
                getCurrentNavigationStep()
                  ? {
                      instruction:
                        getCurrentNavigationStep()!
                          .instruction,
                      distanceMeters:
                        getCurrentNavigationStep()!
                          .distanceMeters,
                    }
                  : null
              }
              nextStep={
                getNextNavigationStep()
                  ? {
                      instruction:
                        getNextNavigationStep()!
                          .instruction,
                      distanceMeters:
                        getNextNavigationStep()!
                          .distanceMeters,
                    }
                  : null
              }
              voiceEnabled={
                voiceEnabled
              }
              nightMode={
                navigationNightMode
              }
              remainingDistanceMeters={
                remainingDistanceMeters
              }
              remainingDurationSeconds={
                remainingDurationSeconds
              }
              onStart={
                startNavigation
              }
              onEnd={
                finishNavigation
              }
              onFinish={
                finishNavigation
              }
              onToggleVoice={
                toggleVoice
              }
              onToggleNightMode={
                toggleNightMode
              }
              onToggleExpanded={() =>
                setRoutePanelExpanded(
                  (current) =>
                    !current
                )
              }
              previewSteps={navigationPreviewSteps}
              activeStepIndex={navigationStepIndex}
              previewStepIndex={previewStepIndex}
              onPreviewStepChange={handlePreviewStepChange}
            />
          </View>
        )}

        {locationPreferenceLoaded && !locationEnabled && (
          <View
            accessibilityRole="summary"
            style={[
              styles.locationAccessDeniedOverlay,
              { backgroundColor: isDarkTheme ? "#07111F" : "#F8FAFC" },
            ]}
          >
            <Ionicons
              name="location-outline"
              size={42}
              color={isDarkTheme ? "#FFFFFF" : "#111827"}
            />
            <Text
              style={[
                styles.locationAccessDeniedTitle,
                { color: isDarkTheme ? "#FFFFFF" : "#111827" },
              ]}
            >
              Location Access is denied
            </Text>
            <Text
              style={[
                styles.locationAccessDeniedMessage,
                { color: isDarkTheme ? "#D1D5DB" : "#4B5563" },
              ]}
            >
              To use the map, go to the Profile tab and turn on Location Preferences.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  header: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    zIndex: 20,
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
  },

  headerTitleContainer: {
    flex: 1,
    marginLeft: 10,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },

  headerSubtitle: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 1,
  },

  headerActions: {
    flexDirection: "row",
    gap: 8,
  },

  mapContainer: {
    flex: 1,
    position: "relative",
  },

  locationAccessDeniedOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    elevation: 30,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  locationAccessDeniedTitle: {
    marginTop: 16,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },

  locationAccessDeniedMessage: {
    marginTop: 9,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 320,
  },

  searchContainer: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 12,
    zIndex: 10,
  },

  travelModeContainer: {
    position: "absolute",
    top: 78,
    left: 12,
    right: 12,
    flexDirection: "row",
    backgroundColor:
      "rgba(255,255,255,0.96)",
    borderRadius: 14,
    padding: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 4,
  },

  travelModeButton: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },

  travelModeButtonActive: {
    backgroundColor: "#2563eb",
  },

  travelModeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },

  travelModeTextActive: {
    color: "#ffffff",
  },

  locationBadge: {
    position: "absolute",
    top: 138,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
  },

  locationBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400e",
  },

  loadingCard: {
    position: "absolute",
    top: 140,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor:
      "rgba(255,255,255,0.96)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 4,
  },

  loadingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },

  routeLoadingCard: {
    position: "absolute",
    bottom: 165,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor:
      "rgba(255,255,255,0.97)",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 4,
  },

  routeLoadingText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },

  routeCard: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 18,
    maxHeight: "86%",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 7,
  },

  routeDetailsScroll: {
    flexShrink: 1,
    minHeight: 0,
  },

  routeDetailsContent: {
    paddingBottom: 4,
  },

  routeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  routeHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  routeCardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },

  routeDestination: {
    maxWidth: 270,
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },

  routeCollapseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },

  routeClearButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },

  routeStatsRow: {
    flexDirection: "row",
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },

  routeStat: {
    flex: 1,
  },

  routeStatValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },

  routeStatLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 2,
  },

  safetyScoreRow: {
    marginTop: 13,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  safetyScoreLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  safetyIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dcfce7",
  },

  safetyIconLimited: {
    backgroundColor: "#f1f5f9",
  },

  safetyScoreTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },

  safetyScoreLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: "#16a34a",
  },

  safetyScoreLimited: {
    color: "#64748b",
  },

  safetyScoreNumber: {
    fontSize: 21,
    fontWeight: "900",
    color: "#16a34a",
  },

  safetyFactorsSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },

  safetyFactorItem: {
    width: "48%",
    marginBottom: 7,
  },

  safetyFactorLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },

  safetyFactorName: {
    flex: 1,
    fontSize: 10,
    fontWeight: "600",
    color: "#475569",
  },

  safetyFactorScore: {
    fontSize: 11,
    fontWeight: "800",
    color: "#111827",
  },

  safetyFactorTrack: {
    height: 3,
    marginTop: 3,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },

  safetyFactorFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#22a06b",
  },

  safetyEstimateNote: {
    width: "100%",
    marginTop: 1,
    fontSize: 9,
    lineHeight: 12,
    color: "#64748b",
  },

  routeComparisonSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },

  routeComparisonHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  routeComparisonTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
  },

  routeComparisonHint: {
    fontSize: 9,
    color: "#64748b",
  },

  routeComparisonOptions: {
    gap: 5,
    marginTop: 6,
  },

  routeComparisonOption: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },

  routeComparisonOptionSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },

  routeOptionHeading: {
    minHeight: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },

  routeOptionNumber: {
    fontSize: 10,
    fontWeight: "800",
    color: "#334155",
  },

  routeOptionBadges: {
    flexDirection: "row",
    gap: 4,
  },

  routeBadge: {
    overflow: "hidden",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 8,
    fontWeight: "800",
  },

  fastestBadge: {
    color: "#1d4ed8",
    backgroundColor: "#dbeafe",
  },

  safestBadge: {
    color: "#166534",
    backgroundColor: "#dcfce7",
  },

  routeOptionMetrics: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 3,
  },

  routeComparisonLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748b",
  },

  routeComparisonTime: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },

  routeComparisonMeta: {
    marginTop: 1,
    fontSize: 10,
    color: "#64748b",
  },

  routeComparisonScore: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: "700",
    color: "#334155",
  },

  routeComparisonDelta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },

  routeComparisonDeltaText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#334155",
  },

  startButton: {
    height: 48,
    marginTop: 14,
    borderRadius: 13,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  startButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  clearDestinationButton: {
    position: "absolute",
    right: 14,
    bottom: 27,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor:
      "rgba(255,255,255,0.96)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 4,
  },

  clearDestinationText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },

  liveHazardAlert: {
    position: "absolute",
    top: 58,
    left: 12,
    right: 12,
    zIndex: 35,
    elevation: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#7F1D1D",
    borderWidth: 1,
    borderColor: "#F87171",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },

  liveHazardAlertIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#B91C1C",
    alignItems: "center",
    justifyContent: "center",
  },

  liveHazardAlertContent: {
    flex: 1,
    minWidth: 0,
  },

  liveHazardAlertEyebrow: {
    color: "#FECACA",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },

  liveHazardAlertTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },

  liveHazardAlertDescription: {
    color: "#FEE2E2",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },

  liveHazardAlertDisclaimer: {
    color: "#FCA5A5",
    fontSize: 9,
    marginTop: 4,
  },

  liveHazardAlertClose: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  navigationPill: {
    position: "absolute",
    top: 14,
    right: 130,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "#111827",
  },

  navigationPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },

  navigationPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  coordinateModal: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    padding: 20,
  },

  coordinateModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  coordinateModalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
  },

  coordinateModalSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "#6b7280",
  },

  coordinateLabel: {
    marginBottom: 7,
    fontSize: 12,
    fontWeight: "800",
    color: "#374151",
  },

  coordinateInput: {
    height: 46,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 11,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#111827",
    marginBottom: 14,
  },

  coordinateButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },

  coordinateCancel: {
    flex: 1,
    height: 46,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
  },

  coordinateCancelText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#374151",
  },

  coordinateSubmit: {
    flex: 1.5,
    height: 46,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    backgroundColor: "#2563eb",
  },

  coordinateSubmitText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
  saveDestinationBanner: {
  position: "absolute",
  bottom: 56,
  left: 12,
  right: 12,
  zIndex: 15,
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  padding: 14,
  borderRadius: 14,
  backgroundColor: "#ffffff",
  borderWidth: 1,
  borderColor: "#dbeafe",
  shadowColor: "#000000",
  shadowOpacity: 0.12,
  shadowRadius: 8,
  shadowOffset: {
    width: 0,
    height: 3,
  },
  elevation: 5,
},

saveDestinationTitle: {
  fontSize: 14,
  fontWeight: "800",
  color: "#111827",
},

saveDestinationSubtitle: {
  marginTop: 3,
  fontSize: 12,
  lineHeight: 17,
  color: "#64748b",
},
})