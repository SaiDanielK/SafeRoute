
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import MapView, {
  Marker,
  Polyline,
  Region,
} from "react-native-maps";

import { Ionicons } from "@expo/vector-icons";

import {
  TrafficRouteSegment,
} from "../services/trafficService";

import {
  getRecentHazards,
  CommunityHazard,
} from "../services/hazardService";

type Destination = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

type LivePosition = {
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
};

export type NavigationPreviewStep = {
  instruction: string;
  distanceMeters: number;
  coordinate: RouteCoordinate | null;
};

type SafeRouteMapProps = {
  region: Region | null;
  speedLimit?: number | null;
  destination?: Destination | null;
  routeCoordinates?: RouteCoordinate[];
  alternativeRoutes?: RouteCoordinate[][];
  selectedRouteIndex?: number;
  onSelectRoute?: (index: number) => void;
  navigationActive?: boolean;
  livePosition?: LivePosition | null;
  navigationNightMode?: boolean;
  followUser?: boolean;
  onFollowUserChange?: (following: boolean) => void;
  threeDEnabled?: boolean;
  onToggle3D?: () => void;
  onUseDroppedPin?: (coordinate: RouteCoordinate) => void;
  onPinPlaced?: () => void;
  trafficSegments?: TrafficRouteSegment[];

  // Upcoming-turn preview support.
  previewSteps?: NavigationPreviewStep[];
  activeStepIndex?: number;
  previewStepIndex?: number | null;
  onPreviewStepChange?: (index: number | null) => void;
};

type HazardStyle = {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

const HAZARD_STYLES: Record<string, HazardStyle> = {
  accident: {
    color: "#EF4444",
    icon: "car-sport",
    label: "Accident",
  },
  road_closed: {
    color: "#DC2626",
    icon: "ban",
    label: "Road closed",
  },
  construction: {
    color: "#F59E0B",
    icon: "construct",
    label: "Construction",
  },
  unsafe_area: {
    color: "#A855F7",
    icon: "warning",
    label: "Unsafe area",
  },
  flooding: {
    color: "#0EA5E9",
    icon: "water",
    label: "Flooding",
  },
  debris: {
    color: "#F97316",
    icon: "alert-circle",
    label: "Road debris",
  },
  traffic: {
    color: "#EAB308",
    icon: "car",
    label: "Traffic",
  },
  other: {
    color: "#64748B",
    icon: "alert-circle",
    label: "Other hazard",
  },
};

const HAZARD_ROUTE_WARNING_METERS = 150;

function getHazardStyle(type: string): HazardStyle {
  return HAZARD_STYLES[type] ?? HAZARD_STYLES.other;
}

function metersPerSecondToMph(
  speed: number | null | undefined
): number {
  if (
    typeof speed !== "number" ||
    !Number.isFinite(speed) ||
    speed < 0
  ) {
    return 0;
  }

  return speed * 2.236936;
}

function formatSpeed(
  speed: number | null | undefined
): string {
  return `${Math.round(metersPerSecondToMph(speed))} mph`;
}

function formatSpeedLimit(
  speedLimit: number | null | undefined
): string {
  if (
    typeof speedLimit !== "number" ||
    !Number.isFinite(speedLimit) ||
    speedLimit <= 0
  ) {
    return "-- mph";
  }

  return `${Math.round(speedLimit)} mph`;
}

function distanceInMeters(
  first: RouteCoordinate,
  second: RouteCoordinate
): number {
  const earthRadius = 6371000;
  const radians = Math.PI / 180;

  const lat1 = first.latitude * radians;
  const lat2 = second.latitude * radians;

  const latitudeDifference =
    (second.latitude - first.latitude) * radians;

  const longitudeDifference =
    (second.longitude - first.longitude) * radians;

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(longitudeDifference / 2) ** 2;

  return (
    earthRadius *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(Math.max(0, 1 - a))
    )
  );
}

function getBearing(
  start: RouteCoordinate,
  end: RouteCoordinate
): number {
  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180;

  const toDegrees = (radians: number) =>
    (radians * 180) / Math.PI;

  const latitude1 = toRadians(start.latitude);
  const latitude2 = toRadians(end.latitude);

  const longitudeDifference = toRadians(
    end.longitude - start.longitude
  );

  const y =
    Math.sin(longitudeDifference) *
    Math.cos(latitude2);

  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) *
      Math.cos(latitude2) *
      Math.cos(longitudeDifference);

  return (
    (toDegrees(Math.atan2(y, x)) + 360) % 360
  );
}

function pointToSegmentDistanceMeters(
  point: RouteCoordinate,
  start: RouteCoordinate,
  end: RouteCoordinate
): number {
  const latitudeScale = Math.cos(
    (point.latitude * Math.PI) / 180
  );

  const startX =
    (start.longitude - point.longitude) *
    latitudeScale *
    111320;

  const startY =
    (start.latitude - point.latitude) * 111320;

  const endX =
    (end.longitude - point.longitude) *
    latitudeScale *
    111320;

  const endY =
    (end.latitude - point.latitude) * 111320;

  const dx = endX - startX;
  const dy = endY - startY;

  const segmentLengthSquared = dx * dx + dy * dy;

  if (segmentLengthSquared === 0) {
    return Math.sqrt(startX * startX + startY * startY);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      -(startX * dx + startY * dy) /
        segmentLengthSquared
    )
  );

  const projectionX = startX + t * dx;
  const projectionY = startY + t * dy;

  return Math.sqrt(
    projectionX * projectionX +
      projectionY * projectionY
  );
}

function distanceFromPointToRouteMeters(
  point: RouteCoordinate,
  route: RouteCoordinate[]
): number {
  if (route.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (route.length === 1) {
    return distanceInMeters(point, route[0]);
  }

  let minimumDistance = Number.POSITIVE_INFINITY;

  for (
    let index = 0;
    index < route.length - 1;
    index += 1
  ) {
    const distance = pointToSegmentDistanceMeters(
      point,
      route[index],
      route[index + 1]
    );

    if (distance < minimumDistance) {
      minimumDistance = distance;
    }
  }

  return minimumDistance;
}

type RouteHit = {
  index: number;
  distance: number;
};

function findTappedRoutes(
  coordinate: RouteCoordinate,
  routes: RouteCoordinate[][]
): RouteHit[] {
  const TAP_TOLERANCE_DEGREES = 0.00065;
  const routeHits: RouteHit[] = [];

  routes.forEach((route, routeIndex) => {
    if (route.length < 2) {
      return;
    }

    const distance = distanceFromPointToRouteMeters(
      coordinate,
      route
    );

    if (distance > TAP_TOLERANCE_DEGREES * 111320) {
      return;
    }

    routeHits.push({
      index: routeIndex,
      distance,
    });
  });

  if (routeHits.length === 0) {
    return [];
  }

  routeHits.sort((a, b) => a.distance - b.distance);

  const closestDistance =
    routeHits[0]?.distance ?? Number.POSITIVE_INFINITY;

  return routeHits.filter(
    (hit) => hit.distance <= closestDistance + 4
  );
}

function getTrafficColor(
  color: TrafficRouteSegment["color"]
): string {
  switch (color) {
    case "yellow":
      return "#F5B700";
    case "red":
      return "#EF4444";
    case "blue":
    default:
      return "#007AFF";
  }
}

function getHazardRouteDistance(
  hazard: CommunityHazard,
  route: RouteCoordinate[]
): number {
  return distanceFromPointToRouteMeters(
    {
      latitude: hazard.latitude,
      longitude: hazard.longitude,
    },
    route
  );
}

export default function SafeRouteMap({
  region,
  speedLimit = null,
  destination,
  routeCoordinates = [],
  alternativeRoutes = [],
  selectedRouteIndex = 0,
  onSelectRoute,
  navigationActive = false,
  livePosition = null,
  navigationNightMode = false,
  followUser = true,
  onFollowUserChange,
  threeDEnabled = false,
  onToggle3D,
  onUseDroppedPin,
  onPinPlaced,
  trafficSegments = [],
  previewSteps = [],
  activeStepIndex = 0,
  previewStepIndex = null,
  onPreviewStepChange,
}: SafeRouteMapProps) {
  const mapRef = useRef<MapView>(null);
  const hasCenteredInitiallyRef = useRef(false);
  const previousNavigationActiveRef = useRef(false);
  const hazardLoadInProgressRef = useRef(false);

  const isPreviewingTurn =
    navigationActive &&
    previewStepIndex !== null &&
    previewStepIndex !== activeStepIndex;

  const [droppedPin, setDroppedPin] =
    useState<RouteCoordinate | null>(null);

  const [pinMode, setPinMode] = useState(false);

  const [coordinateModalVisible, setCoordinateModalVisible] =
    useState(false);

  const [coordinateInput, setCoordinateInput] = useState("");

  const [satelliteMode, setSatelliteMode] = useState(false);

  const [communityHazards, setCommunityHazards] =
    useState<CommunityHazard[]>([]);

  const [selectedHazard, setSelectedHazard] =
    useState<CommunityHazard | null>(null);

  const [hazardsLoading, setHazardsLoading] = useState(true);

  const [hazardsError, setHazardsError] = useState(false);

  const NAVIGATION_ZOOM = 19.5;
  const NAVIGATION_LATITUDE_DELTA = 0.002;
  const NAVIGATION_LONGITUDE_DELTA = 0.002;
  const NORMAL_ZOOM = 15;

  const defaultRegion: Region = {
    latitude: 34.0522,
    longitude: -118.2437,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const mapRegion = region ?? defaultRegion;

  const loadCommunityHazards = useCallback(
    async (showError = false) => {
      if (hazardLoadInProgressRef.current) {
        return;
      }

      hazardLoadInProgressRef.current = true;

      try {
        const hazards = await getRecentHazards(50);

        const validHazards = hazards.filter(
          (hazard) =>
            Number.isFinite(hazard.latitude) &&
            Number.isFinite(hazard.longitude) &&
            hazard.latitude >= -90 &&
            hazard.latitude <= 90 &&
            hazard.longitude >= -180 &&
            hazard.longitude <= 180
        );

        setCommunityHazards(validHazards);
        setHazardsError(false);
      } catch (error) {
        console.warn(
          "SafeRoute could not load community hazards:",
          error
        );

        setHazardsError(true);

        if (showError) {
          Alert.alert(
            "Reports unavailable",
            "SafeRoute couldn't refresh community hazard reports. Please try again."
          );
        }
      } finally {
        hazardLoadInProgressRef.current = false;
        setHazardsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadCommunityHazards();
  }, [loadCommunityHazards]);

  const hazardsNearSelectedRoute = communityHazards.filter(
    (hazard) =>
      routeCoordinates.length > 1 &&
      getHazardRouteDistance(hazard, routeCoordinates) <=
        HAZARD_ROUTE_WARNING_METERS
  );

  const hasRouteHazardWarning =
    hazardsNearSelectedRoute.length > 0;

  const getHeading = useCallback(() => {
    if (
      typeof livePosition?.heading === "number" &&
      livePosition.heading >= 0
    ) {
      return livePosition.heading;
    }

    return 0;
  }, [livePosition?.heading]);

  const getCameraPosition = useCallback(() => {
    if (livePosition) {
      return {
        latitude: livePosition.latitude,
        longitude: livePosition.longitude,
      };
    }

    if (region) {
      return {
        latitude: region.latitude,
        longitude: region.longitude,
      };
    }

    return null;
  }, [livePosition, region]);

  useEffect(() => {
    if (
      !mapRef.current ||
      !region ||
      hasCenteredInitiallyRef.current
    ) {
      return;
    }

    hasCenteredInitiallyRef.current = true;

    mapRef.current.animateCamera(
      {
        center: {
          latitude: region.latitude,
          longitude: region.longitude,
        },
        zoom: NORMAL_ZOOM,
        pitch: threeDEnabled ? 45 : 0,
        heading: 0,
      },
      { duration: 500 }
    );
  }, [region, threeDEnabled]);

  useEffect(() => {
    if (
      !mapRef.current ||
      !region ||
      !destination ||
      navigationActive
    ) {
      return;
    }

    mapRef.current.fitToCoordinates(
      [
        {
          latitude: region.latitude,
          longitude: region.longitude,
        },
        {
          latitude: destination.latitude,
          longitude: destination.longitude,
        },
      ],
      {
        edgePadding: {
          top: 230,
          right: 60,
          bottom: 330,
          left: 60,
        },
        animated: true,
      }
    );

    if (threeDEnabled) {
      const timeout = setTimeout(() => {
        mapRef.current?.animateCamera(
          { pitch: 45 },
          { duration: 350 }
        );
      }, 450);

      return () => clearTimeout(timeout);
    }
  }, [region, destination, navigationActive, threeDEnabled]);

  useEffect(() => {
    if (!navigationActive) {
      previousNavigationActiveRef.current = false;
      return;
    }

    if (
      !mapRef.current ||
      !livePosition ||
      previousNavigationActiveRef.current
    ) {
      return;
    }

    previousNavigationActiveRef.current = true;

    mapRef.current.animateToRegion(
      {
        latitude: livePosition.latitude,
        longitude: livePosition.longitude,
        latitudeDelta: NAVIGATION_LATITUDE_DELTA,
        longitudeDelta: NAVIGATION_LONGITUDE_DELTA,
      },
      1000
    );

    const timeout = setTimeout(() => {
      if (!mapRef.current) {
        return;
      }

      mapRef.current.animateCamera(
        {
          center: {
            latitude: livePosition.latitude,
            longitude: livePosition.longitude,
          },
          zoom: NAVIGATION_ZOOM,
          heading: getHeading(),
          pitch: threeDEnabled ? 45 : 0,
        },
        { duration: 400 }
      );
    }, 1000);

    return () => clearTimeout(timeout);
  }, [
    navigationActive,
    livePosition?.latitude,
    livePosition?.longitude,
    threeDEnabled,
    getHeading,
  ]);

  // Keep GPS tracking active, but pause camera-follow while a
  // different navigation step is being previewed.
  useEffect(() => {
    if (
      !mapRef.current ||
      !navigationActive ||
      !followUser ||
      !livePosition ||
      isPreviewingTurn
    ) {
      return;
    }

    mapRef.current.animateToRegion(
      {
        latitude: livePosition.latitude,
        longitude: livePosition.longitude,
        latitudeDelta: NAVIGATION_LATITUDE_DELTA,
        longitudeDelta: NAVIGATION_LONGITUDE_DELTA,
      },
      450
    );

    const timeout = setTimeout(() => {
      if (
        !mapRef.current ||
        !navigationActive ||
        !followUser ||
        !livePosition
      ) {
        return;
      }

      mapRef.current.animateCamera(
        {
          center: {
            latitude: livePosition.latitude,
            longitude: livePosition.longitude,
          },
          zoom: NAVIGATION_ZOOM,
          heading: getHeading(),
          pitch: threeDEnabled ? 45 : 0,
        },
        { duration: 250 }
      );
    }, 450);

    return () => clearTimeout(timeout);
  }, [
    navigationActive,
    followUser,
    livePosition?.latitude,
    livePosition?.longitude,
    livePosition?.heading,
    threeDEnabled,
    isPreviewingTurn,
    getHeading,
  ]);

  // Preserve the current preview center when the user toggles 3D.
  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    if (isPreviewingTurn) {
      mapRef.current.animateCamera(
        { pitch: threeDEnabled ? 45 : 0 },
        { duration: 300 }
      );
      return;
    }

    const position = getCameraPosition();

    if (!position) {
      return;
    }

    mapRef.current.animateCamera(
      {
        center: position,
        zoom: navigationActive ? NAVIGATION_ZOOM : NORMAL_ZOOM,
        heading: navigationActive ? getHeading() : 0,
        pitch: threeDEnabled ? 45 : 0,
      },
      { duration: 500 }
    );
  }, [
    threeDEnabled,
    isPreviewingTurn,
    navigationActive,
    getCameraPosition,
    getHeading,
  ]);

  // Preview a maneuver by moving and rotating the camera toward
  // the next route segment. This does not alter live navigation.
  useEffect(() => {
    if (
      !navigationActive ||
      previewStepIndex === null ||
      previewStepIndex === activeStepIndex ||
      !mapRef.current
    ) {
      return;
    }

    const previewStep = previewSteps[previewStepIndex];
    const nextStep = previewSteps[previewStepIndex + 1];
    const previousStep = previewSteps[previewStepIndex - 1];

    if (
      !previewStep?.coordinate ||
      !Number.isFinite(previewStep.coordinate.latitude) ||
      !Number.isFinite(previewStep.coordinate.longitude)
    ) {
      return;
    }

    let heading = getHeading();

    // Prefer facing the next maneuver.
    if (
      nextStep?.coordinate &&
      distanceInMeters(
        previewStep.coordinate,
        nextStep.coordinate
      ) > 5
    ) {
      heading = getBearing(
        previewStep.coordinate,
        nextStep.coordinate
      );
    } else if (
      previousStep?.coordinate &&
      distanceInMeters(
        previousStep.coordinate,
        previewStep.coordinate
      ) > 5
    ) {
      heading = getBearing(
        previousStep.coordinate,
        previewStep.coordinate
      );
    }

    mapRef.current.animateCamera(
      {
        center: previewStep.coordinate,
        zoom: NAVIGATION_ZOOM,
        pitch: threeDEnabled ? 45 : 0,
        heading,
      },
      { duration: 650 }
    );
  }, [
    navigationActive,
    previewStepIndex,
    activeStepIndex,
    previewSteps,
    threeDEnabled,
    getHeading,
  ]);

  // Place a pin on the map.
  function placePin(latitude: number, longitude: number) {
    const coordinate = { latitude, longitude };

    setDroppedPin(coordinate);
    setPinMode(false);
    onPinPlaced?.();

    mapRef.current?.animateCamera(
      {
        center: coordinate,
        zoom: NORMAL_ZOOM,
      },
      { duration: 500 }
    );
  }

  function handleMapPress(event: any) {
    const coordinate = event.nativeEvent.coordinate;

    if (
      typeof coordinate?.latitude !== "number" ||
      typeof coordinate?.longitude !== "number"
    ) {
      return;
    }

    if (pinMode && !navigationActive) {
      placePin(coordinate.latitude, coordinate.longitude);
      return;
    }

    if (!navigationActive && alternativeRoutes.length > 0) {
      const tappedRoutes = findTappedRoutes(
        {
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
        },
        alternativeRoutes
      );

      if (tappedRoutes.length > 0) {
        const selectedPosition = tappedRoutes.findIndex(
          (route) => route.index === selectedRouteIndex
        );

        const nextPosition =
          selectedPosition < 0
            ? 0
            : (selectedPosition + 1) % tappedRoutes.length;

        const tappedRoute = tappedRoutes[nextPosition];

        if (tappedRoute) {
          onSelectRoute?.(tappedRoute.index);
        }
      }
    }
  }

  function openCoordinateEntry() {
    if (droppedPin) {
      setCoordinateInput(
        `${droppedPin.latitude}, ${droppedPin.longitude}`
      );
    } else {
      setCoordinateInput("");
    }

    setCoordinateModalVisible(true);
  }

  function submitCoordinates() {
    const coordinateParts = coordinateInput
      .trim()
      .replace(/[()]/g, "")
      .split(/[\s,]+/)
      .filter(Boolean);

    if (coordinateParts.length !== 2) {
      Alert.alert(
        "Enter two coordinates",
        "Paste or enter latitude and longitude, separated by a comma."
      );
      return;
    }

    const latitude = Number(coordinateParts[0]);
    const longitude = Number(coordinateParts[1]);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      Alert.alert(
        "Invalid coordinates",
        "Please enter valid numbers for latitude and longitude."
      );
      return;
    }

    if (latitude < -90 || latitude > 90) {
      Alert.alert(
        "Invalid latitude",
        "Latitude must be between -90 and 90."
      );
      return;
    }

    if (longitude < -180 || longitude > 180) {
      Alert.alert(
        "Invalid longitude",
        "Longitude must be between -180 and 180."
      );
      return;
    }

    setCoordinateModalVisible(false);
    placePin(latitude, longitude);
  }

  function removeDroppedPin() {
    setDroppedPin(null);
    setPinMode(false);
  }

  function useDroppedPin() {
    if (!droppedPin) {
      return;
    }

    onUseDroppedPin?.(droppedPin);
    setDroppedPin(null);
  }

  function recenterMap() {
    // Clear the turn preview before recentering.
    if (previewStepIndex !== null) {
      onPreviewStepChange?.(null);
    }

    onFollowUserChange?.(true);

    const position = getCameraPosition();

    if (!position || !mapRef.current) {
      return;
    }

    if (navigationActive) {
      mapRef.current.animateToRegion(
        {
          latitude: position.latitude,
          longitude: position.longitude,
          latitudeDelta: NAVIGATION_LATITUDE_DELTA,
          longitudeDelta: NAVIGATION_LONGITUDE_DELTA,
        },
        600
      );

      setTimeout(() => {
        mapRef.current?.animateCamera(
          {
            center: position,
            zoom: NAVIGATION_ZOOM,
            heading: getHeading(),
            pitch: threeDEnabled ? 45 : 0,
          },
          { duration: 300 }
        );
      }, 600);

      return;
    }

    mapRef.current.animateCamera(
      {
        center: position,
        zoom: NORMAL_ZOOM,
        heading: 0,
        pitch: threeDEnabled ? 45 : 0,
      },
      { duration: 600 }
    );
  }

  function handleMapPan() {
    if (followUser) {
      onFollowUserChange?.(false);
    }
  }

  function toggleSatellite() {
    setSatelliteMode((current) => !current);
  }

  function showHazardDetails(hazard: CommunityHazard) {
    setSelectedHazard(hazard);
  }

  const selectedHazardStyle = selectedHazard
    ? getHazardStyle(selectedHazard.type)
    : null;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        mapType={satelliteMode ? "satellite" : "standard"}
        userInterfaceStyle={navigationNightMode ? "dark" : "light"}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        showsBuildings={threeDEnabled}
        showsPointsOfInterests={true}
        showsTraffic={false}
        rotateEnabled={true}
        pitchEnabled={true}
        zoomEnabled={true}
        scrollEnabled={true}
        toolbarEnabled={false}
        loadingEnabled={true}
        loadingBackgroundColor={
          navigationNightMode ? "#02060B" : "#FFFFFF"
        }
        loadingIndicatorColor="#20C997"
        onPanDrag={handleMapPan}
        onPress={handleMapPress}
      >
        {!navigationActive &&
          alternativeRoutes.map((coordinates, routeIndex) => {
            if (routeIndex === selectedRouteIndex) {
              return null;
            }

            return (
              <Polyline
                key={`route-${routeIndex}`}
                coordinates={coordinates}
                strokeWidth={5}
                strokeColor="#7B91A4"
                lineCap="round"
                lineJoin="round"
                tappable={false}
                zIndex={1}
              />
            );
          })}

        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={navigationActive ? 8 : 7}
            strokeColor="#2563eb"
            lineCap="round"
            lineJoin="round"
            tappable={false}
            zIndex={9}
          />
        )}

        {navigationActive &&
          trafficSegments.length > 0 &&
          trafficSegments.map((segment, index) => {
            if (segment.coordinates.length < 2) {
              return null;
            }

            return (
              <Polyline
                key={`traffic-${index}`}
                coordinates={segment.coordinates}
                strokeWidth={7}
                strokeColor={getTrafficColor(segment.color)}
                lineCap="round"
                lineJoin="round"
                tappable={false}
                zIndex={10}
              />
            );
          })}

        {region && !navigationActive && (
          <Marker
            coordinate={{
              latitude: region.latitude,
              longitude: region.longitude,
            }}
            title="You are here"
            description="Your current location"
            pinColor="#007AFF"
          />
        )}

        {navigationActive && livePosition && (
          <Marker
            coordinate={{
              latitude: livePosition.latitude,
              longitude: livePosition.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            tracksViewChanges={false}
            rotation={getHeading()}
          >
            <View style={styles.liveMarker}>
              <View style={styles.liveMarkerOuter}>
                <View style={styles.liveMarkerInner} />
              </View>
              <View style={styles.liveMarkerArrow} />
            </View>
          </Marker>
        )}

        {destination && (
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            title={destination.name}
            description="Your destination"
            pinColor="#20C997"
          />
        )}

        {communityHazards.map((hazard) => {
          const hazardStyle = getHazardStyle(hazard.type);

          return (
            <Marker
              key={`community-hazard-${hazard.id}`}
              coordinate={{
                latitude: hazard.latitude,
                longitude: hazard.longitude,
              }}
              title={hazard.title}
              description={hazard.description}
              onPress={() => showHazardDetails(hazard)}
              tracksViewChanges={false}
              zIndex={12}
            >
              <View
                style={[
                  styles.hazardMarker,
                  { backgroundColor: hazardStyle.color },
                ]}
              >
                <Ionicons
                  name={hazardStyle.icon}
                  size={17}
                  color="#FFFFFF"
                />
              </View>
            </Marker>
          );
        })}

        {droppedPin && (
          <Marker
            coordinate={droppedPin}
            title="Dropped Pin"
            description={`${droppedPin.latitude.toFixed(
              6
            )}, ${droppedPin.longitude.toFixed(6)}`}
            pinColor="#FFB020"
          />
        )}
      </MapView>

      {isPreviewingTurn && (
        <View style={styles.turnPreviewBadge}>
          <Ionicons
            name="eye-outline"
            size={15}
            color="#A7F3D0"
          />
          <Text style={styles.turnPreviewBadgeText}>
            TURN PREVIEW
          </Text>
        </View>
      )}

      {hasRouteHazardWarning && !navigationActive && (
        <View style={styles.routeHazardWarning}>
          <Ionicons
            name="warning"
            size={20}
            color="#FBBF24"
          />

          <View style={styles.routeHazardWarningText}>
            <Text style={styles.routeHazardWarningTitle}>
              Community hazards near this route
            </Text>

            <Text style={styles.routeHazardWarningSubtitle}>
              {hazardsNearSelectedRoute.length} reported{" "}
              {hazardsNearSelectedRoute.length === 1
                ? "hazard"
                : "hazards"}{" "}
              within {HAZARD_ROUTE_WARNING_METERS} m
            </Text>
          </View>
        </View>
      )}

      {selectedHazard && selectedHazardStyle && (
        <View style={styles.hazardDetailsCard}>
          <View style={styles.hazardDetailsHeader}>
            <View
              style={[
                styles.hazardDetailsIcon,
                {
                  backgroundColor: selectedHazardStyle.color,
                },
              ]}
            >
              <Ionicons
                name={selectedHazardStyle.icon}
                size={21}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.hazardDetailsText}>
              <Text style={styles.hazardDetailsEyebrow}>
                COMMUNITY REPORT
              </Text>

              <Text style={styles.hazardDetailsTitle}>
                {selectedHazard.title}
              </Text>

              <Text style={styles.hazardDetailsType}>
                {selectedHazardStyle.label}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close hazard details"
              onPress={() => setSelectedHazard(null)}
              style={styles.hazardCloseButton}
            >
              <Ionicons
                name="close"
                size={21}
                color="#CBD5E1"
              />
            </Pressable>
          </View>

          <Text style={styles.hazardDetailsDescription}>
            {selectedHazard.description?.trim() ||
              "No additional description was provided."}
          </Text>

          <Text style={styles.hazardDetailsCoordinates}>
            {selectedHazard.latitude.toFixed(5)},{" "}
            {selectedHazard.longitude.toFixed(5)}
          </Text>

          <Text style={styles.hazardDisclaimer}>
            Community-reported information may be incomplete or outdated.
          </Text>
        </View>
      )}

      {hazardsError && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void loadCommunityHazards(true)}
          style={styles.hazardRefreshError}
        >
          <Ionicons
            name="cloud-offline-outline"
            size={17}
            color="#FBBF24"
          />

          <Text style={styles.hazardRefreshErrorText}>
            Couldn't load reports. Tap to retry.
          </Text>
        </Pressable>
      )}

      {!hazardsError && !hazardsLoading && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh community hazard reports"
          onPress={() => void loadCommunityHazards(true)}
          style={[
            styles.hazardRefreshButton,
            navigationActive && styles.hazardRefreshButtonNavigation,
          ]}
        >
          <Ionicons
            name="refresh"
            size={16}
            color="#DCE8F2"
          />
          <Text style={styles.hazardRefreshText}>
            {communityHazards.length} reports
          </Text>
        </Pressable>
      )}

      {pinMode && (
        <View style={styles.pinModeBanner}>
          <View style={styles.pinModeBannerContent}>
            <Ionicons
              name="location"
              size={18}
              color="#1A73E8"
            />

            <Text style={styles.pinModeText}>
              Tap anywhere to drop a pin
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enter coordinates"
            style={({ pressed }) => [
              styles.pinModeCoordinateButton,
              pressed && styles.mapControlPressed,
            ]}
            onPress={openCoordinateEntry}
          >
            <Ionicons
              name="keypad-outline"
              size={16}
              color="#20C997"
            />

            <Text style={styles.pinModeCoordinateText}>
              Coordinates
            </Text>
          </Pressable>
        </View>
      )}

      {droppedPin && !pinMode && (
        <View style={styles.droppedPinCard}>
          <View style={styles.droppedPinHeader}>
            <View style={styles.droppedPinIcon}>
              <Ionicons
                name="location"
                size={18}
                color="#FFB020"
              />
            </View>

            <View style={styles.droppedPinTitleContainer}>
              <Text style={styles.droppedPinTitle}>
                Dropped Pin
              </Text>

              <Text style={styles.droppedPinCoordinates}>
                {droppedPin.latitude.toFixed(6)},{" "}
                {droppedPin.longitude.toFixed(6)}
              </Text>
            </View>
          </View>

          <View style={styles.pinCardButtons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Route to dropped pin"
              style={({ pressed }) => [
                styles.pinCardButton,
                styles.pinCardPrimary,
                pressed && styles.mapControlPressed,
              ]}
              onPress={useDroppedPin}
            >
              <Ionicons
                name="navigate"
                size={16}
                color="#FFFFFF"
              />

              <Text style={styles.pinCardPrimaryText}>
                Route here
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit dropped pin coordinates"
              style={({ pressed }) => [
                styles.pinCardButton,
                styles.pinCardSecondary,
                pressed && styles.mapControlPressed,
              ]}
              onPress={openCoordinateEntry}
            >
              <Ionicons
                name="create-outline"
                size={16}
                color="#1A73E8"
              />

              <Text style={styles.pinCardSecondaryText}>
                Edit
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove dropped pin"
              style={({ pressed }) => [
                styles.pinCardDelete,
                pressed && styles.mapControlPressed,
              ]}
              onPress={removeDroppedPin}
            >
              <Ionicons
                name="trash-outline"
                size={17}
                color="#FF6B6B"
              />
            </Pressable>
          </View>
        </View>
      )}

      <View
        style={[
          styles.mapControls,
          navigationActive
            ? styles.mapControlsNavigation
            : styles.mapControlsNormal,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isPreviewingTurn
              ? "Return to live navigation"
              : "Center map on my location"
          }
          style={({ pressed }) => [
            styles.mapControl,
            pressed && styles.mapControlPressed,
          ]}
          onPress={recenterMap}
        >
          <Ionicons
            name={
              isPreviewingTurn
                ? "navigate"
                : followUser
                  ? "locate"
                  : "locate-outline"
            }
            size={21}
            color={
              isPreviewingTurn || followUser
                ? "#1A73E8"
                : "#5F6368"
            }
          />
        </Pressable>

        {!navigationActive && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              pinMode ? "Cancel pin placement" : "Drop a pin"
            }
            style={({ pressed }) => [
              styles.mapControl,
              pinMode && styles.mapControlActive,
              pressed && styles.mapControlPressed,
            ]}
            onPress={() => setPinMode((previous) => !previous)}
          >
            <Ionicons
              name={pinMode ? "close" : "location-outline"}
              size={21}
              color={pinMode ? "#1A73E8" : "#5F6368"}
            />
          </Pressable>
        )}

        {!navigationActive && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enter coordinates"
            style={({ pressed }) => [
              styles.mapControl,
              pressed && styles.mapControlPressed,
            ]}
            onPress={openCoordinateEntry}
          >
            <Ionicons
              name="keypad-outline"
              size={20}
              color="#5F6368"
            />
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            satelliteMode ? "Show standard map" : "Show satellite map"
          }
          style={({ pressed }) => [
            styles.mapControl,
            satelliteMode && styles.mapControlActive,
            pressed && styles.mapControlPressed,
          ]}
          onPress={toggleSatellite}
        >
          <Ionicons
            name={satelliteMode ? "earth" : "map-outline"}
            size={21}
            color={satelliteMode ? "#1A73E8" : "#5F6368"}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            threeDEnabled ? "Turn off 3D map" : "Turn on 3D map"
          }
          style={({ pressed }) => [
            styles.mapControl,
            threeDEnabled && styles.mapControlActive,
            pressed && styles.mapControlPressed,
          ]}
          onPress={() => onToggle3D?.()}
        >
          <Text
            style={[
              styles.threeDText,
              threeDEnabled && styles.threeDTextActive,
            ]}
          >
            3D
          </Text>
        </Pressable>
      </View>

      {navigationActive && livePosition && (
        <View
          pointerEvents="none"
          style={[
            styles.speedContainer,
            navigationNightMode && styles.speedContainerNight,
          ]}
        >
          <View style={styles.speedBox}>
            <Text style={styles.speedValue}>
              {formatSpeedLimit(speedLimit)}
            </Text>

            <Text style={styles.speedLabel}>
              SPEED LIMIT
            </Text>
          </View>

          <View style={styles.speedDivider} />

          <View style={styles.speedBox}>
            <Text style={styles.speedValue}>
              {formatSpeed(livePosition.speed)}
            </Text>

            <Text style={styles.speedLabel}>
              YOUR SPEED
            </Text>
          </View>
        </View>
      )}

      {navigationActive && (
        <View
          pointerEvents="none"
          style={[
            styles.navigationGlow,
            navigationNightMode && styles.navigationGlowNight,
          ]}
        />
      )}

      <Modal
        visible={coordinateModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCoordinateModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.coordinateModal}>
            <View style={styles.coordinateModalHeader}>
              <View style={styles.coordinateModalIcon}>
                <Ionicons
                  name="location"
                  size={22}
                  color="#1A73E8"
                />
              </View>

              <View style={styles.coordinateModalTitleContainer}>
                <Text style={styles.coordinateModalTitle}>
                  Set a pin by coordinates
                </Text>

                <Text style={styles.coordinateModalSubtitle}>
                  Paste a coordinate pair from any map
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close coordinate entry"
                onPress={() => setCoordinateModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color="#5F6368"
                />
              </Pressable>
            </View>

            <TextInput
              accessibilityLabel="Latitude and longitude"
              value={coordinateInput}
              onChangeText={setCoordinateInput}
              placeholder="37.7749, -122.4194"
              placeholderTextColor="#60798D"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitCoordinates}
              style={styles.coordinateInput}
            />

            <Text style={styles.coordinateHint}>
              Enter latitude, longitude. Example: 37.7749, -122.4194{"\n"}
              Latitude: -90 to 90 · Longitude: -180 to 180
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.placePinButton,
                pressed && styles.mapControlPressed,
              ]}
              onPress={submitCoordinates}
            >
              <Ionicons
                name="location"
                size={18}
                color="#FFFFFF"
              />

              <Text style={styles.placePinButtonText}>
                Place Pin
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 28,
  },

  map: {
    flex: 1,
  },

  turnPreviewBadge: {
    position: "absolute",
    top: 12.5,
    left: 9,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#073B35",
    borderWidth: 1,
    borderColor: "#137C69",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    zIndex: 35,
    elevation: 9,
  },

  turnPreviewBadgeText: {
    color: "#A7F3D0",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  hazardMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },

  routeHazardWarning: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 15,
    backgroundColor: "#422B0A",
    borderWidth: 1,
    borderColor: "#8A5A13",
    zIndex: 30,
    elevation: 12,
  },

  routeHazardWarningText: {
    flex: 1,
  },

  routeHazardWarningTitle: {
    color: "#FEF3C7",
    fontSize: 12,
    fontWeight: "900",
  },

  routeHazardWarningSubtitle: {
    color: "#FCD34D",
    fontSize: 10,
    marginTop: 3,
  },

  hazardDetailsCard: {
    position: "absolute",
    width: 267,
    height: 167,
    bottom: 14,
    left: 124,
    right: 70,
    padding: 15,
    borderRadius: 18,
    backgroundColor: "#07111F",
    borderWidth: 1,
    borderColor: "#294158",
    zIndex: 50,
    elevation: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },

  hazardDetailsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  hazardDetailsIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  hazardDetailsText: {
    flex: 1,
  },

  hazardDetailsEyebrow: {
    color: "#20C997",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 4,
  },

  hazardDetailsTitle: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "900",
  },

  hazardDetailsType: {
    color: "#FBBF24",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginTop: 4,
  },

  hazardCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#172638",
  },

  hazardDetailsDescription: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },

  hazardDetailsCoordinates: {
    color: "#7F96AA",
    fontSize: 10,
    marginTop: 9,
  },

  hazardDisclaimer: {
    color: "#94A3B8",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 9,
  },

  hazardRefreshButton: {
    position: "absolute",
    left: 14,
    bottom: 15,
    minHeight: 35,
    paddingHorizontal: 11,
    borderRadius: 12,
    backgroundColor: "#07111F",
    borderWidth: 1,
    borderColor: "#294158",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    zIndex: 25,
    elevation: 8,
  },

  hazardRefreshButtonNavigation: {
    bottom: 15,
  },

  hazardRefreshText: {
    color: "#DCE8F2",
    fontSize: 10,
    fontWeight: "800",
  },

  hazardRefreshError: {
    position: "absolute",
    left: 14,
    bottom: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#422B0A",
    borderWidth: 1,
    borderColor: "#8A5A13",
    zIndex: 25,
  },

  hazardRefreshErrorText: {
    color: "#FDE68A",
    fontSize: 10,
    fontWeight: "800",
  },

  mapControls: {
    position: "absolute",
    right: 14,
    zIndex: 40,
    gap: 9,
  },

  mapControlsNormal: {
    top: 127,
  },

  mapControlsNavigation: {
    top: 14,
  },

  mapControl: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DADCE0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 5,
  },

  mapControlActive: {
    backgroundColor: "#E8F0FE",
    borderColor: "#C6DAFC",
  },

  mapControlPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.94 }],
  },

  threeDText: {
    color: "#5F6368",
    fontSize: 13,
    fontWeight: "900",
  },

  threeDTextActive: {
    color: "#1A73E8",
  },

  pinModeBanner: {
    position: "absolute",
    top: 132,
    left: 14,
    right: 70,
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DADCE0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 14,
    paddingRight: 7,
    zIndex: 45,
    elevation: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 9,
  },

  pinModeBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },

  pinModeText: {
    color: "#202124",
    fontSize: 12,
    fontWeight: "800",
  },

  pinModeCoordinateButton: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: "#E8F0FE",
    borderWidth: 1,
    borderColor: "#D2E3FC",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  pinModeCoordinateText: {
    color: "#1A73E8",
    fontSize: 10,
    fontWeight: "900",
  },

  droppedPinCard: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 108,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DADCE0",
    padding: 14,
    zIndex: 35,
    elevation: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },

  droppedPinHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  droppedPinIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,176,32,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  droppedPinTitleContainer: {
    flex: 1,
  },

  droppedPinTitle: {
    color: "#202124",
    fontSize: 15,
    fontWeight: "900",
  },

  droppedPinCoordinates: {
    color: "#5F6368",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },

  pinCardButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },

  pinCardButton: {
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  pinCardPrimary: {
    flex: 1,
    backgroundColor: "#1A73E8",
  },

  pinCardPrimaryText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  pinCardSecondary: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DADCE0",
  },

  pinCardSecondaryText: {
    color: "#1A73E8",
    fontSize: 11,
    fontWeight: "800",
  },

  pinCardDelete: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255,107,107,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,107,107,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  liveMarker: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },

  liveMarkerOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,122,255,0.22)",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  liveMarkerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#007AFF",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  liveMarkerArrow: {
    position: "absolute",
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#007AFF",
  },

  speedContainer: {
    position: "absolute",
    top: 66,
    left: 14,
    width: 250,
    height: 64,
    borderRadius: 17,
    backgroundColor: "rgba(7,17,31,0.95)",
    borderWidth: 1,
    borderColor: "#21415B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 25,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 9,
  },

  speedContainerNight: {
    backgroundColor: "rgba(2,6,11,0.96)",
  },

  speedBox: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  speedValue: {
    color: "#E5E8EF",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  speedLabel: {
    color: "#5F6368",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginTop: 3,
  },

  speedDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#21415B",
  },

  navigationGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  navigationGlowNight: {
    backgroundColor: "rgba(0,0,0,0.08)",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(32,33,36,0.42)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  coordinateModal: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DADCE0",
    padding: 20,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },

  coordinateModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },

  coordinateModalIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E8F0FE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  coordinateModalTitleContainer: {
    flex: 1,
  },

  coordinateModalTitle: {
    color: "#202124",
    fontSize: 18,
    fontWeight: "900",
  },

  coordinateModalSubtitle: {
    color: "#5F6368",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },

  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F1F3F4",
    alignItems: "center",
    justifyContent: "center",
  },

  coordinateInput: {
    height: 48,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DADCE0",
    color: "#202124",
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 16,
  },

  coordinateHint: {
    color: "#5F6368",
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 16,
  },

  placePinButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#1A73E8",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },

  placePinButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
});
