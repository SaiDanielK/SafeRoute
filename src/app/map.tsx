import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { Ionicons } from "@expo/vector-icons";

import SafeRouteMap from "../components/SafeRouteMap";
import DestinationSearch from "../components/DestinationSearch";
import NavigationPanel from "../components/NavigationPanel";

import {
  getRoute,
  RouteCoordinate,
  RouteResult,
  RouteStep,
} from "../services/routeService";

import {
  TRAVEL_MODES,
  TravelMode,
} from "../constants/travelModes";

import { formatDuration } from "../utils/formatters";
import { getSpeedLimit } from "../services/speedLimitService";

type Destination = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type LivePosition = {
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
};

const ARRIVAL_WALKING_METERS = 35;
const ARRIVAL_DRIVING_METERS = 60;

const OFF_ROUTE_WALKING_METERS = 65;
const OFF_ROUTE_DRIVING_METERS = 95;

const OFF_ROUTE_REQUIRED_UPDATES = 2;

const REROUTE_COOLDOWN_MS = 8000;

const VOICE_ADVANCE_WALKING_METERS = 120;
const VOICE_ADVANCE_DRIVING_METERS = 250;

const COMPACT_SCREEN_WIDTH_RATIO = 0.99;
const COMPACT_SCREEN_HEIGHT_RATIO = 0.99;

function degreesToRadians(
  degrees: number
): number {
  return (degrees * Math.PI) / 180;
}

function getDistanceBetweenPoints(
  first: RouteCoordinate,
  second: RouteCoordinate
): number {
  const earthRadius = 6371000;

  const latitudeDifference =
    degreesToRadians(
      second.latitude - first.latitude
    );

  const longitudeDifference =
    degreesToRadians(
      second.longitude - first.longitude
    );

  const firstLatitude =
    degreesToRadians(first.latitude);

  const secondLatitude =
    degreesToRadians(second.latitude);

  const a =
    Math.sin(
      latitudeDifference / 2
    ) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(
        longitudeDifference / 2
      ) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
}

function getClosestRouteIndex(
  position: RouteCoordinate,
  coordinates: RouteCoordinate[]
): number {
  if (coordinates.length === 0) {
    return 0;
  }

  let closestIndex = 0;
  let closestDistance = Infinity;

  coordinates.forEach(
    (coordinate, index) => {
      const distance =
        getDistanceBetweenPoints(
          position,
          coordinate
        );

      if (
        distance <
        closestDistance
      ) {
        closestDistance =
          distance;
        closestIndex = index;
      }
    }
  );

  return closestIndex;
}

function getDistanceToRoute(
  position: RouteCoordinate,
  coordinates: RouteCoordinate[]
): number {
  if (coordinates.length === 0) {
    return Infinity;
  }

  const closestIndex =
    getClosestRouteIndex(
      position,
      coordinates
    );

  return getDistanceBetweenPoints(
    position,
    coordinates[
      closestIndex
    ]
  );
}

function getCurrentStepIndex(
  position: RouteCoordinate,
  routeCoordinates: RouteCoordinate[],
  steps: RouteStep[]
): number {
  if (
    routeCoordinates.length === 0 ||
    steps.length === 0
  ) {
    return 0;
  }

  const closestIndex =
    getClosestRouteIndex(
      position,
      routeCoordinates
    );

  let currentIndex = 0;

  for (
    let index = 0;
    index < steps.length;
    index++
  ) {
    const endIndex =
      steps[index]
        .wayPoints?.[1] ?? 0;

    if (
      closestIndex >= endIndex
    ) {
      currentIndex = index;
    } else {
      break;
    }
  }

  return Math.min(
    currentIndex,
    steps.length - 1
  );
}

function getRemainingRouteDistance(
  position: RouteCoordinate,
  routeCoordinates: RouteCoordinate[]
): number {
  if (
    routeCoordinates.length < 2
  ) {
    return 0;
  }

  const closestIndex =
    getClosestRouteIndex(
      position,
      routeCoordinates
    );

  let distance =
    getDistanceBetweenPoints(
      position,
      routeCoordinates[
        closestIndex
      ]
    );

  for (
    let index = closestIndex;
    index <
    routeCoordinates.length - 1;
    index++
  ) {
    distance +=
      getDistanceBetweenPoints(
        routeCoordinates[index],
        routeCoordinates[
          index + 1
        ]
      );
  }

  return distance;
}

function formatDistance(
  meters: number
): string {
  if (!Number.isFinite(meters)) {
    return "--";
  }

  const miles =
    meters / 1609.344;

  if (miles < 10) {
    return `${miles.toFixed(
      1
    )} mi`;
  }

  return `${Math.round(
    miles
  )} mi`;
}

function getAdvanceDistance(
  travelMode: TravelMode["id"]
): number {
  if (
    travelMode ===
    "driving-car"
  ) {
    return VOICE_ADVANCE_DRIVING_METERS;
  }

  return VOICE_ADVANCE_WALKING_METERS;
}

function speak(text: string) {
  Speech.stop();

  Speech.speak(text, {
    language: "en-US",
    rate: 0.8,
    pitch: 1.0,
  });
}

function getRouteComparisonLabel(
  selectedRoute: RouteResult,
  primaryRoute: RouteResult
): string {
  const difference =
    Math.round(
      selectedRoute.durationSeconds -
        primaryRoute.durationSeconds
    );

  const differenceMinutes =
    Math.round(
      Math.abs(difference) / 60
    );

  if (
    differenceMinutes <= 1
  ) {
    return "Similar ETA";
  }

  if (difference < 0) {
    return `Saves ${differenceMinutes} min`;
  }

  return `+${differenceMinutes} min`;
}

export default function MapScreen() {
  const [region, setRegion] =
    useState<Location.LocationObject | null>(
      null
    );

  const [destination, setDestination] =
    useState<Destination | null>(
      null
    );

  const [
    routeCoordinates,
    setRouteCoordinates,
  ] = useState<RouteCoordinate[]>(
    []
  );

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

  const [routeLoading, setRouteLoading] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [
    locationEnabled,
    setLocationEnabled,
  ] = useState(true);

  const [travelMode, setTravelMode] =
    useState<TravelMode["id"]>(
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

  const [speedLimit, setSpeedLimit] =
    useState<number | null>(null);

  const [voiceEnabled, setVoiceEnabled] =
    useState(true);

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
  ] = useState(false);

  const [compactScreen, setCompactScreen] =
    useState(false);

  /*
   * Height of the bottom NavigationPanel.
   *
   * This lets the expanded route panel
   * attach directly above it instead of
   * floating over it.
   */
  const [
    navigationPanelHeight,
    setNavigationPanelHeight,
  ] = useState(0);

  const routePanelAnimation =
    useRef(new Animated.Value(0))
      .current;

  useEffect(() => {
    Animated.timing(
      routePanelAnimation,
      {
        toValue:
          routePanelExpanded
            ? 1
            : 0,
        duration: 240,
        useNativeDriver: false,
      }
    ).start();
  }, [
    routePanelExpanded,
    routePanelAnimation,
  ]);

  const [
    mapFollowingUser,
    setMapFollowingUser,
  ] = useState(true);

  const [map3DEnabled, setMap3DEnabled] =
    useState(false);

  const locationSubscriptionRef =
    useRef<Location.LocationSubscription | null>(
      null
    );

  const routeCoordinatesRef =
    useRef<RouteCoordinate[]>(
      []
    );

  const routeInfoRef =
    useRef<RouteResult | null>(
      null
    );

  const availableRoutesRef =
    useRef<RouteResult[]>([]);

  const destinationRef =
    useRef<Destination | null>(
      null
    );

  const travelModeRef =
    useRef<TravelMode["id"]>(
      "foot-walking"
    );

  const currentStepRef =
    useRef(0);

  const announcedStepRef =
    useRef<number | null>(
      null
    );

  const offRouteCountRef =
    useRef(0);

  const lastRerouteRef =
    useRef(0);

  const reroutingRef =
    useRef(false);

  const navigationActiveRef =
    useRef(false);

  const voiceEnabledRef =
    useRef(true);

  const speedLimitLookupRef =
    useRef(0);

  useEffect(() => {
    routeCoordinatesRef.current =
      routeCoordinates;
  }, [routeCoordinates]);

  useEffect(() => {
    routeInfoRef.current =
      routeInfo;
  }, [routeInfo]);

  useEffect(() => {
    availableRoutesRef.current =
      availableRoutes;
  }, [availableRoutes]);

  useEffect(() => {
    destinationRef.current =
      destination;
  }, [destination]);

  useEffect(() => {
    travelModeRef.current =
      travelMode;
  }, [travelMode]);

  useEffect(() => {
    navigationActiveRef.current =
      navigationActive;
  }, [navigationActive]);

  useEffect(() => {
    voiceEnabledRef.current =
      voiceEnabled;
  }, [voiceEnabled]);

  const getCurrentLocation =
    useCallback(async () => {
      try {
        setLoading(true);

        const {
          status,
        } =
          await Location.requestForegroundPermissionsAsync();

        if (
          status !==
          "granted"
        ) {
          setLocationEnabled(false);
          setLoading(false);
          return;
        }

        setLocationEnabled(true);

        const current =
          await Location.getCurrentPositionAsync(
            {
              accuracy:
                Location.Accuracy.High,
            }
          );

        setRegion(current);

        setNavigationPosition({
          latitude:
            current.coords
              .latitude,
          longitude:
            current.coords
              .longitude,
          heading:
            current.coords
              .heading,
          speed:
            current.coords.speed,
        });
      } catch (error) {
        console.error(
          "Location error:",
          error
        );
        setLocationEnabled(false);
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    getCurrentLocation();

    return () => {
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current =
        null;

      Speech.stop();
    };
  }, [getCurrentLocation]);

  function applyRouteResult(
    result: RouteResult,
    routesOverride?: RouteResult[]
  ) {
    const routes =
      routesOverride ??
      [
        result,
        ...(result.alternatives ?? []),
      ];

    setRouteInfo(result);
    setRouteCoordinates(
      result.coordinates
    );

    setAvailableRoutes(routes);

    routeInfoRef.current =
      result;

    routeCoordinatesRef.current =
      result.coordinates;

    availableRoutesRef.current =
      routes;

    setRemainingDistanceMeters(
      result.distanceMeters
    );

    setRemainingDurationSeconds(
      result.durationSeconds
    );

    setNavigationStepIndex(0);

    currentStepRef.current = 0;
    announcedStepRef.current = null;
    offRouteCountRef.current = 0;
  }

  async function calculateRoute(
    start: RouteCoordinate,
    end: RouteCoordinate,
    mode: TravelMode["id"],
    isReroute = false
  ) {
    try {
      if (isReroute) {
        setRecalculating(true);
      } else {
        setRouteLoading(true);
      }

      const result =
        await getRoute(
          start,
          end,
          mode
        );

      const routes = [
        result,
        ...(result.alternatives ?? []),
      ];

      setSelectedRouteIndex(0);

      applyRouteResult(
        result,
        routes
      );

      return result;
    } catch (error) {
      console.error(
        "Route calculation error:",
        error
      );

      if (!isReroute) {
        setRouteCoordinates([]);
        setRouteInfo(null);
        setAvailableRoutes([]);
        setSelectedRouteIndex(0);
      }

      return null;
    } finally {
      if (isReroute) {
        setRecalculating(false);
      } else {
        setRouteLoading(false);
      }
    }
  }

  function handleSelectRoute(
    index: number
  ) {
    const routes =
      availableRoutesRef.current;

    const selected =
      routes[index];

    if (!selected) {
      return;
    }

    setSelectedRouteIndex(index);

    applyRouteResult(
      selected,
      routes
    );

    /*
     * Keep the alternatives panel open
     * so the user can switch between routes.
     */
    setRoutePanelExpanded(true);
  }

  async function handleSelectDestination(
    selectedDestination: Destination
  ) {
    setRoutePanelExpanded(false);

    setDestination(
      selectedDestination
    );

    destinationRef.current =
      selectedDestination;

    setMapFollowingUser(true);

    const start =
      navigationPosition ??
      (region
        ? {
            latitude:
              region.coords
                .latitude,
            longitude:
              region.coords
                .longitude,
          }
        : null);

    if (!start) {
      return;
    }

    await calculateRoute(
      start,
      {
        latitude:
          selectedDestination.latitude,
        longitude:
          selectedDestination.longitude,
      },
      travelMode
    );
  }

  function stopNavigation() {
    locationSubscriptionRef.current?.remove();

    locationSubscriptionRef.current =
      null;

    navigationActiveRef.current =
      false;

    setNavigationActive(false);

    Speech.stop();

    announcedStepRef.current = null;
    offRouteCountRef.current = 0;
    reroutingRef.current = false;

    setRecalculating(false);

    setMapFollowingUser(true);

    setSpeedLimit(null);
    speedLimitLookupRef.current = 0;
  }

  function clearDestination() {
    stopNavigation();

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
    availableRoutesRef.current =
      [];

    setSelectedRouteIndex(0);

    setNavigationPosition(null);

    setRemainingDistanceMeters(0);
    setRemainingDurationSeconds(0);

    setNavigationStepIndex(0);

    setArrived(false);
    setRecalculating(false);
    setRoutePanelExpanded(false);

    currentStepRef.current = 0;
    announcedStepRef.current =
      null;
  }

  async function rerouteFromLocation(
    position: LivePosition
  ) {
    const currentDestination =
      destinationRef.current;

    if (!currentDestination) {
      return;
    }

    if (reroutingRef.current) {
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

    reroutingRef.current = true;
    lastRerouteRef.current = now;

    setRecalculating(true);

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

      setSelectedRouteIndex(0);

      applyRouteResult(result);

      currentStepRef.current =
        0;

      announcedStepRef.current =
        null;

      offRouteCountRef.current =
        0;
    } catch (error) {
      console.error(
        "Rerouting error:",
        error
      );
    } finally {
      reroutingRef.current =
        false;

      setRecalculating(false);
    }
  }

  function handleArrival() {
    if (
      !navigationActiveRef.current
    ) {
      return;
    }

    setArrived(true);

    navigationActiveRef.current =
      false;

    setNavigationActive(false);

    locationSubscriptionRef.current?.remove();

    locationSubscriptionRef.current =
      null;

    Speech.stop();

    if (
      voiceEnabledRef.current
    ) {
      speak(
        "You have arrived at your destination."
      );
    }
  }

  function speakUpcomingTurn(
    stepIndex: number,
    position: LivePosition
  ) {
    if (
      !voiceEnabledRef.current
    ) {
      return;
    }

    const route =
      routeInfoRef.current;

    const coordinates =
      routeCoordinatesRef.current;

    if (
      !route ||
      coordinates.length === 0
    ) {
      return;
    }

    const step =
      route.steps[stepIndex];

    if (!step) {
      return;
    }

    const advanceDistance =
      getAdvanceDistance(
        travelModeRef.current
      );

    const closestIndex =
      getClosestRouteIndex(
        {
          latitude:
            position.latitude,
          longitude:
            position.longitude,
        },
        coordinates
      );

    const targetIndex =
      Math.min(
        step.wayPoints?.[0] ??
          closestIndex,
        coordinates.length - 1
      );

    let distanceToTurn = 0;

    if (
      targetIndex >=
      closestIndex
    ) {
      distanceToTurn =
        getDistanceBetweenPoints(
          {
            latitude:
              position.latitude,
            longitude:
              position.longitude,
          },
          coordinates[
            targetIndex
          ]
        );

      for (
        let index =
          closestIndex;
        index <
        targetIndex;
        index++
      ) {
        distanceToTurn +=
          getDistanceBetweenPoints(
            coordinates[index],
            coordinates[
              index + 1
            ]
          );
      }
    }

    if (
      distanceToTurn <=
      advanceDistance
    ) {
      if (
        announcedStepRef.current !==
        stepIndex
      ) {
        announcedStepRef.current =
          stepIndex;

        speak(
          step.instruction
        );
      }
    }
  }

  async function handleNavigationLocation(
    location: Location.LocationObject
  ) {
    if (
      !navigationActiveRef.current
    ) {
      return;
    }

    const position: LivePosition =
      {
        latitude:
          location.coords
            .latitude,
        longitude:
          location.coords
            .longitude,
        heading:
          location.coords
            .heading,
        speed:
          location.coords.speed,
      };

    setNavigationPosition(
      position
    );

    setRegion(location);

    const now = Date.now();

    if (
      now -
        speedLimitLookupRef.current >=
      15000
    ) {
      speedLimitLookupRef.current =
        now;

      getSpeedLimit(
        position.latitude,
        position.longitude
      ).then((result) => {
        if (
          navigationActiveRef.current
        ) {
          setSpeedLimit(
            result.speedLimitMph
          );
        }
      });
    }

    const currentDestination =
      destinationRef.current;

    const coordinates =
      routeCoordinatesRef.current;

    const route =
      routeInfoRef.current;

    if (
      !currentDestination ||
      !route ||
      coordinates.length === 0
    ) {
      return;
    }

    const currentCoordinate: RouteCoordinate =
      {
        latitude:
          position.latitude,
        longitude:
          position.longitude,
      };

    const destinationCoordinate: RouteCoordinate =
      {
        latitude:
          currentDestination.latitude,
        longitude:
          currentDestination.longitude,
      };

    const distanceToDestination =
      getDistanceBetweenPoints(
        currentCoordinate,
        destinationCoordinate
      );

    const arrivalThreshold =
      travelModeRef.current ===
      "driving-car"
        ? ARRIVAL_DRIVING_METERS
        : ARRIVAL_WALKING_METERS;

    if (
      distanceToDestination <=
      arrivalThreshold
    ) {
      handleArrival();
      return;
    }

    const distanceToRoute =
      getDistanceToRoute(
        currentCoordinate,
        coordinates
      );

    const offRouteThreshold =
      travelModeRef.current ===
      "driving-car"
        ? OFF_ROUTE_DRIVING_METERS
        : OFF_ROUTE_WALKING_METERS;

    if (
      distanceToRoute >
      offRouteThreshold
    ) {
      offRouteCountRef.current +=
        1;
    } else {
      offRouteCountRef.current = 0;
    }

    if (
      offRouteCountRef.current >=
      OFF_ROUTE_REQUIRED_UPDATES
    ) {
      offRouteCountRef.current = 0;

      await rerouteFromLocation(
        position
      );

      return;
    }

    const currentIndex =
      getCurrentStepIndex(
        currentCoordinate,
        coordinates,
        route.steps
      );

    if (
      currentIndex !==
      currentStepRef.current
    ) {
      currentStepRef.current =
        currentIndex;

      setNavigationStepIndex(
        currentIndex
      );

      announcedStepRef.current =
        null;
    }

    setNavigationStepIndex(
      currentIndex
    );

    const remainingDistance =
      getRemainingRouteDistance(
        currentCoordinate,
        coordinates
      );

    const routeDistance =
      route.distanceMeters;

    const routeDuration =
      route.durationSeconds;

    const progress =
      routeDistance > 0
        ? Math.min(
            1,
            Math.max(
              0,
              1 -
                remainingDistance /
                  routeDistance
            )
          )
        : 0;

    const remainingDuration =
      Math.max(
        0,
        routeDuration *
          (1 - progress)
      );

    setRemainingDistanceMeters(
      remainingDistance
    );

    setRemainingDurationSeconds(
      remainingDuration
    );

    speakUpcomingTurn(
      currentIndex,
      position
    );
  }

async function startNavigation() {
  if (!destination) {
    return;
  }

  let start =
    navigationPosition;

  if (!start && region) {
    start = {
      latitude:
        region.coords.latitude,
      longitude:
        region.coords.longitude,
      heading:
        region.coords.heading,
      speed:
        region.coords.speed,
    };
  }

  if (!start) {
    return;
  }

  // Make sure there is already a selected route.
  // IMPORTANT: Do not call calculateRoute() here.
  // The user may have selected an alternative route,
  // and we want to navigate using that exact route.
  if (
    routeCoordinatesRef.current.length === 0 ||
    !routeInfoRef.current
  ) {
    return;
  }

  setArrived(false);

  setMapFollowingUser(true);

  // Keep the currently selected route.
  // Do NOT recalculate here.
  setRoutePanelExpanded(false);

  setNavigationActive(true);

  navigationActiveRef.current =
    true;

  setNavigationPosition(start);

  currentStepRef.current = 0;
  announcedStepRef.current =
    null;

  offRouteCountRef.current =
    0;

  try {
    const permission =
      await Location.requestForegroundPermissionsAsync();

    if (
      permission.status !==
      "granted"
    ) {
      setLocationEnabled(false);
      setNavigationActive(false);
      navigationActiveRef.current =
        false;
      return;
    }

    locationSubscriptionRef.current?.remove();

    locationSubscriptionRef.current =
      await Location.watchPositionAsync(
        {
          accuracy:
            Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: 2000,
          mayShowUserSettingsDialog:
            true,
        },
        handleNavigationLocation
      );
  } catch (error) {
    console.error(
      "Navigation location error:",
      error
    );
  }
}

  function finishNavigation() {
    setArrived(false);
    stopNavigation();

    if (destination) {
      setRouteCoordinates(
        routeCoordinatesRef.current
      );
    }
  }

  function toggleVoice() {
    const nextValue =
      !voiceEnabledRef.current;

    voiceEnabledRef.current =
      nextValue;

    setVoiceEnabled(
      nextValue
    );

    if (!nextValue) {
      Speech.stop();
    }
  }

  function toggleNightMode() {
    setNavigationNightMode(
      (previous) =>
        !previous
    );
  }

  function toggleCompactScreen() {
    setCompactScreen(
      (previous) =>
        !previous
    );
  }

  const currentStep =
    routeInfo?.steps[
      navigationStepIndex
    ] ?? null;

  const nextStep =
    routeInfo?.steps[
      navigationStepIndex + 1
    ] ?? null;

  const { width, height } =
    Dimensions.get("window");

  const compactWidth =
    width *
    COMPACT_SCREEN_WIDTH_RATIO;

  const compactHeight =
    height *
    COMPACT_SCREEN_HEIGHT_RATIO;

  const primaryRoute =
    availableRoutes[0] ??
    null;

  /*
   * The route panel normally sits at
   * bottom: 178, leaving room for the
   * NavigationPanel.
   *
   * When expanded, it moves directly
   * above the actual NavigationPanel.
   */
  const expandedRouteBottom =
    navigationPanelHeight > 0
      ? navigationPanelHeight + 18
      : 178;

  return (
    <View style={styles.outerScreen}>
      <View
        style={[
          styles.appFrame,
          compactScreen && {
            width: compactWidth,
            height: compactHeight,
          },
        ]}
      >
        <SafeAreaView
          style={styles.safeArea}
        >
          <View style={styles.header}>
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={() => {
                if (
                  navigationActive
                ) {
                  stopNavigation();
                }

                router.back();
              }}
            >
              <Ionicons
                name="chevron-back"
                size={25}
                color="#FFFFFF"
              />
            </Pressable>

            <View
              style={styles.headerText}
            >
              <Text
                style={styles.headerTitle}
              >
                SafeRoute
              </Text>

              <Text
                style={styles.headerSubtitle}
              >
                Safer navigation
              </Text>
            </View>

            <View
              style={styles.headerActions}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.headerLocationButton,
                  pressed &&
                    styles.buttonPressed,
                ]}
                onPress={
                  getCurrentLocation
                }
                accessibilityRole="button"
                accessibilityLabel="Center on current location"
              >
                <Ionicons
                  name="locate-outline"
                  size={22}
                  color="#20C997"
                />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.headerCompactButton,
                  compactScreen &&
                    styles.headerCompactButtonActive,
                  pressed &&
                    styles.buttonPressed,
                ]}
                onPress={
                  toggleCompactScreen
                }
                accessibilityRole="button"
                accessibilityLabel={
                  compactScreen
                    ? "Expand SafeRoute screen"
                    : "Shrink SafeRoute screen"
                }
              >
                <Ionicons
                  name={
                    compactScreen
                      ? "scan-outline"
                      : "contract-outline"
                  }
                  size={21}
                  color={
                    compactScreen
                      ? "#20C997"
                      : "#A9BDD1"
                  }
                />
              </Pressable>
            </View>
          </View>

          <View
            style={styles.mapContainer}
          >
            <SafeRouteMap
              region={
                region
                  ? {
                      latitude:
                        region.coords
                          .latitude,
                      longitude:
                        region.coords
                          .longitude,
                      latitudeDelta:
                        0.05,
                      longitudeDelta:
                        0.05,
                    }
                  : null
              }
              destination={
                destination
              }
              routeCoordinates={
                routeCoordinates
              }
              alternativeRoutes={
                availableRoutes
                  .slice(1)
                  .map(
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
                  (previous) =>
                    !previous
                )
              }
            />

            {!navigationActive && (
              <>
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

                <View
                  style={
                    styles.travelModeContainer
                  }
                >
                  {TRAVEL_MODES.map(
                    (mode) => {
                      const selected =
                        travelMode ===
                        mode.id;

                      return (
                        <Pressable
                          key={
                            mode.id
                          }
                          style={({ pressed }) => [
                            styles.travelModeButton,
                            selected &&
                              styles.travelModeButtonSelected,
                            pressed &&
                              styles.buttonPressed,
                          ]}
                          onPress={async () => {
                            setTravelMode(
                              mode.id
                            );

                            travelModeRef.current =
                              mode.id;

                            if (
                              destination &&
                              region
                            ) {
                              await calculateRoute(
                                {
                                  latitude:
                                    region
                                      .coords
                                      .latitude,
                                  longitude:
                                    region
                                      .coords
                                      .longitude,
                                },
                                {
                                  latitude:
                                    destination.latitude,
                                  longitude:
                                    destination.longitude,
                                },
                                mode.id
                              );
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.travelModeIcon,
                              selected &&
                                styles.travelModeIconSelected,
                            ]}
                          >
                            {
                              mode.icon
                            }
                          </Text>

                          <Text
                            style={[
                              styles.travelModeText,
                              selected &&
                                styles.travelModeTextSelected,
                            ]}
                          >
                            {
                              mode.shortLabel
                            }
                          </Text>
                        </Pressable>
                      );
                    }
                  )}
                </View>

                {locationEnabled && (
                  <View
                    style={
                      styles.locationBadge
                    }
                  >
                    <View
                      style={
                        styles.locationDot
                      }
                    />

                    <Text
                      style={
                        styles.locationBadgeText
                      }
                    >
                      Location active
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
                      color="#20C997"
                    />

                    <Text
                      style={
                        styles.loadingText
                      }
                    >
                      Finding your location...
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
                      color="#20C997"
                    />

                    <Text
                      style={
                        styles.routeLoadingText
                      }
                    >
                      Finding safer route options...
                    </Text>
                  </View>
                )}

                {routeInfo &&
                  destination &&
                  !routeLoading && (
                    <>
                      <Animated.View
                        pointerEvents={
                          routePanelExpanded
                            ? "auto"
                            : "none"
                        }
                        style={[
                          styles.routeInfoCard,
                          {
                            bottom:
                              routePanelAnimation.interpolate(
                                {
                                  inputRange: [
                                    0,
                                    1,
                                  ],
                                  outputRange: [
                                    178,
                                    expandedRouteBottom,
                                  ],
                                }
                              ),

                            opacity:
                              routePanelAnimation,

                            transform: [
                              {
                                translateY:
                                  routePanelAnimation.interpolate(
                                    {
                                      inputRange:
                                        [
                                          0,
                                          1,
                                        ],
                                      outputRange:
                                        [
                                          28,
                                          0,
                                        ],
                                    }
                                  ),
                              },
                              {
                                scale:
                                  routePanelAnimation.interpolate(
                                    {
                                      inputRange:
                                        [
                                          0,
                                          1,
                                        ],
                                      outputRange:
                                        [
                                          0.97,
                                          1,
                                        ],
                                    }
                                  ),
                              },
                            ],
                          },
                        ]}
                      >
                        <View
                          style={
                            styles.routeInfoTop
                          }
                        >
                          <View
                            style={
                              styles.routeInfoTitleBlock
                            }
                          >
                            <Text
                              style={
                                styles.routeInfoTitle
                              }
                            >
                              Route ready
                            </Text>

                            <Text
                              style={
                                styles.routeInfoDestination
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

                          <View
                            style={
                              styles.routeInfoActions
                            }
                          >
                            <View
                              style={
                                styles.routeReadyBadge
                              }
                            >
                              <Ionicons
                                name="shield-checkmark"
                                size={
                                  15
                                }
                                color="#20C997"
                              />

                              <Text
                                style={
                                  styles.routeReadyText
                                }
                              >
                                {
                                  selectedRouteIndex ===
                                  0
                                    ? "Recommended"
                                    : `Route ${
                                        selectedRouteIndex +
                                        1
                                      }`
                                }
                              </Text>
                            </View>

                            <Pressable
                              style={({ pressed }) => [
                                styles.routeMinimizeButton,
                                pressed &&
                                  styles.buttonPressed,
                              ]}
                              onPress={() =>
                                setRoutePanelExpanded(
                                  false
                                )
                              }
                              accessibilityRole="button"
                              accessibilityLabel="Close alternative routes"
                            >
                              <Ionicons
                                name="chevron-down"
                                size={
                                  18
                                }
                                color="#A9BDD1"
                              />
                            </Pressable>
                          </View>
                        </View>

                        <View
                          style={
                            styles.routeStats
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
                              styles.routeDivider
                            }
                          />

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
                              Estimated
                            </Text>
                          </View>
                        </View>

                        {availableRoutes.length >
                          1 && (
                          <View
                            style={
                              styles.routeOptions
                            }
                          >
                            {availableRoutes.map(
                              (
                                route,
                                index
                              ) => {
                                const selected =
                                  index ===
                                  selectedRouteIndex;

                                const comparison =
                                  index ===
                                  0
                                    ? "Recommended"
                                    : getRouteComparisonLabel(
                                        route,
                                        primaryRoute ??
                                          route
                                      );

                                return (
                                  <Pressable
                                    key={`route-${index}`}
                                    style={({ pressed }) => [
                                      styles.routeOption,
                                      selected &&
                                        styles.routeOptionSelected,
                                      pressed &&
                                        styles.buttonPressed,
                                    ]}
                                    onPress={() =>
                                      handleSelectRoute(
                                        index
                                      )
                                    }
                                  >
                                    <View
                                      style={
                                        styles.routeOptionLeft
                                      }
                                    >
                                      <View
                                        style={[
                                          styles.routeOptionDot,
                                          selected &&
                                            styles.routeOptionDotSelected,
                                        ]}
                                      />

                                      <View>
                                        <Text
                                          style={
                                            styles.routeOptionTitle
                                          }
                                        >
                                          {index ===
                                          0
                                            ? "Main route"
                                            : `Alternative ${index}`}
                                        </Text>

                                        <Text
                                          style={
                                            styles.routeOptionMeta
                                          }
                                        >
                                          {formatDistance(
                                            route.distanceMeters
                                          )}{" "}
                                          •{" "}
                                          {formatDuration(
                                            route.durationSeconds
                                          )}
                                        </Text>
                                      </View>
                                    </View>

                                    <Text
                                      style={[
                                        styles.routeOptionComparison,
                                        selected &&
                                          styles.routeOptionComparisonSelected,
                                      ]}
                                    >
                                      {
                                        comparison
                                      }
                                    </Text>
                                  </Pressable>
                                );
                              }
                            )}
                          </View>
                        )}
                      </Animated.View>

                      {availableRoutes.length >
                        1 &&
                        !routePanelExpanded && (
                        <Pressable
                          style={({ pressed }) => [
                            styles.alternativesHint,
                            pressed &&
                              styles.buttonPressed,
                          ]}
                          onPress={() =>
                            setRoutePanelExpanded(
                              true
                            )
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`${availableRoutes.length - 1} alternative routes available`}
                        >
                          <Ionicons
                            name="git-branch-outline"
                            size={15}
                            color="#20C997"
                          />

                          <Text
                            style={
                              styles.alternativesHintText
                            }
                          >
                            {
                              availableRoutes.length -
                              1
                            }{" "}
                            alternative route
                            {availableRoutes.length -
                              1 >
                            1
                              ? "s"
                              : ""}{" "}
                            available
                          </Text>

                          <Ionicons
                            name="chevron-up"
                            size={14}
                            color="#71899E"
                          />
                        </Pressable>
                      )}
                    </>
                  )}
              </>
            )}

            {navigationActive &&
              navigationPosition && (
                <View
                  style={
                    styles.liveNavigationPill
                  }
                >
                  <View
                    style={
                      styles.liveNavigationDot
                    }
                  />

                  <Text
                    style={
                      styles.liveNavigationText
                    }
                  >
                    LIVE
                  </Text>
                </View>
              )}

            {destination &&
              !navigationActive &&
              routeInfo && (
                <View
                  style={
                    styles.destinationActions
                  }
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.clearDestinationButton,
                      pressed &&
                        styles.buttonPressed,
                    ]}
                    onPress={
                      clearDestination
                    }
                  >
                    <Ionicons
                      name="close"
                      size={18}
                      color="#A9BDD1"
                    />

                    <Text
                      style={
                        styles.clearDestinationText
                      }
                    >
                      Clear
                    </Text>
                  </Pressable>
                </View>
              )}

            <NavigationPanel
              active={
                navigationActive
              }
              arrived={arrived}
              recalculating={
                recalculating
              }
              currentStep={
                currentStep
              }
              nextStep={
                nextStep
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
                stopNavigation
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
                  (previous) =>
                    !previous
                )
              }
              onHeightChange={
                setNavigationPanelHeight
              }
            />
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    outerScreen: {
      flex: 1,
      backgroundColor: "#000000",
      alignItems: "center",
      justifyContent: "center",
    },

    appFrame: {
      width: "100%",
      height: "100%",
      backgroundColor: "#07111F",
      overflow: "hidden",
    },

    safeArea: {
      flex: 1,
      backgroundColor: "#07111F",
    },

    header: {
      height: 62,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      backgroundColor: "#07111F",
      borderBottomWidth: 1,
      borderBottomColor: "#10283B",
      zIndex: 50,
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius: 15,
      backgroundColor: "#0C1D2E",
      borderWidth: 1,
      borderColor: "#21415B",
      alignItems: "center",
      justifyContent: "center",
    },

    headerText: {
      flex: 1,
      marginLeft: 12,
    },

    headerTitle: {
      color: "#FFFFFF",
      fontSize: 19,
      fontWeight: "800",
      letterSpacing: -0.3,
    },

    headerSubtitle: {
      color: "#71889C",
      fontSize: 11,
      marginTop: 2,
      fontWeight: "600",
    },

    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    headerLocationButton: {
      width: 42,
      height: 42,
      borderRadius: 15,
      backgroundColor: "#0C1D2E",
      borderWidth: 1,
      borderColor: "#21415B",
      alignItems: "center",
      justifyContent: "center",
    },

    headerCompactButton: {
      width: 42,
      height: 42,
      borderRadius: 15,
      backgroundColor: "#0C1D2E",
      borderWidth: 1,
      borderColor: "#21415B",
      alignItems: "center",
      justifyContent: "center",
    },

    headerCompactButtonActive: {
      backgroundColor: "#123D38",
      borderColor: "#20C997",
    },

    mapContainer: {
      flex: 1,
      position: "relative",
    },

    searchContainer: {
      position: "absolute",
      left: 14,
      right: 14,
      top: 10,
      zIndex: 40,
      elevation: 20,
    },

    travelModeContainer: {
      position: "absolute",
      left: 14,
      right: 14,
      top: 78,
      height: 48,
      borderRadius: 16,
      backgroundColor:
        "rgba(7,17,31,0.94)",
      borderWidth: 1,
      borderColor: "#21415B",
      flexDirection: "row",
      padding: 4,
      zIndex: 25,
      elevation: 12,
    },

    travelModeButton: {
      flex: 1,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 5,
    },

    travelModeButtonSelected: {
      backgroundColor: "#123D38",
      borderWidth: 1,
      borderColor: "#20C997",
    },

    travelModeIcon: {
      fontSize: 16,
      opacity: 0.75,
    },

    travelModeIconSelected: {
      opacity: 1,
    },

    travelModeText: {
      color: "#8197A9",
      fontSize: 12,
      fontWeight: "700",
    },

    travelModeTextSelected: {
      color: "#20C997",
    },

    locationBadge: {
      position: "absolute",
      top: 138,
      left: 14,
      height: 32,
      paddingHorizontal: 11,
      borderRadius: 12,
      backgroundColor:
        "rgba(7,17,31,0.88)",
      borderWidth: 1,
      borderColor: "#21415B",
      flexDirection: "row",
      alignItems: "center",
      zIndex: 15,
      elevation: 8,
    },

    locationDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: "#20C997",
      marginRight: 7,
    },

    locationBadgeText: {
      color: "#A9BDD1",
      fontSize: 11,
      fontWeight: "700",
    },

    loadingCard: {
      position: "absolute",
      left: 14,
      right: 14,
      bottom: 178,
      height: 50,
      borderRadius: 16,
      backgroundColor:
        "rgba(12,29,46,0.96)",
      borderWidth: 1,
      borderColor: "#21415B",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      zIndex: 25,
      elevation: 10,
    },

    loadingText: {
      color: "#A9BDD1",
      fontSize: 13,
      fontWeight: "600",
    },

    routeLoadingCard: {
      position: "absolute",
      left: 14,
      right: 14,
      bottom: 180,
      minHeight: 54,
      borderRadius: 17,
      backgroundColor:
        "rgba(12,29,46,0.97)",
      borderWidth: 1,
      borderColor: "#21415B",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      zIndex: 30,
      elevation: 12,
    },

    routeLoadingText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },

    routeInfoCard: {
      position: "absolute",
      left: 14,
      right: 14,
      maxHeight: 290,
      borderRadius: 20,
      backgroundColor:
        "rgba(12,29,46,0.97)",
      borderWidth: 1,
      borderColor: "#21415B",
      padding: 16,
      zIndex: 35,
      elevation: 15,
    },

    routeInfoTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    routeInfoTitleBlock: {
      flex: 1,
      marginRight: 10,
    },

    routeInfoActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },

    routeMinimizeButton: {
      width: 30,
      height: 30,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#10283B",
      borderWidth: 1,
      borderColor: "#21415B",
    },

    routeInfoTitle: {
      color: "#20C997",
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.7,
    },

    routeInfoDestination: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "800",
      marginTop: 3,
      maxWidth: 235,
    },

    routeReadyBadge: {
      height: 30,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: "#123D38",
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },

    routeReadyText: {
      color: "#20C997",
      fontSize: 11,
      fontWeight: "800",
    },

    routeStats: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 15,
    },

    routeStat: {
      flex: 1,
    },

    routeStatValue: {
      color: "#FFFFFF",
      fontSize: 17,
      fontWeight: "800",
    },

    routeStatLabel: {
      color: "#71899E",
      fontSize: 10,
      marginTop: 3,
      fontWeight: "600",
    },

    routeDivider: {
      width: 1,
      height: 31,
      backgroundColor: "#21415B",
      marginHorizontal: 14,
    },

    routeOptions: {
      marginTop: 14,
      gap: 7,
    },

    routeOption: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: "#0C1D2E",
      borderWidth: 1,
      borderColor: "#18344A",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 11,
      paddingVertical: 8,
    },

    routeOptionSelected: {
      backgroundColor: "#123D38",
      borderColor: "#20C997",
    },

    routeOptionLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },

    routeOptionDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: "#587086",
      marginRight: 10,
    },

    routeOptionDotSelected: {
      backgroundColor: "#20C997",
    },

    routeOptionTitle: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
    },

    routeOptionMeta: {
      color: "#71899E",
      fontSize: 10,
      fontWeight: "600",
      marginTop: 2,
    },

    routeOptionComparison: {
      color: "#8FA5B7",
      fontSize: 10,
      fontWeight: "800",
      marginLeft: 8,
    },

    routeOptionComparisonSelected: {
      color: "#20C997",
    },

    alternativesHint: {
      position: "absolute",
      left: 14,
      bottom: 306,
      height: 36,
      paddingHorizontal: 11,
      borderRadius: 12,
      backgroundColor:
        "rgba(7,17,31,0.94)",
      borderWidth: 1,
      borderColor: "#21415B",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      zIndex: 34,
      elevation: 12,
    },

    alternativesHintText: {
      color: "#A9BDD1",
      fontSize: 10,
      fontWeight: "800",
    },

    liveNavigationPill: {
      position: "absolute",
      top: 14,
      left: 14,
      height: 42,
      width: 67,
      paddingHorizontal: 13,
      borderRadius: 15,
      backgroundColor:
        "rgba(7,17,31,0.94)",
      borderWidth: 1,
      borderColor: "#20C997",
      flexDirection: "row",
      alignItems: "center",
      zIndex: 30,
      elevation: 12,
    },

    liveNavigationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#20C997",
      marginRight: 7,
    },

    liveNavigationText: {
      color: "#20C997",
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0.7,
    },

    destinationActions: {
      position: "absolute",
      right: 14,
      bottom: 278,
      zIndex: 20,
    },

    clearDestinationButton: {
      bottom: 27,
      height: 38,
      paddingHorizontal: 12,
      borderRadius: 13,
      backgroundColor:
        "rgba(12,29,46,0.94)",
      borderWidth: 1,
      borderColor: "#21415B",
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },

    clearDestinationText: {
      color: "#A9BDD1",
      fontSize: 11,
      fontWeight: "700",
    },

    buttonPressed: {
      opacity: 0.65,
      transform: [
        {
          scale: 0.97,
        },
      ],
    },
  });