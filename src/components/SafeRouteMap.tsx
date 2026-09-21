import React, {
  useEffect,
  useRef,
} from "react";

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import MapView, {
  Marker,
  Polyline,
  Region,
} from "react-native-maps";

import { Ionicons } from "@expo/vector-icons";

type Destination = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type RouteCoordinate = {
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
    typeof speedLimit !==
      "number" ||
    !Number.isFinite(
      speedLimit
    ) ||
    speedLimit <= 0
  ) {
    return "-- mph";
  }

  return `${Math.round(
    speedLimit
  )} mph`;
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
}: SafeRouteMapProps) {
  const mapRef =
    useRef<MapView>(null);

  const hasCenteredInitiallyRef =
    useRef(false);

  const previousNavigationActiveRef =
    useRef(false);

  const NAVIGATION_ZOOM = 19.5;

  const NAVIGATION_LATITUDE_DELTA =
    0.002;

  const NAVIGATION_LONGITUDE_DELTA =
    0.002;

  const NORMAL_ZOOM = 15;

  const defaultRegion: Region =
    {
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

    if (
      !navigationJustStarted
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

  function handleAlternativePress(
    index: number
  ) {
    if (navigationActive) {
      return;
    }

    onSelectRoute?.(
      index
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
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
        showsPointsOfInterests={
          true
        }
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
      >
        {/*
         * Draw alternatives first so the
         * currently selected route stays
         * visually on top.
         */}
        {!navigationActive &&
          alternativeRoutes.map(
            (
              coordinates,
              alternativeIndex
            ) => {
              const routeIndex =
                alternativeIndex +
                1;

              const selected =
                selectedRouteIndex ===
                routeIndex;

              return (
                <Polyline
                  key={`alternative-route-${routeIndex}`}
                  coordinates={
                    coordinates
                  }
                  strokeWidth={
                    selected
                      ? 7
                      : 5
                  }
                  strokeColor={
                    selected
                      ? "#20C997"
                      : "#7B91A4"
                  }
                  lineCap="round"
                  lineJoin="round"
                  tappable={
                    true
                  }
                  onPress={() =>
                    handleAlternativePress(
                      routeIndex
                    )
                  }
                  zIndex={
                    selected
                      ? 3
                      : 1
                  }
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
                ? 7
                : 6
            }
            strokeColor="#20C997"
            lineCap="round"
            lineJoin="round"
            tappable={!navigationActive}
            onPress={() =>
              handleAlternativePress(
                0
              )
            }
            zIndex={5}
          />
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
            tracksViewChanges={
              false
            }
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
      </MapView>

      <View
        style={[
          styles.mapControls,
          navigationActive
            ? styles.mapControlsNavigation
            : styles.mapControlsNormal,
        ]}
      >
        <Pressable
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
                ? "#20C997"
                : "#FFFFFF"
            }
          />
        </Pressable>

        <Pressable
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
      zIndex: 20,
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
      borderRadius: 16,
      backgroundColor:
        "rgba(12,29,46,0.94)",
      borderWidth: 1,
      borderColor: "#294963",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.25,
      shadowRadius: 9,
      elevation: 8,
    },

    mapControlActive: {
      backgroundColor:
        "#123D38",
      borderColor:
        "#20C997",
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
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: -0.2,
    },

    threeDTextActive: {
      color: "#20C997",
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
      color: "#FFFFFF",
      fontSize: 17,
      fontWeight: "900",
      letterSpacing: -0.3,
    },

    speedLabel: {
      color: "#71899E",
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
  });