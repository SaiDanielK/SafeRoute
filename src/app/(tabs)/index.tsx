import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import MapView, { Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

export default function HomeScreen() {
  const [location, setLocation] =
    useState<Location.LocationObject | null>(null);

  const [mapRegion, setMapRegion] = useState<Region | null>(null);

  const [locationLoading, setLocationLoading] = useState(true);

  const [locationPermissionDenied, setLocationPermissionDenied] =
    useState(false);

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

    getCurrentLocation();

    return () => {
      mounted = false;
    };
  }, []);

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
            <Text style={styles.greeting}>Stay safe out there.</Text>
          </View>

          <Pressable
            style={styles.profileButton}
            onPress={() => router.push("/profile")}
          >
            <Ionicons name="person" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Safety Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Ionicons
              name="shield-checkmark"
              size={27}
              color="#55D68A"
            />
          </View>

          <View style={styles.statusTextContainer}>
            <Text style={styles.statusLabel}>CURRENT SAFETY</Text>

            <Text style={styles.statusTitle}>
              You're in a safe area
            </Text>

            <Text style={styles.statusSubtitle}>
              No major hazards reported nearby
            </Text>
          </View>

          <View style={styles.scoreContainer}>
            <Text style={styles.score}>92</Text>
            <Text style={styles.scoreLabel}>/100</Text>
          </View>
        </View>

        {/* Map Preview */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your area</Text>

          <Pressable onPress={openMap}>
            <Text style={styles.viewMap}>Open map</Text>
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
                    <View style={styles.locationMarkerInner} />
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
                    onPress={() => {
                      setLocationPermissionDenied(false);
                      setLocationLoading(true);

                      Location.requestForegroundPermissionsAsync()
                        .then(({ status }) => {
                          if (status !== "granted") {
                            setLocationPermissionDenied(true);
                            setLocationLoading(false);
                            return;
                          }

                          return Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced,
                          });
                        })
                        .then((currentLocation) => {
                          if (!currentLocation) {
                            return;
                          }

                          setLocation(currentLocation);

                          setMapRegion({
                            latitude:
                              currentLocation.coords.latitude,
                            longitude:
                              currentLocation.coords.longitude,
                            latitudeDelta: 0.012,
                            longitudeDelta: 0.012,
                          });

                          setLocationPermissionDenied(false);
                          setLocationLoading(false);
                        })
                        .catch((error) => {
                          console.log(
                            "Location retry error:",
                            error
                          );

                          setLocationPermissionDenied(true);
                          setLocationLoading(false);
                        });
                    }}
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
                !location && styles.recenterButtonDisabled,
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
        <Text style={[styles.sectionTitle, styles.quickTitle]}>
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

            <Text style={styles.actionTitle}>Start a trip</Text>

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

            <Text style={styles.actionTitle}>Safety alerts</Text>

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

            <Text style={styles.actionTitle}>My trips</Text>

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

            <Text style={styles.actionTitle}>Emergency</Text>

            <Text style={styles.actionSubtitle}>
              Get help quickly
            </Text>
          </Pressable>
        </View>

        {/* Recent Trips */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent trips</Text>

          <Pressable
            onPress={() => router.push("/trips")}
          >
            <Text style={styles.viewMap}>See all</Text>
          </Pressable>
        </View>

        <Pressable style={styles.tripCard}>
          <View style={styles.tripIcon}>
            <Ionicons
              name="walk"
              size={21}
              color="#55D68A"
            />
          </View>

          <View style={styles.tripInfo}>
            <Text style={styles.tripTitle}>
              Home → School
            </Text>

            <Text style={styles.tripDetails}>
              1.4 mi • 29 min
            </Text>
          </View>

          <View style={styles.tripScore}>
            <Text style={styles.tripScoreNumber}>92</Text>
            <Text style={styles.tripScoreLabel}>SAFE</Text>
          </View>
        </Pressable>

        <Pressable style={styles.tripCard}>
          <View style={styles.tripIcon}>
            <Ionicons
              name="bicycle"
              size={21}
              color="#4DA3FF"
            />
          </View>

          <View style={styles.tripInfo}>
            <Text style={styles.tripTitle}>
              Home → Library
            </Text>

            <Text style={styles.tripDetails}>
              2.1 mi • 12 min
            </Text>
          </View>

          <View style={styles.tripScore}>
            <Text style={styles.tripScoreNumber}>87</Text>
            <Text style={styles.tripScoreLabel}>SAFE</Text>
          </View>
        </Pressable>

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
    paddingBottom: 30,
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
    backgroundColor: "#123426",
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
    color: "#55D68A",
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
    right: 337,
    bottom: 175,
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
  },

  tripScoreNumber: {
    color: "#55D68A",
    fontSize: 17,
    fontWeight: "900",
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