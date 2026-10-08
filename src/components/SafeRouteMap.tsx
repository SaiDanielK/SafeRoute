import React, {
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

type SafeRouteMapProps = {
  region: Region | null;

  speedLimit?: number | null;

  destination?: Destination | null;

  routeCoordinates?: RouteCoordinate[];

  alternativeRoutes?: RouteCoordinate[][];

  selectedRouteIndex?: number;

  onSelectRoute?: (
    index: number
  ) => void;

  navigationActive?: boolean;

  livePosition?: LivePosition | null;

  navigationNightMode?: boolean;

  followUser?: boolean;

  onFollowUserChange?: (
    following: boolean
  ) => void;

  threeDEnabled?: boolean;

  onToggle3D?: () => void;

  onUseDroppedPin?: (
    coordinate: RouteCoordinate
  ) => void;

  onPinPlaced?: () => void;

  trafficSegments?: TrafficRouteSegment[];
};

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
  return `${Math.round(
    metersPerSecondToMph(speed)
  )} mph`;
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

  return `${Math.round(
    speedLimit
  )} mph`;
}

function pointToSegmentDistance(
  point: RouteCoordinate,
  start: RouteCoordinate,
  end: RouteCoordinate
): number {
  const latitudeScale =
    Math.cos(
      (point.latitude * Math.PI) / 180
    );

  const pointX = 0;
  const pointY = 0;

  const startX =
    (start.longitude -
      point.longitude) *
    latitudeScale;

  const startY =
    start.latitude -
    point.latitude;

  const endX =
    (end.longitude -
      point.longitude) *
    latitudeScale;

  const endY =
    end.latitude -
    point.latitude;

  const dx =
    endX - startX;

  const dy =
    endY - startY;

  const segmentLengthSquared =
    dx * dx + dy * dy;

  if (segmentLengthSquared === 0) {
    return Math.sqrt(
      startX * startX +
        startY * startY
    );
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((pointX - startX) * dx +
        (pointY - startY) * dy) /
        segmentLengthSquared
    )
  );

  const projectionX =
    startX + t * dx;

  const projectionY =
    startY + t * dy;

  const differenceX =
    pointX - projectionX;

  const differenceY =
    pointY - projectionY;

  return Math.sqrt(
    differenceX * differenceX +
      differenceY * differenceY
  );
}

function distanceFromPointToRoute(
  point: RouteCoordinate,
  route: RouteCoordinate[]
): number {
  if (route.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (route.length === 1) {
    const latitudeScale =
      Math.cos(
        (point.latitude * Math.PI) /
          180
      );

    const longitudeDifference =
      (route[0].longitude -
        point.longitude) *
      latitudeScale;

    const latitudeDifference =
      route[0].latitude -
      point.latitude;

    return Math.sqrt(
      longitudeDifference *
        longitudeDifference +
        latitudeDifference *
          latitudeDifference
    );
  }

  let minimumDistance =
    Number.POSITIVE_INFINITY;

  for (
    let index = 0;
    index < route.length - 1;
    index += 1
  ) {
    const distance =
      pointToSegmentDistance(
        point,
        route[index],
        route[index + 1]
      );

    if (
      distance <
      minimumDistance
    ) {
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
  const TAP_TOLERANCE_DEGREES =
    0.00065;

  const routeHits: RouteHit[] = [];

  routes.forEach(
    (
      route,
      routeIndex
    ) => {
      if (route.length < 2) {
        return;
      }

      const distance =
        distanceFromPointToRoute(
          coordinate,
          route
        );

      if (
        distance >
        TAP_TOLERANCE_DEGREES
      ) {
        return;
      }

      routeHits.push({
        index: routeIndex,
        distance,
      });
    }
  );

  if (routeHits.length === 0) {
    return [];
  }

  routeHits.sort(
    (a, b) => a.distance - b.distance
  );

  const closestDistance =
    routeHits[0]?.distance ??
    Number.POSITIVE_INFINITY;

  return routeHits.filter(
    (hit) =>
      hit.distance <=
      closestDistance + 0.00004
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
}: SafeRouteMapProps) {
  const mapRef =
    useRef<MapView>(null);

  const hasCenteredInitiallyRef =
    useRef(false);

  const previousNavigationActiveRef =
    useRef(false);

  const [
    droppedPin,
    setDroppedPin,
  ] = useState<RouteCoordinate | null>(
    null
  );

  const [pinMode, setPinMode] =
    useState(false);

  const [
    coordinateModalVisible,
    setCoordinateModalVisible,
  ] = useState(false);

  const [coordinateInput, setCoordinateInput] =
    useState("");

  const [
    satelliteMode,
    setSatelliteMode,
  ] = useState(false);

  const NAVIGATION_ZOOM = 19.5;

  const NAVIGATION_LATITUDE_DELTA =
    0.002;

  const NAVIGATION_LONGITUDE_DELTA =
    0.002;

  const NORMAL_ZOOM = 15;

  const defaultRegion: Region = {
    latitude: 34.0522,
    longitude: -118.2437,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const mapRegion =
    region ?? defaultRegion;

  function getHeading() {
    if (
      typeof livePosition?.heading ===
        "number" &&
      livePosition.heading >= 0
    ) {
      return livePosition.heading;
    }

    return 0;
  }

  function getCameraPosition() {
    if (livePosition) {
      return {
        latitude:
          livePosition.latitude,
        longitude:
          livePosition.longitude,
      };
    }

    if (region) {
      return {
        latitude:
          region.latitude,
        longitude:
          region.longitude,
      };
    }

    return null;
  }

  useEffect(() => {
    if (
      !mapRef.current ||
      !region ||
      hasCenteredInitiallyRef.current
    ) {
      return;
    }

    hasCenteredInitiallyRef.current =
      true;

    mapRef.current.animateCamera(
      {
        center: {
          latitude:
            region.latitude,
          longitude:
            region.longitude,
        },
        zoom: NORMAL_ZOOM,
        pitch: threeDEnabled
          ? 45
          : 0,
        heading: 0,
      },
      {
        duration: 500,
      }
    );
  }, [region]);

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
          latitude:
            region.latitude,
          longitude:
            region.longitude,
        },
        {
          latitude:
            destination.latitude,
          longitude:
            destination.longitude,
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
      setTimeout(() => {
        if (!mapRef.current) {
          return;
        }

        mapRef.current.animateCamera(
          {
            pitch: 45,
          },
          {
            duration: 350,
          }
        );
      }, 450);
    }
  }, [
    region,
    destination,
    navigationActive,
    threeDEnabled,
  ]);

  useEffect(() => {
    if (
      !navigationActive ||
      !mapRef.current ||
      !livePosition
    ) {
      return;
    }

    const navigationJustStarted =
      !previousNavigationActiveRef.current;

    previousNavigationActiveRef.current =
      navigationActive;

    if (!navigationJustStarted) {
      return;
    }

    mapRef.current.animateToRegion(
      {
        latitude:
          livePosition.latitude,
        longitude:
          livePosition.longitude,
        latitudeDelta:
          NAVIGATION_LATITUDE_DELTA,
        longitudeDelta:
          NAVIGATION_LONGITUDE_DELTA,
      },
      1000
    );

    setTimeout(() => {
      if (
        !mapRef.current ||
        !livePosition
      ) {
        return;
      }

      mapRef.current.animateCamera(
        {
          center: {
            latitude:
              livePosition.latitude,
            longitude:
              livePosition.longitude,
          },
          zoom:
            NAVIGATION_ZOOM,
          heading:
            getHeading(),
          pitch:
            threeDEnabled
              ? 45
              : 0,
        },
        {
          duration: 400,
        }
      );
    }, 1000);
  }, [
    navigationActive,
    livePosition,
    threeDEnabled,
  ]);

  useEffect(() => {
    if (!navigationActive) {
      previousNavigationActiveRef.current =
        false;
    }
  }, [navigationActive]);

  useEffect(() => {
    if (
      !mapRef.current ||
      !navigationActive ||
      !followUser ||
      !livePosition
    ) {
      return;
    }

    mapRef.current.animateToRegion(
      {
        latitude:
          livePosition.latitude,
        longitude:
          livePosition.longitude,
        latitudeDelta:
          NAVIGATION_LATITUDE_DELTA,
        longitudeDelta:
          NAVIGATION_LONGITUDE_DELTA,
      },
      450
    );

    setTimeout(() => {
      if (
        !mapRef.current ||
        !livePosition ||
        !navigationActive ||
        !followUser
      ) {
        return;
      }

      mapRef.current.animateCamera(
        {
          center: {
            latitude:
              livePosition.latitude,
            longitude:
              livePosition.longitude,
          },
          zoom:
            NAVIGATION_ZOOM,
          heading:
            getHeading(),
          pitch:
            threeDEnabled
              ? 45
              : 0,
        },
        {
          duration: 250,
        }
      );
    }, 450);
  }, [
    navigationActive,
    followUser,
    livePosition?.latitude,
    livePosition?.longitude,
    livePosition?.heading,
    threeDEnabled,
  ]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const position =
      getCameraPosition();

    if (!position) {
      return;
    }

    mapRef.current.animateCamera(
      {
        center: position,
        zoom:
          navigationActive
            ? NAVIGATION_ZOOM
            : NORMAL_ZOOM,
        heading:
          navigationActive
            ? getHeading()
            : 0,
        pitch:
          threeDEnabled
            ? 45
            : 0,
      },
      {
        duration: 500,
      }
    );
  }, [threeDEnabled]);

  function placePin(
    latitude: number,
    longitude: number
  ) {
    const coordinate = {
      latitude,
      longitude,
    };

    setDroppedPin(coordinate);
    setPinMode(false);
    onPinPlaced?.();

    mapRef.current?.animateCamera(
      {
        center: coordinate,
        zoom: NORMAL_ZOOM,
      },
      {
        duration: 500,
      }
    );
  }

  function handleMapPress(
    event: any
  ) {
    const coordinate =
      event.nativeEvent.coordinate;

    if (
      typeof coordinate?.latitude !==
        "number" ||
      typeof coordinate?.longitude !==
        "number"
    ) {
      return;
    }

    if (
      pinMode &&
      !navigationActive
    ) {
      placePin(
        coordinate.latitude,
        coordinate.longitude
      );
      return;
    }

    if (
      !navigationActive &&
      alternativeRoutes.length > 0
    ) {
      const tappedRoutes =
        findTappedRoutes(
          {
            latitude:
              coordinate.latitude,
            longitude:
              coordinate.longitude,
          },
          alternativeRoutes
        );

      if (tappedRoutes.length > 0) {
        const selectedPosition =
          tappedRoutes.findIndex(
            (route) =>
              route.index ===
              selectedRouteIndex
          );
        const nextPosition =
          selectedPosition < 0
            ? 0
            : (selectedPosition + 1) %
              tappedRoutes.length;
        const tappedRoute =
          tappedRoutes[nextPosition];

        if (!tappedRoute) {
          return;
        }

        onSelectRoute?.(
          tappedRoute.index
        );
        return;
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

    setCoordinateModalVisible(
      true
    );
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

    if (
      latitude < -90 ||
      latitude > 90
    ) {
      Alert.alert(
        "Invalid latitude",
        "Latitude must be between -90 and 90."
      );
      return;
    }

    if (
      longitude < -180 ||
      longitude > 180
    ) {
      Alert.alert(
        "Invalid longitude",
        "Longitude must be between -180 and 180."
      );
      return;
    }

    setCoordinateModalVisible(
      false
    );

    placePin(
      latitude,
      longitude
    );
  }

  function removeDroppedPin() {
    setDroppedPin(null);
    setPinMode(false);
  }

  function useDroppedPin() {
    if (!droppedPin) {
      return;
    }

    onUseDroppedPin?.(
      droppedPin
    );
    setDroppedPin(null);
  }

  function recenterMap() {
    const position =
      getCameraPosition();

    if (
      !position ||
      !mapRef.current
    ) {
      return;
    }

    onFollowUserChange?.(
      true
    );

    if (navigationActive) {
      mapRef.current.animateToRegion(
        {
          latitude:
            position.latitude,
          longitude:
            position.longitude,
          latitudeDelta:
            NAVIGATION_LATITUDE_DELTA,
          longitudeDelta:
            NAVIGATION_LONGITUDE_DELTA,
        },
        600
      );

      setTimeout(() => {
        if (!mapRef.current) {
          return;
        }

        mapRef.current.animateCamera(
          {
            center: position,
            zoom:
              NAVIGATION_ZOOM,
            heading:
              getHeading(),
            pitch:
              threeDEnabled
                ? 45
                : 0,
          },
          {
            duration: 300,
          }
        );
      }, 600);

      return;
    }

    mapRef.current.animateCamera(
      {
        center: position,
        zoom: NORMAL_ZOOM,
        heading: 0,
        pitch:
          threeDEnabled
            ? 45
            : 0,
      },
      {
        duration: 600,
      }
    );
  }

  function handleMapPan() {
    if (followUser) {
      onFollowUserChange?.(
        false
      );
    }
  }

  function toggleSatellite() {
    setSatelliteMode(
      (current) => !current
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        mapType={
          satelliteMode
            ? "satellite"
            : "standard"
        }
        userInterfaceStyle={
          navigationNightMode
            ? "dark"
            : "light"
        }
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        showsBuildings={
          threeDEnabled
        }
        showsPointsOfInterests={true}
        showsTraffic={false}
        rotateEnabled={true}
        pitchEnabled={true}
        zoomEnabled={true}
        scrollEnabled={true}
        toolbarEnabled={false}
        loadingEnabled={true}
        loadingBackgroundColor={
          navigationNightMode
            ? "#02060B"
            : "#FFFFFF"
        }
        loadingIndicatorColor="#20C997"
        onPanDrag={
          handleMapPan
        }
        onPress={
          handleMapPress
        }
      >
        {!navigationActive &&
          alternativeRoutes.map(
            (
              coordinates,
              routeIndex
            ) => {
              if (
                routeIndex ===
                selectedRouteIndex
              ) {
                return null;
              }

              return (
                <Polyline
                  key={`route-${routeIndex}`}
                  coordinates={
                    coordinates
                  }
                  strokeWidth={5}
                  strokeColor="#7B91A4"
                  lineCap="round"
                  lineJoin="round"
                  tappable={false}
                  zIndex={1}
                />
              );
            }
          )}

        {routeCoordinates.length >
          1 && (
          <Polyline
            coordinates={
              routeCoordinates
            }
            strokeWidth={
              navigationActive
                ? 8
                : 7
            }
            strokeColor="#2563eb"
            lineCap="round"
            lineJoin="round"
            tappable={false}
            zIndex={9}
          />
        )}

        {navigationActive &&
          trafficSegments.length > 0 &&
          trafficSegments.map(
            (
              segment,
              index
            ) => {
              if (
                segment.coordinates
                  .length < 2
              ) {
                return null;
              }

              return (
                <Polyline
                  key={`traffic-${index}`}
                  coordinates={
                    segment.coordinates
                  }
                  strokeWidth={7}
                  strokeColor={getTrafficColor(
                    segment.color
                  )}
                  lineCap="round"
                  lineJoin="round"
                  tappable={false}
                  zIndex={10}
                />
              );
            }
          )}

        {region &&
          !navigationActive && (
          <Marker
            coordinate={{
              latitude:
                region.latitude,
              longitude:
                region.longitude,
            }}
            title="You are here"
            description="Your current location"
            pinColor="#007AFF"
          />
        )}

        {navigationActive &&
          livePosition && (
          <Marker
            coordinate={{
              latitude:
                livePosition.latitude,
              longitude:
                livePosition.longitude,
            }}
            anchor={{
              x: 0.5,
              y: 0.5,
            }}
            flat={true}
            tracksViewChanges={false}
            rotation={
              getHeading()
            }
          >
            <View
              style={
                styles.liveMarker
              }
            >
              <View
                style={
                  styles.liveMarkerOuter
                }
              >
                <View
                  style={
                    styles.liveMarkerInner
                  }
                />
              </View>

              <View
                style={
                  styles.liveMarkerArrow
                }
              />
            </View>
          </Marker>
        )}

        {destination && (
          <Marker
            coordinate={{
              latitude:
                destination.latitude,
              longitude:
                destination.longitude,
            }}
            title={
              destination.name
            }
            description="Your destination"
            pinColor="#20C997"
          />
        )}

        {droppedPin && (
          <Marker
            coordinate={
              droppedPin
            }
            title="Dropped Pin"
            description={`${droppedPin.latitude.toFixed(
              6
            )}, ${droppedPin.longitude.toFixed(
              6
            )}`}
            pinColor="#FFB020"
          />
        )}
      </MapView>

      {pinMode && (
        <View
          style={
            styles.pinModeBanner
          }
        >
          <View
            style={
              styles.pinModeBannerContent
            }
          >
            <Ionicons
              name="location"
              size={18}
              color="#1A73E8"
            />

            <Text
              style={
                styles.pinModeText
              }
            >
              Tap anywhere to drop a pin
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enter coordinates"
            style={({ pressed }) => [
              styles.pinModeCoordinateButton,
              pressed &&
                styles.mapControlPressed,
            ]}
            onPress={
              openCoordinateEntry
            }
          >
            <Ionicons
              name="keypad-outline"
              size={16}
              color="#20C997"
            />

            <Text
              style={
                styles.pinModeCoordinateText
              }
            >
              Coordinates
            </Text>
          </Pressable>
        </View>
      )}

      {droppedPin && !pinMode && (
        <View
          style={
            styles.droppedPinCard
          }
        >
          <View
            style={
              styles.droppedPinHeader
            }
          >
            <View
              style={
                styles.droppedPinIcon
              }
            >
              <Ionicons
                name="location"
                size={18}
                color="#FFB020"
              />
            </View>

            <View
              style={
                styles.droppedPinTitleContainer
              }
            >
              <Text
                style={
                  styles.droppedPinTitle
                }
              >
                Dropped Pin
              </Text>

              <Text
                style={
                  styles.droppedPinCoordinates
                }
              >
                {droppedPin.latitude.toFixed(
                  6
                )}
                {", "}
                {droppedPin.longitude.toFixed(
                  6
                )}
              </Text>
            </View>
          </View>

          <View
            style={
              styles.pinCardButtons
            }
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Route to dropped pin"
              style={({ pressed }) => [
                styles.pinCardButton,
                styles.pinCardPrimary,
                pressed &&
                  styles.mapControlPressed,
              ]}
              onPress={
                useDroppedPin
              }
            >
              <Ionicons
                name="navigate"
                size={16}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.pinCardPrimaryText
                }
              >
                Route here
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit dropped pin coordinates"
              style={({ pressed }) => [
                styles.pinCardButton,
                styles.pinCardSecondary,
                pressed &&
                  styles.mapControlPressed,
              ]}
              onPress={
                openCoordinateEntry
              }
            >
              <Ionicons
                name="create-outline"
                size={16}
                color="#1A73E8"
              />

              <Text
                style={
                  styles.pinCardSecondaryText
                }
              >
                Edit
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove dropped pin"
              style={({ pressed }) => [
                styles.pinCardDelete,
                pressed &&
                  styles.mapControlPressed,
              ]}
              onPress={
                removeDroppedPin
              }
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
          accessibilityLabel="Center map on my location"
          style={({ pressed }) => [
            styles.mapControl,
            pressed &&
              styles.mapControlPressed,
          ]}
          onPress={
            recenterMap
          }
        >
          <Ionicons
            name={
              followUser
                ? "locate"
                : "locate-outline"
            }
            size={21}
            color={
              followUser
                ? "#1A73E8"
                : "#5F6368"
            }
          />
        </Pressable>

        {!navigationActive && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pinMode ? "Cancel pin placement" : "Drop a pin"}
            style={({ pressed }) => [
              styles.mapControl,
              pinMode &&
                styles.mapControlActive,
              pressed &&
                styles.mapControlPressed,
            ]}
            onPress={() => {
              setPinMode(
                (previous) =>
                  !previous
              );
            }}
          >
            <Ionicons
              name={
                pinMode
                  ? "close"
                  : "location-outline"
              }
              size={21}
              color={
                pinMode
                  ? "#1A73E8"
                  : "#5F6368"
              }
            />
          </Pressable>
        )}

        {!navigationActive && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enter coordinates"
            style={({ pressed }) => [
              styles.mapControl,
              pressed &&
                styles.mapControlPressed,
            ]}
            onPress={
              openCoordinateEntry
            }
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
          accessibilityLabel={satelliteMode ? "Show standard map" : "Show satellite map"}
          style={({ pressed }) => [
            styles.mapControl,
            satelliteMode &&
              styles.mapControlActive,
            pressed &&
              styles.mapControlPressed,
          ]}
          onPress={
            toggleSatellite
          }
        >
          <Ionicons
            name={
              satelliteMode
                ? "earth"
                : "map-outline"
            }
            size={21}
            color={
              satelliteMode
                ? "#1A73E8"
                : "#5F6368"
            }
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={threeDEnabled ? "Turn off 3D map" : "Turn on 3D map"}
          style={({ pressed }) => [
            styles.mapControl,
            threeDEnabled &&
              styles.mapControlActive,
            pressed &&
              styles.mapControlPressed,
          ]}
          onPress={() => {
            onToggle3D?.();
          }}
        >
          <Text
            style={[
              styles.threeDText,
              threeDEnabled &&
                styles.threeDTextActive,
            ]}
          >
            3D
          </Text>
        </Pressable>
      </View>

      {navigationActive &&
        livePosition && (
          <View
            pointerEvents="none"
            style={[
              styles.speedContainer,
              navigationNightMode &&
                styles.speedContainerNight,
            ]}
          >
            <View
              style={
                styles.speedBox
              }
            >
              <Text
                style={
                  styles.speedValue
                }
              >
                {formatSpeedLimit(
                  speedLimit
                )}
              </Text>

              <Text
                style={
                  styles.speedLabel
                }
              >
                SPEED LIMIT
              </Text>
            </View>

            <View
              style={
                styles.speedDivider
              }
            />

            <View
              style={
                styles.speedBox
              }
            >
              <Text
                style={
                  styles.speedValue
                }
              >
                {formatSpeed(
                  livePosition.speed
                )}
              </Text>

              <Text
                style={
                  styles.speedLabel
                }
              >
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
            navigationNightMode &&
              styles.navigationGlowNight,
          ]}
        />
      )}

      <Modal
        visible={
          coordinateModalVisible
        }
        transparent={true}
        animationType="fade"
        onRequestClose={() =>
          setCoordinateModalVisible(
            false
          )
        }
      >
        <KeyboardAvoidingView
          style={
            styles.modalOverlay
          }
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : "height"
          }
        >
          <View
            style={
              styles.coordinateModal
            }
          >
            <View
              style={
                styles.coordinateModalHeader
              }
            >
              <View
                style={
                  styles.coordinateModalIcon
                }
              >
                <Ionicons
                  name="location"
                  size={22}
                  color="#1A73E8"
                />
              </View>

              <View
                style={
                  styles.coordinateModalTitleContainer
                }
              >
                <Text
                  style={
                    styles.coordinateModalTitle
                  }
                >
                  Set a pin by coordinates
                </Text>

                <Text
                  style={
                    styles.coordinateModalSubtitle
                  }
                >
                  Paste a coordinate pair from any map
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close coordinate entry"
                onPress={() =>
                  setCoordinateModalVisible(
                    false
                  )
                }
                style={
                  styles.modalCloseButton
                }
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
              value={
                coordinateInput
              }
              onChangeText={
                setCoordinateInput
              }
              placeholder="37.7749, -122.4194"
              placeholderTextColor="#60798D"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitCoordinates}
              style={
                styles.coordinateInput
              }
            />

            <Text
              style={
                styles.coordinateHint
              }
            >
              Enter latitude, longitude. Example: 37.7749, -122.4194{"\n"}
              Latitude: -90 to 90 · Longitude: -180 to 180
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.placePinButton,
                pressed &&
                  styles.mapControlPressed,
              ]}
              onPress={
                submitCoordinates
              }
            >
              <Ionicons
                name="location"
                size={18}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.placePinButtonText
                }
              >
                Place Pin
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      overflow: "hidden",
      borderRadius: 28,
    },

    map: {
      flex: 1,
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
      shadowOffset: {
        width: 0,
        height: 4,
      },
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
      transform: [
        {
          scale: 0.94,
        },
      ],
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
      shadowOffset: {
        width: 0,
        height: 4,
      },
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
      shadowOffset: {
        width: 0,
        height: 5,
      },
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
      backgroundColor:
        "rgba(255,176,32,0.12)",
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
      backgroundColor:
        "rgba(255,107,107,0.08)",
      borderWidth: 1,
      borderColor:
        "rgba(255,107,107,0.25)",
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
      backgroundColor:
        "rgba(0,122,255,0.22)",
      borderWidth: 2,
      borderColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },

    liveMarkerInner: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor:
        "#007AFF",
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
      borderLeftColor:
        "transparent",
      borderRightColor:
        "transparent",
      borderBottomColor:
        "#007AFF",
    },

    speedContainer: {
      position: "absolute",
      top: 66,
      left: 14,
      width: 250,
      height: 64,
      borderRadius: 17,
      backgroundColor:
        "rgba(7,17,31,0.95)",
      borderWidth: 1,
      borderColor: "#21415B",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 25,
      elevation: 12,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.25,
      shadowRadius: 9,
    },

    speedContainerNight: {
      backgroundColor:
        "rgba(2,6,11,0.96)",
    },

    speedBox: {
      flex: 1,
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },

    speedValue: {
      color: "#e5e8ef",
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
      backgroundColor:
        "rgba(255,255,255,0.03)",
    },

    navigationGlowNight: {
      backgroundColor:
        "rgba(0,0,0,0.08)",
    },

    modalOverlay: {
      flex: 1,
      backgroundColor:
        "rgba(32,33,36,0.42)",
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
      shadowOffset: {
        width: 0,
        height: 8,
      },
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

    coordinateLabel: {
      color: "#5F6368",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.8,
      marginBottom: 7,
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
  