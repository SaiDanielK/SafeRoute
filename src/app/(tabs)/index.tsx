
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  Region,
} from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

import {
  getRecentTrips,
  type RecentTrip,
} from "../../../src/services/tripHistoryService";

import {
  getCurrentLocationSafetyScore,
} from "../../../src/services/safety/locationSafetyService";

import type {
  SafetyScore,
} from "../../../src/services/safety/safetyTypes";

export default function HomeScreen() {
  const [location, setLocation] =
    useState<Location.LocationObject | null>(null);

  const [mapRegion, setMapRegion] =
    useState<Region | null>(null);

  const [locationLoading, setLocationLoading] =
    useState(true);

  const [locationPermissionDenied, setLocationPermissionDenied] =
    useState(false);

  const [recentTrips, setRecentTrips] =
    useState<RecentTrip[]>([]);

  const [tripsLoading, setTripsLoading] =
    useState(true);

  const [tripsError, setTripsError] =
    useState(false);

  const [safetyScore, setSafetyScore] =
    useState<SafetyScore | null>(null);

  const [safetyLoading, setSafetyLoading] =
    useState(false);

  const [safetyError, setSafetyError] =
    useState(false);

  const loadRecentTrips = useCallback(async () => {
    setTripsLoading(true);
    setTripsError(false);

    try {
      const trips = await getRecentTrips(5);
      setRecentTrips(trips);
    } catch (error) {
      console.error("Unable to load recent trips:", error);
      setTripsError(true);
    } finally {
      setTripsLoading(false);
    }
  }, []);

  // Refresh trip history whenever Home becomes active.
  useFocusEffect(
    useCallback(() => {
      void loadRecentTrips();
    }, [loadRecentTrips])
  );

  // Get the user's current GPS location.
  useEffect(() => {
    let mounted = true;

    const getCurrentLocation = async () => {
      try {
        setLocationLoading(true);

        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          if (mounted) {
            setLocationPermissionDenied(true);
            setLocationLoading(false);
          }
          return;
        }

        const currentLocation =
          await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

        if (!mounted) {
          return;
        }

        setLocation(currentLocation);

        setMapRegion({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        });

        setLocationPermissionDenied(false);
      } catch (error) {
        console.log("Home location error:", error);

        if (mounted) {
          setLocationPermissionDenied(true);
        }
      } finally {
        if (mounted) {
          setLocationLoading(false);
        }
      }
    };

    void getCurrentLocation();

    return () => {
      mounted = false;
    };
  }, []);

  // Calculate a safety score for a nearby walking route
  // starting from the user's actual GPS coordinates.
  useEffect(() => {
    let mounted = true;

    const loadSafetyScore = async () => {
      if (!location) {
        setSafetyScore(null);
        setSafetyError(false);
        setSafetyLoading(false);
        return;
      }

      setSafetyLoading(true);
      setSafetyError(false);

      try {
        const result = await getCurrentLocationSafetyScore({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (mounted) {
          setSafetyScore(result);
        }
      } catch (error) {
        console.error(
          "Unable to calculate current-location safety:",
          error
        );

        if (mounted) {
          setSafetyScore(null);
          setSafetyError(true);
        }
      } finally {
        if (mounted) {
          setSafetyLoading(false);
        }
      }
    };

    void loadSafetyScore();

    return () => {
      mounted = false;
    };
  }, [location]);

  const openMap = () => {
    router.push("/map");
  };

  const recenterMap = () => {
    if (!location) {
      return;
    }

    setMapRegion({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    });
  };

  const retryLocation = async () => {
    try {
      setLocationPermissionDenied(false);
      setLocationLoading(true);

      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setLocationPermissionDenied(true);
        return;
      }

      const currentLocation =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

      setLocation(currentLocation);

      setMapRegion({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      });
    } catch (error) {
      console.log("Location retry error:", error);
      setLocationPermissionDenied(true);
    } finally {
      setLocationLoading(false);
    }
  };

  const formatDistance = (meters: number) => {
    const miles = meters / 1609.344;

    if (!Number.isFinite(miles) || miles < 0) {
      return "Distance unavailable";
    }

    return `${miles.toFixed(1)} mi`;
  };

  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "Time unavailable";
    }

    const minutes = Math.round(seconds / 60);

    if (minutes < 1) {
      return "<1 min";
    }

    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes === 0
      ? `${hours} hr`
      : `${hours} hr ${remainingMinutes} min`;
  };

  const getTripIcon = (
    travelMode: string
  ): keyof typeof Ionicons.glyphMap => {
    if (travelMode.includes("cycling")) {
      return "bicycle";
    }

    if (travelMode.includes("driving")) {
      return "car";
    }

    return "walk";
  };

  const getTripIconColor = (travelMode: string) => {
    if (travelMode.includes("cycling")) {
      return "#4DA3FF";
    }

    if (travelMode.includes("driving")) {
      return "#FFC857";
    }

    return "#55D68A";
  };

  const currentScore = safetyScore?.score ?? null;

  const hasEnoughSafetyData =
    safetyScore !== null &&
    safetyScore.dataCoverage >= 20;

  const safetyStatusTitle = safetyLoading
    ? "Checking nearby safety..."
    : !location
      ? locationLoading
        ? "Finding your location..."
        : "Location unavailable"
      : safetyError || currentScore === null
        ? "Safety score unavailable"
        : !hasEnoughSafetyData
          ? "Safety data is limited"
          : currentScore >= 70
            ? "You're in a safe area"
            : currentScore <= 40
              ? "You're in a dangerous area"
              : "Use caution in this area";

  const safetyStatusColor =
    currentScore === null || !hasEnoughSafetyData
      ? "#91A4BB"
      : currentScore >= 70
        ? "#55D68A"
        : currentScore <= 40
          ? "#FF6B6B"
          : "#FFC857";

  const safetyStatusIcon: keyof typeof Ionicons.glyphMap =
    currentScore !== null &&
    hasEnoughSafetyData &&
    currentScore <= 40
      ? "warning"
      : currentScore !== null &&
          hasEnoughSafetyData &&
          currentScore >= 70
        ? "shield-checkmark"
        : "shield-outline";

  const safetyStatusSubtitle = safetyLoading
    ? "Assessing a nearby walking route"
    : safetyError
      ? "Check your connection and try again"
      : !location
        ? "Enable location access to assess a nearby route"
        : currentScore === null
          ? "No current assessment available"
          : `Nearby walking-route estimate · ${safetyScore?.dataCoverage ?? 0}% data coverage`;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SAFEROUTE</Text>
            <Text style={styles.greeting}>
              Stay safe out there.
            </Text>
          </View>

          <Pressable
            style={styles.profileButton}
            onPress={() => router.push("/profile")}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <Ionicons
              name="person"
              size={20}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        {/* Current Location Safety */}
        <View style={styles.statusCard}>
          <View
            style={[
              styles.statusIcon,
              {
                backgroundColor: `${safetyStatusColor}20`,
              },
            ]}
          >
            {safetyLoading ? (
              <ActivityIndicator
                size="small"
                color={safetyStatusColor}
              />
            ) : (
              <Ionicons
                name={safetyStatusIcon}
                size={27}
                color={safetyStatusColor}
              />
            )}
          </View>

          <View style={styles.statusTextContainer}>
            <Text style={styles.statusLabel}>
              CURRENT SAFETY
            </Text>

            <Text style={styles.statusTitle}>
              {safetyStatusTitle}
            </Text>

            <Text style={styles.statusSubtitle}>
              {safetyStatusSubtitle}
            </Text>
          </View>

          <View style={styles.scoreContainer}>
            <Text
              style={[
                styles.score,
                { color: safetyStatusColor },
              ]}
            >
              {safetyLoading
                ? "..."
                : currentScore !== null
                  ? currentScore
                  : "—"}
            </Text>

            <Text style={styles.scoreLabel}>
              /100
            </Text>
          </View>
        </View>

        {/* Map Preview */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Your area
          </Text>

          <Pressable onPress={openMap}>
            <Text style={styles.viewMap}>
              Open map
            </Text>
          </Pressable>
        </View>

        <View style={styles.mapCard}>
          {mapRegion ? (
            <MapView
              provider={PROVIDER_DEFAULT}
              style={styles.map}
              region={mapRegion}
              onRegionChangeComplete={setMapRegion}
              showsUserLocation
              showsCompass
              scrollEnabled
              zoomEnabled
              rotateEnabled
              pitchEnabled
              toolbarEnabled={false}
            >
              {location && (
                <Marker
                  coordinate={{
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                  }}
                  title="You are here"
                  description="Your current location"
                >
                  <View style={styles.locationMarker}>
                    <View
                      style={styles.locationMarkerInner}
                    />
                  </View>
                </Marker>
              )}
            </MapView>
          ) : (
            <View style={styles.mapLoading}>
              {locationLoading ? (
                <>
                  <ActivityIndicator
                    size="small"
                    color="#4DA3FF"
                  />

                  <Text style={styles.mapLoadingText}>
                    Finding your location...
                  </Text>
                </>
              ) : locationPermissionDenied ? (
                <>
                  <Ionicons
                    name="location-outline"
                    size={27}
                    color="#748BA6"
                  />

                  <Text style={styles.mapLoadingText}>
                    Location permission is unavailable
                  </Text>

                  <Pressable
                    style={styles.locationRetryButton}
                    onPress={retryLocation}
                  >
                    <Text style={styles.locationRetryText}>
                      Try again
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Text style={styles.mapLoadingText}>
                  Location unavailable
                </Text>
              )}
            </View>
          )}

          {/* Recenter Button */}
          {mapRegion && (
            <Pressable
              style={[
                styles.recenterButton,
                !location &&
                  styles.recenterButtonDisabled,
              ]}
              onPress={recenterMap}
              disabled={!location}
              accessibilityRole="button"
              accessibilityLabel="Recenter map on your location"
            >
              <Ionicons
                name="locate"
                size={22}
                color={location ? "#111827" : "#9CA3AF"}
              />
            </Pressable>
          )}

          {/* Open Map Overlay */}
          <View style={styles.mapOverlay}>
            <Pressable
              style={styles.mapOverlayButton}
              onPress={openMap}
            >
              <Ionicons
                name="navigate"
                size={18}
                color="#FFFFFF"
              />

              <Text style={styles.mapOverlayText}>
                Open SafeRoute Map
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Quick Actions */}
        <Text
          style={[
            styles.sectionTitle,
            styles.quickTitle,
          ]}
        >
          Quick actions
        </Text>

        <View style={styles.actionGrid}>
          <Pressable
            style={styles.actionCard}
            onPress={openMap}
          >
            <View style={styles.actionIcon}>
              <Ionicons
                name="navigate"
                size={23}
                color="#4DA3FF"
              />
            </View>

            <Text style={styles.actionTitle}>
              Start a trip
            </Text>

            <Text style={styles.actionSubtitle}>
              Find a safer route
            </Text>
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => router.push("/safety")}
          >
            <View style={styles.actionIcon}>
              <Ionicons
                name="warning"
                size={23}
                color="#FFC857"
              />
            </View>

            <Text style={styles.actionTitle}>
              Safety alerts
            </Text>

            <Text style={styles.actionSubtitle}>
              Check your area
            </Text>
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => router.push("/trips")}
          >
            <View style={styles.actionIcon}>
              <Ionicons
                name="time"
                size={23}
                color="#A78BFA"
              />
            </View>

            <Text style={styles.actionTitle}>
              My trips
            </Text>

            <Text style={styles.actionSubtitle}>
              View trip history
            </Text>
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => router.push("/emergency")}
          >
            <View
              style={[
                styles.actionIcon,
                styles.emergencyIcon,
              ]}
            >
              <Ionicons
                name="shield"
                size={23}
                color="#FF6B6B"
              />
            </View>

            <Text style={styles.actionTitle}>
              Emergency
            </Text>

            <Text style={styles.actionSubtitle}>
              Get help quickly
            </Text>
          </Pressable>
        </View>

        {/* Recent Trips */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Recent trips
          </Text>

          <Pressable
            onPress={() => router.push("/trips")}
          >
            <Text style={styles.viewMap}>
              See all
            </Text>
          </Pressable>
        </View>

        {tripsLoading ? (
          <View style={styles.tripsMessageCard}>
            <ActivityIndicator
              size="small"
              color="#4DA3FF"
            />

            <Text style={styles.tripsMessageText}>
              Loading your recent trips...
            </Text>
          </View>
        ) : tripsError ? (
          <View style={styles.tripsMessageCard}>
            <View style={styles.emptyTripsIcon}>
              <Ionicons
                name="cloud-offline-outline"
                size={25}
                color="#FFC857"
              />
            </View>

            <Text style={styles.emptyTripsTitle}>
              Couldn't load trips
            </Text>

            <Text style={styles.tripsMessageText}>
              Check your connection and try again.
            </Text>

            <Pressable
              style={styles.retryTripsButton}
              onPress={() => void loadRecentTrips()}
            >
              <Ionicons
                name="refresh"
                size={16}
                color="#FFFFFF"
              />

              <Text style={styles.retryTripsText}>
                Try again
              </Text>
            </Pressable>
          </View>
        ) : recentTrips.length === 0 ? (
          <View style={styles.tripsMessageCard}>
            <View style={styles.emptyTripsIcon}>
              <Ionicons
                name="footsteps-outline"
                size={27}
                color="#4DA3FF"
              />
            </View>

            <Text style={styles.emptyTripsTitle}>
              No completed trips yet
            </Text>

            <Text style={styles.tripsMessageText}>
              Your completed journeys will appear here.
              Start a trip and arrive at your destination
              to build your history.
            </Text>

            <Pressable
              style={styles.startTripButton}
              onPress={openMap}
            >
              <Ionicons
                name="navigate"
                size={17}
                color="#FFFFFF"
              />

              <Text style={styles.startTripButtonText}>
                Start your first trip
              </Text>
            </Pressable>
          </View>
        ) : (
          recentTrips.map((trip) => (
            <Pressable
              key={trip.id}
              style={styles.tripCard}
              onPress={() => router.push("/trips")}
              accessibilityRole="button"
              accessibilityLabel={`Trip from ${trip.originName} to ${trip.destinationName}`}
            >
              <View style={styles.tripIcon}>
                <Ionicons
                  name={getTripIcon(trip.travelMode)}
                  size={21}
                  color={getTripIconColor(trip.travelMode)}
                />
              </View>

              <View style={styles.tripInfo}>
                <Text
                  style={styles.tripTitle}
                  numberOfLines={1}
                >
                  {trip.originName} → {trip.destinationName}
                </Text>

                <Text style={styles.tripDetails}>
                  {formatDistance(trip.distanceMeters)}
                  {" • "}
                  {formatDuration(trip.durationSeconds)}
                </Text>
              </View>

              <View style={styles.tripScore}>
                <Text
                  style={[
                    styles.tripScoreNumber,
                    trip.safetyScore == null &&
                      styles.tripScoreUnavailable,
                  ]}
                >
                  {trip.safetyScore != null
                    ? trip.safetyScore
                    : "—"}
                </Text>

                <Text style={styles.tripScoreLabel}>
                  {trip.safetyScore != null
                    ? "SCORE"
                    : "N/A"}
                </Text>
              </View>
            </Pressable>
          ))
        )}

        {/* Emergency Banner */}
        <Pressable
          style={styles.emergencyBanner}
          onPress={() => router.push("/emergency")}
        >
          <View style={styles.emergencyBannerIcon}>
            <Ionicons
              name="warning"
              size={23}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.emergencyBannerText}>
            <Text style={styles.emergencyBannerTitle}>
              Need help?
            </Text>

            <Text style={styles.emergencyBannerSubtitle}>
              Open Emergency Center
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={22}
            color="#FFFFFF"
          />
        </Pressable>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07111F",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 70,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  eyebrow: {
    color: "#4DA3FF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 5,
  },

  greeting: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "800",
  },

  profileButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#132238",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#223653",
  },

  statusCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 22,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1D334F",
    marginBottom: 28,
  },

  statusIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  statusTextContainer: {
    flex: 1,
  },

  statusLabel: {
    color: "#6F89A8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 3,
  },

  statusTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 3,
  },

  statusSubtitle: {
    color: "#91A4BB",
    fontSize: 11,
  },

  scoreContainer: {
    alignItems: "center",
    marginLeft: 8,
  },

  score: {
    fontSize: 24,
    fontWeight: "900",
  },

  scoreLabel: {
    color: "#6F89A8",
    fontSize: 10,
    marginTop: -3,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
  },

  viewMap: {
    color: "#4DA3FF",
    fontSize: 13,
    fontWeight: "700",
  },

  mapCard: {
    height: 230,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 27,
    borderWidth: 1,
    borderColor: "#203752",
    backgroundColor: "#102338",
  },

  map: {
    ...StyleSheet.absoluteFill,
  },

  mapLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#102338",
    padding: 16,
  },

  mapLoadingText: {
    color: "#8195AA",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },

  locationRetryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#142B43",
    borderWidth: 1,
    borderColor: "#29445D",
  },

  locationRetryText: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "700",
  },

  locationMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(77, 163, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  locationMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4DA3FF",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  recenterButton: {
    position: "absolute",
    right: 14,
    top: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },

  recenterButtonDisabled: {
    opacity: 0.75,
  },

  mapOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    backgroundColor: "rgba(7, 17, 31, 0.35)",
  },

  mapOverlayButton: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B1728",
    paddingHorizontal: 17,
    paddingVertical: 11,
    borderRadius: 25,
    gap: 8,
    borderWidth: 1,
    borderColor: "#29415F",
  },

  mapOverlayText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  quickTitle: {
    marginBottom: 13,
  },

  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 28,
  },

  actionCard: {
    width: "48%",
    backgroundColor: "#0E1D30",
    borderRadius: 19,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1D334F",
  },

  actionIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#12263F",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  emergencyIcon: {
    backgroundColor: "#321D28",
  },

  actionTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },

  actionSubtitle: {
    color: "#748BA6",
    fontSize: 11,
  },

  tripsMessageCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1D334F",
  },

  emptyTripsIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#12263F",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  emptyTripsTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 7,
  },

  tripsMessageText: {
    color: "#8195AA",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  startTripButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#287FD1",
    paddingHorizontal: 17,
    paddingVertical: 11,
    borderRadius: 13,
    marginTop: 17,
  },

  startTripButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  retryTripsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#183652",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 15,
  },

  retryTripsText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  tripCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1D334F",
  },

  tripIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#12263F",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  tripInfo: {
    flex: 1,
    marginRight: 8,
  },

  tripTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },

  tripDetails: {
    color: "#748BA6",
    fontSize: 11,
  },

  tripScore: {
    alignItems: "center",
    minWidth: 35,
  },

  tripScoreNumber: {
    color: "#55D68A",
    fontSize: 17,
    fontWeight: "900",
  },

  tripScoreUnavailable: {
    color: "#8195AA",
  },

  tripScoreLabel: {
    color: "#66809D",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
  },

  emergencyBanner: {
    backgroundColor: "#A9363D",
    borderRadius: 19,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
  },

  emergencyBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  emergencyBannerText: {
    flex: 1,
  },

  emergencyBannerTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 3,
  },

  emergencyBannerSubtitle: {
    color: "#FFD9D9",
    fontSize: 11,
  },

  bottomSpace: {
    height: 20,
  },
});
