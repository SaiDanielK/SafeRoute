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
} from "react-native";
import { router } from "expo-router";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { Ionicons } from "@expo/vector-icons";
import { Region } from "react-native-maps";

import SafeRouteMap from "../components/SafeRouteMap";
import DestinationSearch from "../components/DestinationSearch";
import NavigationPanel from "../components/NavigationPanel";

import {
  getRoute,
  RouteCoordinate,
  RouteResult,
  RouteStep,
} from "../services/routeService";

import { getSpeedLimit } from "../services/speedLimitService";

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

function getRouteSafetyScore(
  route: RouteResult
): SafetyScore {
  const localHour = new Date().getHours();
  const isDaylightEstimate =
    localHour >= 7 && localHour < 19;

  return calculateSafetyScore({
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    routeInfrastructure:
      route.safetyData?.infrastructureScore,
    routeInfrastructureCoverage:
      route.safetyData?.infrastructureCoverage,
    routeInfrastructureExplanation:
      route.safetyData?.explanation,
    pedestrianAccess:
      route.safetyData?.pedestrianAccessScore,
    pedestrianAccessCoverage:
      route.safetyData?.pedestrianAccessCoverage,
    pedestrianAccessExplanation:
      "Estimated from ORS way types; this does not verify sidewalk condition or separation from traffic.",
    traffic:
      route.safetyData?.trafficScore,
    trafficCoverage:
      route.safetyData?.trafficCoverage,
    trafficExplanation:
      route.safetyData?.trafficExplanation,
    lighting: isDaylightEstimate ? 70 : 35,
    lightingCoverage: 0,
    lightingExplanation: isDaylightEstimate
      ? "Daytime proxy only; mapped streetlight data is not connected."
      : "Nighttime proxy only; mapped streetlight data is not connected.",
    hazards: 50,
    hazardsCoverage: 0,
    hazardsExplanation:
      "Neutral baseline until community hazard reports are connected.",
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
  routes: RouteResult[]
): number {
  return getRecommendedRouteIndex(
    routes.map((route) => ({
      score: getRouteSafetyScore(route).score,
      durationSeconds: route.durationSeconds,
    }))
  );
}

function getRouteComparisonLabel(
  index: number,
  routes: RouteResult[]
): string {
  if (index === getRecommendedRouteIndexForRoutes(routes)) {
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
  const [region, setRegion] =
    useState<Region | null>(null);

  const [destination, setDestination] =
    useState<Destination | null>(
      null
    );

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

        const permission =
          await Location.requestForegroundPermissionsAsync();

        if (
          permission.status !==
          "granted"
        ) {
          setLocationEnabled(false);
          setLoading(false);
          return null;
        }

        setLocationEnabled(true);

        const current =
          await Location.getCurrentPositionAsync(
            {
              accuracy:
                Location.Accuracy.High,
            }
          );

        setRegion(
          toMapRegion(
            current.coords.latitude,
            current.coords.longitude
          )
        );

        const position: LivePosition =
          {
            latitude:
              current.coords.latitude,
            longitude:
              current.coords.longitude,
            heading:
              current.coords.heading ??
              undefined,
            speed:
              current.coords.speed ??
              undefined,
          };

        setNavigationPosition(
          position
        );

        navigationPositionRef.current =
          position;

        return current.coords;
      } catch (error) {
        console.error(
          "Unable to get current location:",
          error
        );

        return null;
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    getCurrentLocation();

    return () => {
      locationSubscription.current?.remove();
      Speech.stop();
      trafficRequestIdRef.current += 1;
    };
  }, [getCurrentLocation]);

  const calculateAndSetSafetyScore =
    useCallback(
      (route: RouteResult) => {
        const score = getRouteSafetyScore(route);

        setSafetyScore(score);

        return score;
      },
      []
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

        const selectedIndex =
          getRecommendedRouteIndexForRoutes(
            routes
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
      ]
    );

  const handleSelectDestination =
    useCallback(
      async (
        selectedDestination: Destination
      ) => {
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
      ]
    );

  const handleDroppedPin =
    useCallback(
      async (
        coordinate: RouteCoordinate
      ) => {
        if (
          navigationActiveRef.current
        ) {
          return;
        }

        setRoutePanelExpanded(true);

        await routeToCoordinate(
          coordinate.latitude,
          coordinate.longitude
        );
      },
      [routeToCoordinate]
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

          const selectedIndex =
            getRecommendedRouteIndexForRoutes(
              routes
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
      ]
    );

  const handleArrival =
    useCallback(() => {
      if (arrived) {
        return;
      }

      setArrived(true);

      if (
        voiceEnabledRef.current
      ) {
        speak(
          "You have arrived at your destination."
        );
      }

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
    }, [arrived]);

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

  const toggleNightMode =
    useCallback(() => {
      setNavigationNightMode(
        (current) => !current
      );
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
    availableRoutes.map(
      getRouteSafetyScore
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
                setMapFollowingUser(
                  true
                );

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
          />

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
                            availableRoutes
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
                          ORS and TomTom data where available; lighting is a time proxy and hazards use a neutral baseline until reports are connected.
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
            />
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

  navigationPill: {
    position: "absolute",
    top: 14,
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
})