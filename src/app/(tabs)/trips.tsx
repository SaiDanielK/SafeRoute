
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { firebaseApp } from "../../../src/firebase/firebaseConfig";
import { firebaseAuth } from "../../../src/firebase/auth";
import DestinationSearch from "../../components/DestinationSearch";
import {
  LocationShareStatus,
  subscribeToLocationSharing,
  startLocationSharing,
  stopLocationSharing,
} from "../../../src/services/locationSharingService";

const db = getFirestore(firebaseApp);
const DESTINATIONS_STORAGE_KEY = "@saferoute/saved_destinations";

type DestinationSlot = "home" | "school" | "custom";

type Destination = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type SavedDestination = Destination & {
  id: string;
  slot: DestinationSlot;
};

const EMPTY_STATUS: LocationShareStatus = {
  active: false,
  userId: "",
  latitude: null,
  longitude: null,
  mapUrl: null,
  updatedAt: null,
};

type RecentTrip = {
  id: string;
  originName: string;
  destinationName: string;
  distanceMeters: number;
  durationSeconds: number;
  safetyScore: number | null;
  travelMode: string;
  completedAt: Date | null;
};

function readTripDate(value: unknown): Date | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    try {
      return (value.toDate as () => Date)();
    } catch {
      return null;
    }
  }

  return null;
}

function isSavedDestination(value: unknown): value is SavedDestination {
  if (!value || typeof value !== "object") return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.address === "string" &&
    typeof item.latitude === "number" &&
    Number.isFinite(item.latitude) &&
    typeof item.longitude === "number" &&
    Number.isFinite(item.longitude) &&
    (item.slot === "home" ||
      item.slot === "school" ||
      item.slot === "custom")
  );
}

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "Distance unavailable";
  if (meters >= 1609.344) return `${(meters / 1609.344).toFixed(1)} mi`;
  return `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "Duration unavailable";

  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function formatTravelMode(mode: string): string {
  switch (mode) {
    case "foot-walking":
      return "Walking";
    case "cycling-regular":
      return "Cycling";
    case "driving-car":
      return "Driving";
    default:
      return mode
        ? mode.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
        : "Trip";
  }
}

function getTripIcon(mode: string): keyof typeof Ionicons.glyphMap {
  switch (mode) {
    case "foot-walking":
      return "walk";
    case "cycling-regular":
      return "bicycle";
    case "driving-car":
      return "car";
    default:
      return "navigate";
  }
}

function getDestinationIcon(slot: DestinationSlot): keyof typeof Ionicons.glyphMap {
  switch (slot) {
    case "home":
      return "home";
    case "school":
      return "school";
    default:
      return "bookmark";
  }
}

export default function TripsTab() {
  const [locationStatus, setLocationStatus] = useState<LocationShareStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(Boolean(firebaseAuth.currentUser));

  const [recentTrips, setRecentTrips] = useState<RecentTrip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState<string | null>(null);

  const [savedDestinations, setSavedDestinations] = useState<SavedDestination[]>([]);
  const [destinationsLoading, setDestinationsLoading] = useState(true);

  const [addDestinationVisible, setAddDestinationVisible] = useState(false);
  const [destinationName, setDestinationName] = useState("");

  // New: inline destination autocomplete state.
  const [searchVisible, setSearchVisible] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);

  const loadSavedDestinations = useCallback(async () => {
    setDestinationsLoading(true);

    try {
      const raw = await AsyncStorage.getItem(DESTINATIONS_STORAGE_KEY);

      if (!raw) {
        setSavedDestinations([]);
        return;
      }

      const parsed: unknown = JSON.parse(raw);
      setSavedDestinations(
        Array.isArray(parsed) ? parsed.filter(isSavedDestination) : []
      );
    } catch (error) {
      console.error("Failed to load saved destinations:", error);
      Alert.alert(
        "Saved destinations",
        "Your saved destinations couldn't be loaded. Please try again."
      );
    } finally {
      setDestinationsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSavedDestinations();
    }, [loadSavedDestinations])
  );

  useEffect(() => {
    return firebaseAuth.onAuthStateChanged((user) => {
      setSignedIn(Boolean(user));

      if (!user) {
        setLocationStatus(EMPTY_STATUS);
        setLoading(false);
        setRecentTrips([]);
        setTripsLoading(false);
        setTripsError(null);
      } else {
        setLoading(true);
        setTripsLoading(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setLocationStatus(EMPTY_STATUS);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    const unsubscribe = subscribeToLocationSharing(
      (status) => {
        if (!mounted) return;
        setLocationStatus(status);
        setLoading(false);
      },
      (error) => {
        if (!mounted) return;
        console.error("Trips location listener failed:", error);
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [signedIn]);

  useEffect(() => {
    const user = firebaseAuth.currentUser;

    if (!signedIn || !user) {
      setRecentTrips([]);
      setTripsLoading(false);
      setTripsError(null);
      return;
    }

    let mounted = true;
    setTripsLoading(true);
    setTripsError(null);

    const tripsQuery = query(
      collection(db, "trips"),
      where("userId", "==", user.uid),
      orderBy("completedAt", "desc"),
      limit(5)
    );

    const unsubscribe = onSnapshot(
      tripsQuery,
      (snapshot) => {
        if (!mounted) return;

        const trips: RecentTrip[] = snapshot.docs.map((tripDoc) => {
          const data = tripDoc.data();

          return {
            id: tripDoc.id,
            originName:
              typeof data.originName === "string" ? data.originName : "Starting point",
            destinationName:
              typeof data.destinationName === "string" ? data.destinationName : "Destination",
            distanceMeters:
              typeof data.distanceMeters === "number" ? data.distanceMeters : 0,
            durationSeconds:
              typeof data.durationSeconds === "number" ? data.durationSeconds : 0,
            safetyScore:
              typeof data.safetyScore === "number" ? data.safetyScore : null,
            travelMode:
              typeof data.travelMode === "string" ? data.travelMode : "",
            completedAt: readTripDate(data.completedAt),
          };
        });

        setRecentTrips(trips);
        setTripsLoading(false);
        setTripsError(null);
      },
      (error) => {
        if (!mounted) return;

        console.error("Failed to load recent trips:", error);
        setRecentTrips([]);
        setTripsLoading(false);

        setTripsError(
          error.code === "permission-denied"
            ? "SafeRoute doesn't have permission to read your trip history. Check your Firestore rules."
            : error.code === "failed-precondition"
              ? "Your trip-history query needs a Firestore index. Check the error in your development console."
              : "Couldn't load your trip history. Check your connection and try again."
        );
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [signedIn]);

  const openDestinationEditor = useCallback(
    (slot: DestinationSlot, name: string, existing?: SavedDestination) => {
      router.push({
        pathname: "/map",
        params: {
          saveSlot: slot,
          saveName: name,
          ...(existing ? { saveId: existing.id } : {}),
        },
      });
    },
    []
  );

  const openSavedDestination = useCallback((destination: SavedDestination) => {
    router.push({
      pathname: "/map",
      params: {
        routeDestinationName: destination.name,
        routeDestinationAddress: destination.address,
        routeDestinationLatitude: String(destination.latitude),
        routeDestinationLongitude: String(destination.longitude),
      },
    });
  }, []);

  // New: Go navigates to the map with the autocomplete selection.
  const goToSelectedDestination = useCallback(() => {
    if (!selectedDestination) {
      Alert.alert(
        "Choose a destination",
        "Type a place and select one of the autocomplete suggestions before tapping Go."
      );
      return;
    }

    const { name, address, latitude, longitude } = selectedDestination;

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      Alert.alert(
        "Invalid destination",
        "Please select a valid location from the suggestions."
      );
      return;
    }

    setSearchVisible(false);

    router.push({
      pathname: "/map",
      params: {
        routeDestinationName: name,
        routeDestinationAddress: address,
        routeDestinationLatitude: String(latitude),
        routeDestinationLongitude: String(longitude),
      },
    });
  }, [selectedDestination]);

  const handleSelectDestination = useCallback((destination: Destination) => {
    setSelectedDestination(destination);
  }, []);

  const saveDestinationList = useCallback(async (destinations: SavedDestination[]) => {
    await AsyncStorage.setItem(
      DESTINATIONS_STORAGE_KEY,
      JSON.stringify(destinations)
    );
    setSavedDestinations(destinations);
  }, []);

  const deleteSavedDestination = useCallback(
    (destination: SavedDestination) => {
      Alert.alert(
        "Delete destination?",
        `Remove "${destination.name}" from your saved destinations?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const updated = savedDestinations.filter(
                  (item) => item.id !== destination.id
                );
                await saveDestinationList(updated);
              } catch (error) {
                console.error("Failed to delete destination:", error);
                Alert.alert(
                  "Couldn't delete destination",
                  "Please try again."
                );
              }
            },
          },
        ]
      );
    },
    [savedDestinations, saveDestinationList]
  );

  const showSharingError = useCallback((error: unknown) => {
    console.error("Location-sharing action failed:", error);
    Alert.alert(
      "Couldn't update location sharing",
      error instanceof Error
        ? error.message
        : "Please check your connection and location permissions, then try again."
    );
  }, []);

  const beginSharing = useCallback(async () => {
    if (busy) return;

    if (!firebaseAuth.currentUser) {
      Alert.alert("Sign in required", "Sign in to use location sharing.");
      return;
    }

    setBusy(true);

    try {
      await startLocationSharing();
    } catch (error) {
      showSharingError(error);
    } finally {
      setBusy(false);
    }
  }, [busy, showSharingError]);

  const confirmStopSharing = useCallback(() => {
    if (busy) return;

    Alert.alert(
      "Stop location sharing?",
      "SafeRoute will mark your saved location share as inactive. It cannot retract a location link or message you've already sent.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop sharing",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await stopLocationSharing();
            } catch (error) {
              showSharingError(error);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }, [busy, showSharingError]);

  const handleLocationSharing = useCallback(() => {
    if (locationStatus.active) {
      confirmStopSharing();
    } else {
      void beginSharing();
    }
  }, [locationStatus.active, confirmStopSharing, beginSharing]);

  const openSharedLocation = useCallback(async () => {
    if (!locationStatus.mapUrl) return;

    try {
      await Linking.openURL(locationStatus.mapUrl);
    } catch {
      Alert.alert(
        "Couldn't open location",
        "Please try opening the saved location again."
      );
    }
  }, [locationStatus.mapUrl]);

  const retryTripHistory = useCallback(() => {
    Alert.alert(
      "Trip history",
      "If an index is missing, open the Firebase error details in your development console and follow the index link. Otherwise, check your connection and Firestore rules."
    );
  }, []);

  const formatUpdatedAt = useCallback(() => {
    if (!locationStatus.updatedAt) return "Update time is not available yet";
    return `Last updated ${locationStatus.updatedAt.toLocaleString()}`;
  }, [locationStatus.updatedAt]);

  const confirmAddDestination = useCallback(() => {
    const name = destinationName.trim();

    if (!name) {
      Alert.alert("Name required", "Enter a name for your destination.");
      return;
    }

    setAddDestinationVisible(false);
    setDestinationName("");
    openDestinationEditor("custom", name);
  }, [destinationName, openDestinationEditor]);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>SAFEROUTE TRIPS</Text>
            <Text style={styles.title}>Your Trips</Text>
            <Text style={styles.subtitle}>
              Plan safer journeys and manage your saved destinations.
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <Ionicons name="navigate" size={24} color="#4DA3FF" />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.planCard, pressed && styles.buttonPressed]}
          onPress={() => {
            setSearchVisible(true);
            setSelectedDestination(null);
          }}
        >
          <View style={styles.planIcon}>
            <Ionicons name="navigate-circle" size={28} color="#FFFFFF" />
          </View>

          <View style={styles.planContent}>
            <Text style={styles.planTitle}>Plan a trip</Text>
            <Text style={styles.planSubtitle}>
              Find a safer route to your destination.
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.searchBox,
            searchVisible && styles.searchBoxActive,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => {
            setSearchVisible(true);
            setSelectedDestination(null);
          }}
        >
          <Ionicons name="search" size={20} color="#7890AA" />
          <Text style={styles.searchText}>
            {selectedDestination
              ? selectedDestination.name
              : "Where do you want to go?"}
          </Text>
          <View style={styles.searchArrow}>
            <Ionicons
              name={searchVisible ? "chevron-up" : "arrow-forward"}
              size={17}
              color="#4DA3FF"
            />
          </View>
        </Pressable>

        {searchVisible && (
          <View style={styles.inlineSearchCard}>
            <View style={styles.inlineSearchHeader}>
              <View style={styles.inlineSearchHeading}>
                <Ionicons name="location" size={20} color="#20C997" />
                <Text style={styles.inlineSearchTitle}>Choose your destination</Text>
              </View>

              <Pressable
                accessibilityLabel="Close destination search"
                onPress={() => {
                  setSearchVisible(false);
                  setSelectedDestination(null);
                }}
                hitSlop={8}
                style={styles.closeSearchButton}
              >
                <Ionicons name="close" size={20} color="#A8B8C9" />
              </Pressable>
            </View>

            <DestinationSearch onSelectDestination={handleSelectDestination} />

            {selectedDestination && (
              <View style={styles.selectedDestination}>
                <View style={styles.selectedDestinationIcon}>
                  <Ionicons name="checkmark-circle" size={21} color="#55D68A" />
                </View>

                <View style={styles.selectedDestinationInfo}>
                  <Text style={styles.selectedDestinationName} numberOfLines={1}>
                    {selectedDestination.name}
                  </Text>
                  <Text style={styles.selectedDestinationAddress} numberOfLines={2}>
                    {selectedDestination.address}
                  </Text>
                </View>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.goButton,
                !selectedDestination && styles.goButtonDisabled,
                pressed && selectedDestination && styles.buttonPressed,
              ]}
              onPress={goToSelectedDestination}
              disabled={!selectedDestination}
            >
              <Ionicons name="navigate" size={19} color="#07111F" />
              <Text style={styles.goButtonText}>Go</Text>
              <Ionicons name="arrow-forward" size={18} color="#07111F" />
            </Pressable>

            <Text style={styles.searchHint}>
              Search for a place, select a suggestion, then tap Go.
            </Text>
          </View>
        )}

        {/* QUICK DESTINATIONS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick destinations</Text>
        </View>

        <View style={styles.destinationRow}>
          {(["home", "school"] as const).map((slot) => {
            const saved = savedDestinations.find((item) => item.slot === slot);

            return (
              <View key={slot} style={styles.destinationCard}>
                <Pressable
                  onPress={() => {
                    if (saved) {
                      openSavedDestination(saved);
                    } else {
                      openDestinationEditor(slot, slot === "home" ? "Home" : "School");
                    }
                  }}
                  style={({ pressed }) => [pressed && styles.buttonPressed]}
                >
                  <View style={styles.destinationIcon}>
                    <Ionicons
                      name={slot === "home" ? "home" : "school"}
                      size={21}
                      color={slot === "home" ? "#55D68A" : "#4DA3FF"}
                    />
                  </View>

                  <Text style={styles.destinationTitle}>
                    {slot === "home" ? "Home" : "School"}
                  </Text>

                  <Text style={styles.destinationSubtitle} numberOfLines={2}>
                    {destinationsLoading
                      ? "Loading..."
                      : saved
                        ? saved.address
                        : "Tap to set address"}
                  </Text>
                </Pressable>

                {saved && (
                  <Pressable
                    style={styles.destinationEditButton}
                    onPress={() => openDestinationEditor(slot, saved.name, saved)}
                  >
                    <Ionicons name="pencil" size={13} color="#4DA3FF" />
                    <Text style={styles.destinationEditText}>Edit</Text>
                  </Pressable>
                )}
              </View>
            );
          })}

          <Pressable
            style={({ pressed }) => [
              styles.destinationCard,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {
              setDestinationName("");
              setAddDestinationVisible(true);
            }}
          >
            <View style={styles.destinationIcon}>
              <Ionicons name="add" size={23} color="#A78BFA" />
            </View>
            <Text style={styles.destinationTitle}>Add</Text>
            <Text style={styles.destinationSubtitle}>New destination</Text>
          </Pressable>
        </View>

        {/* MANAGE DESTINATIONS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Manage destinations</Text>
          <Text style={styles.tripCount}>
            {destinationsLoading ? "…" : `${savedDestinations.length} saved`}
          </Text>
        </View>

        {destinationsLoading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color="#20C997" />
            <Text style={styles.loadingTripsText}>Loading saved destinations...</Text>
          </View>
        ) : savedDestinations.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bookmark-outline" size={28} color="#4DA3FF" />
            </View>
            <Text style={styles.emptyTitle}>No saved destinations yet</Text>
            <Text style={styles.emptySubtitle}>
              Set your Home or School address, or add a custom destination.
            </Text>
          </View>
        ) : (
          <View style={styles.tripsList}>
            {savedDestinations.map((destination) => (
              <View key={destination.id} style={styles.tripCard}>
                <View style={styles.tripIcon}>
                  <Ionicons
                    name={getDestinationIcon(destination.slot)}
                    size={21}
                    color="#55D68A"
                  />
                </View>

                <Pressable
                  style={styles.tripInfo}
                  onPress={() => openSavedDestination(destination)}
                >
                  <Text style={styles.tripTitle}>{destination.name}</Text>
                  <Text style={styles.tripDetails} numberOfLines={2}>
                    {destination.address}
                  </Text>
                  <Text style={styles.tripMode}>Tap to calculate route</Text>
                </Pressable>

                <View style={styles.destinationActions}>
                  <Pressable
                    accessibilityLabel={`Edit ${destination.name}`}
                    style={styles.destinationAction}
                    onPress={() =>
                      openDestinationEditor(destination.slot, destination.name, destination)
                    }
                  >
                    <Ionicons name="pencil-outline" size={18} color="#4DA3FF" />
                  </Pressable>

                  <Pressable
                    accessibilityLabel={`Delete ${destination.name}`}
                    style={styles.destinationAction}
                    onPress={() => deleteSavedDestination(destination)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF8585" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ADD DESTINATION MODAL */}
        <Modal
          visible={addDestinationVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAddDestinationVisible(false)}
        >
          <View style={styles.destinationModalBackdrop}>
            <View style={styles.destinationModal}>
              <Text style={styles.destinationModalTitle}>Add a destination</Text>
              <Text style={styles.destinationModalSubtitle}>
                Give this place a name. You will choose its address on the map next.
              </Text>

              <TextInput
                value={destinationName}
                onChangeText={setDestinationName}
                placeholder="e.g. Library, Gym, Friend's house"
                placeholderTextColor="#7189A5"
                style={styles.destinationNameInput}
                autoFocus
                maxLength={60}
                returnKeyType="done"
                onSubmitEditing={confirmAddDestination}
              />

              <View style={styles.destinationModalButtons}>
                <Pressable
                  style={styles.destinationCancelButton}
                  onPress={() => setAddDestinationVisible(false)}
                >
                  <Text style={styles.destinationCancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={styles.destinationSaveButton}
                  onPress={confirmAddDestination}
                >
                  <Text style={styles.destinationSaveText}>Choose address</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* LOCATION SHARING */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Location sharing</Text>

          <View
            style={[
              styles.statusBadge,
              locationStatus.active
                ? styles.statusBadgeActive
                : styles.statusBadgeInactive,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                locationStatus.active
                  ? styles.statusDotActive
                  : styles.statusDotInactive,
              ]}
            />
            <Text style={styles.statusBadgeText}>
              {loading
                ? "CHECKING"
                : locationStatus.active
                  ? "ACTIVE"
                  : "INACTIVE"}
            </Text>
          </View>
        </View>

        <View style={styles.sharingCard}>
          <View style={styles.sharingHeader}>
            <View style={styles.sharingIcon}>
              <Ionicons
                name="location"
                size={23}
                color={locationStatus.active ? "#55D68A" : "#4DA3FF"}
              />
            </View>

            <View style={styles.sharingInfo}>
              <Text style={styles.sharingTitle}>
                {locationStatus.active ? "Location snapshot saved" : "Share your location"}
              </Text>
              <Text style={styles.sharingSubtitle}>
                {loading
                  ? "Checking sharing status..."
                  : !signedIn
                    ? "Sign in to manage location sharing."
                    : locationStatus.active
                      ? "Your saved location share is marked active."
                      : "Share your current position with someone you trust."}
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#20C997" />
              <Text style={styles.loadingText}>Loading sharing status...</Text>
            </View>
          ) : (
            <>
              {locationStatus.active && (
                <View style={styles.locationDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={16} color="#7890AA" />
                    <Text style={styles.detailText}>{formatUpdatedAt()}</Text>
                  </View>

                  {locationStatus.latitude !== null &&
                    locationStatus.longitude !== null && (
                      <Text style={styles.coordinates}>
                        {locationStatus.latitude.toFixed(5)},{" "}
                        {locationStatus.longitude.toFixed(5)}
                      </Text>
                    )}

                  {locationStatus.mapUrl && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.openLocationButton,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={openSharedLocation}
                    >
                      <Ionicons name="map-outline" size={17} color="#4DA3FF" />
                      <Text style={styles.openLocationText}>Open saved location</Text>
                    </Pressable>
                  )}
                </View>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.sharingButton,
                  locationStatus.active && styles.stopButton,
                  pressed && styles.buttonPressed,
                  busy && styles.buttonBusy,
                ]}
                onPress={handleLocationSharing}
                disabled={busy || loading}
              >
                {busy ? (
                  <ActivityIndicator color="#07111F" />
                ) : (
                  <>
                    <Ionicons
                      name={locationStatus.active ? "stop-circle-outline" : "share-social-outline"}
                      size={19}
                      color="#07111F"
                    />
                    <Text style={styles.sharingButtonText}>
                      {locationStatus.active ? "Stop sharing" : "Share my location"}
                    </Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </View>

        {/* RECENT TRIPS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent trips</Text>
          <Text style={styles.tripCount}>{tripsLoading ? "…" : `${recentTrips.length}`}</Text>
        </View>

        {tripsLoading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color="#20C997" size="small" />
            <Text style={styles.loadingTripsText}>Loading your completed trips...</Text>
          </View>
        ) : tripsError ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="alert-circle-outline" size={28} color="#FFC857" />
            </View>
            <Text style={styles.emptyTitle}>Couldn't load trip history</Text>
            <Text style={styles.emptySubtitle}>{tripsError}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.emptyButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={retryTripHistory}
            >
              <Ionicons name="information-circle-outline" size={17} color="#07111F" />
              <Text style={styles.emptyButtonText}>Troubleshoot</Text>
            </Pressable>
          </View>
        ) : recentTrips.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="footsteps-outline" size={28} color="#4DA3FF" />
            </View>
            <Text style={styles.emptyTitle}>No completed trips yet</Text>
            <Text style={styles.emptySubtitle}>
              Once SafeRoute saves a completed journey to your account, it will appear here automatically.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.emptyButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => router.push("/map")}
            >
              <Ionicons name="navigate" size={17} color="#07111F" />
              <Text style={styles.emptyButtonText}>Plan a trip</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.tripsList}>
            {recentTrips.map((trip) => (
              <View key={trip.id} style={styles.tripCard}>
                <View style={styles.tripIcon}>
                  <Ionicons
                    name={getTripIcon(trip.travelMode)}
                    size={21}
                    color="#55D68A"
                  />
                </View>

                <View style={styles.tripInfo}>
                  <Text style={styles.tripTitle} numberOfLines={2}>
                    {trip.originName} → {trip.destinationName}
                  </Text>
                  <Text style={styles.tripDetails}>
                    {formatDistance(trip.distanceMeters)} · {formatDuration(trip.durationSeconds)}
                  </Text>
                  <Text style={styles.tripMode}>
                    {formatTravelMode(trip.travelMode)}
                    {trip.completedAt ? ` · ${trip.completedAt.toLocaleDateString()}` : ""}
                  </Text>
                </View>

                {trip.safetyScore !== null &&
                trip.safetyScore >= 0 &&
                trip.safetyScore <= 100 ? (
                  <View style={styles.tripScore}>
                    <Text style={styles.tripScoreNumber}>{Math.round(trip.safetyScore)}</Text>
                    <Text style={styles.tripScoreLabel}>/100</Text>
                  </View>
                ) : (
                  <View style={styles.noScore}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#7890AA" />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* TRUSTED CONTACTS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trusted contacts</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.addPersonButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.push("/emergency")}
        >
          <View style={styles.addPersonIcon}>
            <Ionicons name="people" size={19} color="#4DA3FF" />
          </View>

          <View style={styles.addPersonText}>
            <Text style={styles.addPersonTitle}>Manage trusted contacts</Text>
            <Text style={styles.addPersonSubtitle}>
              View and manage your emergency contacts
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={20} color="#7890AA" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.mapButton, pressed && styles.buttonPressed]}
          onPress={() => router.push("/map")}
        >
          <Ionicons name="map" size={20} color="#FFFFFF" />
          <Text style={styles.mapButtonText}>Open SafeRoute Map</Text>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </Pressable>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07111F" },
  content: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 70 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 25 },
  headerText: { flex: 1, paddingRight: 12 },
  eyebrow: { color: "#4DA3FF", fontSize: 11, fontWeight: "800", letterSpacing: 1.8, marginBottom: 5 },
  title: { color: "#FFFFFF", fontSize: 29, fontWeight: "900", marginBottom: 5 },
  subtitle: { color: "#8095AE", fontSize: 12, maxWidth: 275, lineHeight: 18 },
  headerIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#12263F", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#24415F" },

  planCard: { backgroundColor: "#1A4F7A", borderRadius: 21, padding: 17, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#316F9E", marginBottom: 12 },
  planIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: "#24699A", alignItems: "center", justifyContent: "center", marginRight: 13 },
  planContent: { flex: 1 },
  planTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", marginBottom: 4 },
  planSubtitle: { color: "#C7E4F8", fontSize: 10, lineHeight: 15 },

  searchBox: { backgroundColor: "#0E1D30", borderRadius: 17, padding: 14, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#1D334F", marginBottom: 12 },
  searchBoxActive: { borderColor: "#20C997" },
  searchText: { color: "#7890AA", fontSize: 13, marginLeft: 11, flex: 1 },
  searchArrow: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#122A43", alignItems: "center", justifyContent: "center" },

  inlineSearchCard: { backgroundColor: "#0E1D30", borderRadius: 18, padding: 13, borderWidth: 1, borderColor: "#24415F", marginBottom: 28 },
  inlineSearchHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  inlineSearchHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  inlineSearchTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  closeSearchButton: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#172A40", alignItems: "center", justifyContent: "center" },
  selectedDestination: { flexDirection: "row", alignItems: "center", backgroundColor: "#0A1727", borderRadius: 12, padding: 11, marginTop: 12, borderWidth: 1, borderColor: "#24415F" },
  selectedDestinationIcon: { marginRight: 10 },
  selectedDestinationInfo: { flex: 1 },
  selectedDestinationName: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  selectedDestinationAddress: { color: "#8095AE", fontSize: 11, marginTop: 4, lineHeight: 16 },
  goButton: { backgroundColor: "#20C997", borderRadius: 13, paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 13 },
  goButtonDisabled: { backgroundColor: "#365266", opacity: 0.7 },
  goButtonText: { color: "#07111F", fontSize: 14, fontWeight: "900" },
  searchHint: { color: "#7189A5", fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 10 },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 13 },
  sectionTitle: { color: "#FFFFFF", fontSize: 19, fontWeight: "800" },
  destinationRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 28 },
  destinationCard: { flex: 1, minWidth: 0, backgroundColor: "#0E1D30", borderRadius: 17, padding: 11, borderWidth: 1, borderColor: "#1D334F" },
  destinationIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: "#12263F", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  destinationTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", marginBottom: 4 },
  destinationSubtitle: { color: "#8095AE", fontSize: 9, lineHeight: 13, minHeight: 26 },
  destinationEditButton: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingTop: 9, gap: 5 },
  destinationEditText: { color: "#4DA3FF", fontSize: 10, fontWeight: "800" },
  destinationActions: { alignItems: "center", justifyContent: "center", gap: 8 },
  destinationAction: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#172A40", alignItems: "center", justifyContent: "center" },

  destinationModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", padding: 24 },
  destinationModal: { backgroundColor: "#0E1D30", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#24415F" },
  destinationModalTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", marginBottom: 8 },
  destinationModalSubtitle: { color: "#8095AE", fontSize: 12, lineHeight: 18, marginBottom: 16 },
  destinationNameInput: { backgroundColor: "#07111F", borderWidth: 1, borderColor: "#24415F", borderRadius: 12, paddingHorizontal: 13, paddingVertical: 13, color: "#FFFFFF", fontSize: 14 },
  destinationModalButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 18 },
  destinationCancelButton: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 11, backgroundColor: "#172A40" },
  destinationCancelText: { color: "#C7D5E5", fontSize: 12, fontWeight: "800" },
  destinationSaveButton: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 11, backgroundColor: "#20C997" },
  destinationSaveText: { color: "#07111F", fontSize: 12, fontWeight: "900" },

  statusBadge: { flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 13 },
  statusBadgeActive: { backgroundColor: "#123426" },
  statusBadgeInactive: { backgroundColor: "#172A40" },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  statusDotActive: { backgroundColor: "#55D68A" },
  statusDotInactive: { backgroundColor: "#7890AA" },
  statusBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  sharingCard: { backgroundColor: "#0E1D30", borderRadius: 19, padding: 16, borderWidth: 1, borderColor: "#1D334F", marginBottom: 28 },
  sharingHeader: { flexDirection: "row", alignItems: "center" },
  sharingIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#12263F", alignItems: "center", justifyContent: "center", marginRight: 12 },
  sharingInfo: { flex: 1 },
  sharingTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", marginBottom: 5 },
  sharingSubtitle: { color: "#7189A5", fontSize: 10, lineHeight: 15 },
  loadingRow: { flexDirection: "row", alignItems: "center", marginTop: 18 },
  loadingText: { color: "#A8B8C9", fontSize: 11, marginLeft: 10 },
  locationDetails: { backgroundColor: "#0A1727", borderRadius: 13, padding: 12, marginTop: 15 },
  detailRow: { flexDirection: "row", alignItems: "center" },
  detailText: { color: "#A8B8C9", fontSize: 10, marginLeft: 7, flex: 1 },
  coordinates: { color: "#7189A5", fontSize: 10, marginTop: 8 },
  openLocationButton: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: 12, paddingVertical: 5 },
  openLocationText: { color: "#4DA3FF", fontSize: 11, fontWeight: "800", marginLeft: 7 },
  sharingButton: { backgroundColor: "#20C997", borderRadius: 13, paddingVertical: 14, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16 },
  stopButton: { backgroundColor: "#FF8585" },
  buttonPressed: { opacity: 0.75 },
  buttonBusy: { opacity: 0.65 },
  sharingButtonText: { color: "#07111F", fontSize: 12, fontWeight: "900", marginLeft: 8 },
  disclaimer: { color: "#637C97", fontSize: 9, lineHeight: 14, marginTop: 13 },

  tripCount: { color: "#7890AA", fontSize: 12, fontWeight: "800" },
  tripsList: { marginBottom: 28 },
  tripCard: { backgroundColor: "#0E1D30", borderRadius: 17, padding: 13, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#1D334F", marginBottom: 10 },
  tripIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: "#12263F", alignItems: "center", justifyContent: "center", marginRight: 12 },
  tripInfo: { flex: 1, paddingRight: 8 },
  tripTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", lineHeight: 17 },
  tripDetails: { color: "#A8B8C9", fontSize: 10, marginTop: 5 },
  tripMode: { color: "#7189A5", fontSize: 9, marginTop: 4 },
  tripScore: { minWidth: 43, minHeight: 43, borderRadius: 13, backgroundColor: "#123426", alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  tripScoreNumber: { color: "#55D68A", fontSize: 16, fontWeight: "900" },
  tripScoreLabel: { color: "#9AB9A8", fontSize: 8, fontWeight: "800" },
  noScore: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#172A40", alignItems: "center", justifyContent: "center" },
  loadingTripsText: { color: "#A8B8C9", fontSize: 11, marginTop: 12 },
  emptyCard: { backgroundColor: "#0E1D30", borderRadius: 18, padding: 20, borderWidth: 1, borderColor: "#1D334F", alignItems: "center", marginBottom: 28 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#12263F", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", textAlign: "center" },
  emptySubtitle: { color: "#7189A5", fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 7, marginBottom: 16 },
  emptyButton: { backgroundColor: "#20C997", borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  emptyButtonText: { color: "#07111F", fontSize: 12, fontWeight: "900" },
  addPersonButton: { backgroundColor: "#12263F", borderRadius: 18, padding: 13, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#24415F", marginBottom: 28 },
  addPersonIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#183552", alignItems: "center", justifyContent: "center", marginRight: 12 },
  addPersonText: { flex: 1 },
  addPersonTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", marginBottom: 3 },
  addPersonSubtitle: { color: "#7189A5", fontSize: 9 },
  mapButton: { backgroundColor: "#1E5B8C", borderRadius: 18, padding: 15, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#3275A8" },
  mapButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", flex: 1, marginLeft: 10 },
  bottomSpace: { height: 20 },
});