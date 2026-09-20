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
};

type SafeRouteMapProps = {
  region: Region | null;

  destination?: Destination | null;

  routeCoordinates?: RouteCoordinate[];

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

export default function SafeRouteMap({
  region,
  destination,
  routeCoordinates = [],
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

  /*
   * Navigation camera settings.
   *
   * The small deltas below force a very
   * close map view instead of relying only
   * on the zoom property.
   */
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

  /*
   * Initial map centering.
   */
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

  /*
   * Normal route preview.
   *
   * Disabled during navigation so it
   * cannot fight the navigation camera.
   */
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

    /*
     * fitToCoordinates can flatten
     * the camera.
     *
     * Re-apply 3D if enabled.
     */
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

  /*
   * Navigation just started.
   *
   * Force the map directly onto the
   * user's current location and make
   * the visible area very small.
   */
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

    /*
     * This is the important part:
     * use animateToRegion with tiny
     * deltas to guarantee a close-up.
     */
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

    /*
     * Apply heading and 3D after
     * the close-up animation.
     */
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

  /*
   * Reset the navigation-start flag
   * after navigation ends so the next
   * navigation session gets the zoom-in
   * animation again.
   */
  useEffect(() => {
    if (!navigationActive) {
      previousNavigationActiveRef.current =
        false;
    }
  }, [navigationActive]);

  /*
   * Google Maps-style live navigation
   * camera following.
   *
   * Every GPS position update moves the
   * camera with the user while followUser
   * is enabled.
   */
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

  /*
   * Toggle 2D / 3D immediately.
   *
   * 3D = 45 degree pitch
   * 2D = 0 degree pitch
   */
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

  /*
   * Recenter the map.
   *
   * During navigation this returns
   * directly to the user's current
   * location and restores following.
   */
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

    /*
     * Use a tiny region so the recenter
     * button also gives a close navigation
     * view.
     */
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

  /*
   * Manual dragging means the user wants
   * to explore the map.
   *
   * Stop GPS camera following until the
   * user presses the recenter button.
   */
  function handleMapPan() {
    if (followUser) {
      onFollowUserChange?.(
        false
      );
    }
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
      >
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
        { scale: 0.94 },
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