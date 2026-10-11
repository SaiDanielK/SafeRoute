import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Location from "expo-location";
import MapView, { Marker, MapPressEvent, Region } from "react-native-maps";

import { reportHazard, HazardType } from "../services/hazardService";

type Coordinates = { latitude: number; longitude: number };

const DEFAULT_REGION: Region = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: 25,
  longitudeDelta: 25,
};

const HAZARD_TYPES: {
  type: HazardType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { type: "accident", label: "Accident", icon: "car-outline" },
  { type: "road_closed", label: "Road Closed", icon: "close-circle-outline" },
  { type: "construction", label: "Construction", icon: "construct-outline" },
  { type: "unsafe_area", label: "Unsafe Area", icon: "warning-outline" },
  { type: "flooding", label: "Flooding", icon: "water-outline" },
  { type: "debris", label: "Debris", icon: "alert-circle-outline" },
  { type: "traffic", label: "Heavy Traffic", icon: "car-sport-outline" },
  { type: "other", label: "Other", icon: "ellipsis-horizontal-circle-outline" },
];

export default function ReportHazardScreen() {
  const [hazardType, setHazardType] = useState<HazardType>("other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [draftLocation, setDraftLocation] = useState<Coordinates | null>(null);
  const [pickerRegion, setPickerRegion] = useState<Region>(DEFAULT_REGION);
  const [mapLoadingLocation, setMapLoadingLocation] = useState(false);

  useEffect(() => {
    void loadLocation();
  }, []);

  async function loadLocation(): Promise<Coordinates | null> {
    try {
      setLocationLoading(true);
      setLocationError(null);

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationError(
          "Location permission was not granted. You can still choose the hazard location on the map."
        );
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setLatitude(coords.latitude);
      setLongitude(coords.longitude);
      setLocationError(null);
      return coords;
    } catch (error) {
      console.error("SafeRoute location error:", error);
      setLocationError(
        "Unable to get your current location. You can choose a location on the map instead."
      );
      return null;
    } finally {
      setLocationLoading(false);
    }
  }

  function openMapPicker() {
    const existing =
      latitude !== null && longitude !== null
        ? { latitude, longitude }
        : null;
    const start = existing ?? {
      latitude: DEFAULT_REGION.latitude,
      longitude: DEFAULT_REGION.longitude,
    };
    setDraftLocation(start);
    setPickerRegion({
      latitude: start.latitude,
      longitude: start.longitude,
      latitudeDelta: existing ? 0.025 : DEFAULT_REGION.latitudeDelta,
      longitudeDelta: existing ? 0.025 : DEFAULT_REGION.longitudeDelta,
    });
    setMapPickerVisible(true);
  }

  function handleMapPress(event: MapPressEvent) {
    const coordinate = event.nativeEvent.coordinate;
    setDraftLocation({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    });
  }

  async function useCurrentLocationInPicker() {
    try {
      setMapLoadingLocation(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Location Permission Needed",
          "Allow location access to center the map on you, or tap the map to choose a location manually."
        );
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setDraftLocation(coords);
      setPickerRegion({
        ...coords,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      });
    } catch (error) {
      console.error("SafeRoute map picker location error:", error);
      Alert.alert(
        "Could Not Get Location",
        "Your current location could not be retrieved. You can still tap the map to drop a pin."
      );
    } finally {
      setMapLoadingLocation(false);
    }
  }

  function confirmMapLocation() {
    if (!draftLocation) {
      Alert.alert(
        "Choose a Location",
        "Tap the map to drop a pin where the hazard is located."
      );
      return;
    }
    setLatitude(draftLocation.latitude);
    setLongitude(draftLocation.longitude);
    setLocationError(null);
    setMapPickerVisible(false);
  }

  async function handleSubmit() {
    if (submitting) return;

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (!cleanTitle) {
      Alert.alert("Missing Title", "Please enter a short title for the hazard.");
      return;
    }
    if (!cleanDescription) {
      Alert.alert("Missing Description", "Please describe the hazard.");
      return;
    }
    if (latitude === null || longitude === null) {
      Alert.alert(
        "Location Required",
        "Use your current location or choose the hazard location on the map before submitting."
      );
      return;
    }

    try {
      setSubmitting(true);
      console.log("SafeRoute: submitting hazard...", {
        hazardType,
        title: cleanTitle,
        latitude,
        longitude,
      });

      const hazardId = await reportHazard({
        type: hazardType,
        title: cleanTitle,
        description: cleanDescription,
        latitude,
        longitude,
      });

      console.log("SafeRoute: hazard submitted:", hazardId);
      Alert.alert(
        "Hazard Reported",
        "Thank you. Your report has been added to the SafeRoute community.",
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch (error) {
      console.error("SafeRoute: hazard submission failed:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while submitting your hazard report.";
      Alert.alert("Could Not Submit Report", message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>SAFEROUTE</Text>
          <Text style={styles.headerTitle}>Report a Hazard</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons name="shield-checkmark-outline" size={25} color="#64B5F6" />
          </View>
          <View style={styles.introText}>
            <Text style={styles.introTitle}>Help keep your community safe</Text>
            <Text style={styles.introDescription}>
              Report hazards you see so other SafeRoute users can be aware of potential dangers.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Hazard Type</Text>
        <View style={styles.typeGrid}>
          {HAZARD_TYPES.map((item) => {
            const selected = hazardType === item.type;
            return (
              <Pressable
                key={item.type}
                style={[styles.typeButton, selected && styles.typeButtonSelected]}
                onPress={() => setHazardType(item.type)}
              >
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={selected ? "#FFFFFF" : "#8FA4BD"}
                />
                <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>What happened?</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Example: Tree blocking sidewalk"
          placeholderTextColor="#687B92"
          maxLength={80}
          style={styles.input}
          returnKeyType="next"
        />
        <View style={styles.counterRow}>
          <Text style={styles.helperText}>Short title</Text>
          <Text style={styles.counter}>{title.length}/80</Text>
        </View>

        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the hazard and anything other users should know..."
          placeholderTextColor="#687B92"
          multiline
          textAlignVertical="top"
          maxLength={500}
          style={[styles.input, styles.descriptionInput]}
        />
        <View style={styles.counterRow}>
          <Text style={styles.helperText}>Be specific and factual</Text>
          <Text style={styles.counter}>{description.length}/500</Text>
        </View>

        <Text style={styles.sectionTitle}>Report Location</Text>
        <View style={styles.locationCard}>
          <View style={styles.locationIcon}>
            <Ionicons
              name={locationLoading ? "locate-outline" : latitude !== null ? "location" : "location-outline"}
              size={23}
              color="#64B5F6"
            />
          </View>
          <View style={styles.locationInfo}>
            <Text style={styles.locationTitle}>
              {locationLoading
                ? "Getting your location..."
                : latitude !== null
                ? "Hazard location selected"
                : "Choose a hazard location"}
            </Text>
            <Text style={styles.locationText}>
              {locationLoading
                ? "You can wait for GPS or select a pin on the map."
                : latitude !== null && longitude !== null
                ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                : locationError ?? "Use your location or choose a point on the map."}
            </Text>
          </View>
          <Pressable
            style={styles.locationRefresh}
            onPress={() => void loadLocation()}
            disabled={locationLoading}
            accessibilityRole="button"
            accessibilityLabel="Use my current location"
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color="#64B5F6" />
            ) : (
              <Ionicons name="locate" size={20} color="#64B5F6" />
            )}
          </Pressable>
        </View>

        <Pressable style={styles.chooseLocationButton} onPress={openMapPicker}>
          <Ionicons name="map-outline" size={20} color="#FFFFFF" />
          <Text style={styles.chooseLocationText}>Choose Location on Map / Drop a Pin</Text>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.mapHelperText}>
          The pin marks where the hazard is—not necessarily where you are. Tap the map or drag the pin, then confirm. Your hazard details will stay on this form.
        </Text>

        <View style={styles.warningCard}>
          <Ionicons name="information-circle-outline" size={22} color="#9DB0C5" />
          <Text style={styles.warningText}>
            Only report real hazards that could affect someone's safety. Do not include personal information about other people.
          </Text>
        </View>

        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={() => void handleSubmit()}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.submitText}>Submitting...</Text>
            </>
          ) : (
            <>
              <Ionicons name="send" size={19} color="#FFFFFF" />
              <Text style={styles.submitText}>Submit Hazard Report</Text>
            </>
          )}
        </Pressable>
        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal
        visible={mapPickerVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setMapPickerVisible(false)}
      >
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Pressable
              style={styles.pickerBackButton}
              onPress={() => setMapPickerVisible(false)}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
            <View style={styles.pickerHeaderText}>
              <Text style={styles.eyebrow}>SAFEROUTE</Text>
              <Text style={styles.pickerTitle}>Choose Hazard Location</Text>
            </View>
          </View>

          <View style={styles.pickerHint}>
            <Ionicons name="pin-outline" size={19} color="#64B5F6" />
            <Text style={styles.pickerHintText}>
              Tap anywhere on the map to drop a pin. You can also drag the pin to fine-tune the location.
            </Text>
          </View>

          <MapView
            style={styles.pickerMap}
            initialRegion={pickerRegion}
            onPress={handleMapPress}
            showsUserLocation
            showsMyLocationButton={false}
            toolbarEnabled={false}
            onRegionChangeComplete={(region) => setPickerRegion(region)}
          >
            {draftLocation && (
              <Marker
                coordinate={draftLocation}
                draggable
                title="Hazard location"
                description="Drag this pin to the exact hazard location"
                pinColor="#E85D5D"
                onDragEnd={(event) => {
                  const coordinate = event.nativeEvent.coordinate;
                  setDraftLocation({
                    latitude: coordinate.latitude,
                    longitude: coordinate.longitude,
                  });
                }}
              />
            )}
          </MapView>

          <View style={styles.pickerBottomPanel}>
            <Pressable
              style={styles.pickerCurrentLocationButton}
              onPress={() => void useCurrentLocationInPicker()}
              disabled={mapLoadingLocation}
            >
              {mapLoadingLocation ? (
                <ActivityIndicator size="small" color="#64B5F6" />
              ) : (
                <Ionicons name="locate-outline" size={20} color="#64B5F6" />
              )}
              <Text style={styles.pickerCurrentLocationText}>Use My Location</Text>
            </Pressable>

            <View style={styles.selectedCoordinatesCard}>
              <Ionicons name="location" size={20} color="#64B5F6" />
              <View style={styles.selectedCoordinatesInfo}>
                <Text style={styles.selectedCoordinatesTitle}>
                  {draftLocation ? "Selected coordinates" : "No pin selected"}
                </Text>
                <Text style={styles.selectedCoordinatesText}>
                  {draftLocation
                    ? `${draftLocation.latitude.toFixed(6)}, ${draftLocation.longitude.toFixed(6)}`
                    : "Tap the map to choose a location."}
                </Text>
              </View>
            </View>

            <Pressable style={styles.confirmLocationButton} onPress={confirmMapLocation}>
              <Ionicons name="checkmark-circle-outline" size={21} color="#FFFFFF" />
              <Text style={styles.confirmLocationText}>Confirm Location</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07111F" },
  header: {
    flexDirection: "row", alignItems: "center", paddingTop: 55,
    paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1,
    borderBottomColor: "#16283D",
  },
  backButton: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: "#102136",
    alignItems: "center", justifyContent: "center", marginRight: 13,
  },
  headerText: { flex: 1 },
  eyebrow: {
    fontSize: 11, fontWeight: "700", color: "#64B5F6",
    letterSpacing: 1.5, marginBottom: 3,
  },
  headerTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  introCard: {
    flexDirection: "row", backgroundColor: "#0D1D31", borderRadius: 18,
    borderWidth: 1, borderColor: "#1A314A", padding: 17, marginBottom: 25,
  },
  introIcon: {
    width: 48, height: 48, borderRadius: 15, backgroundColor: "#132B45",
    alignItems: "center", justifyContent: "center", marginRight: 13,
  },
  introText: { flex: 1 },
  introTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", marginBottom: 5 },
  introDescription: { color: "#8FA4BD", fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginBottom: 12 },
  typeGrid: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 25,
  },
  typeButton: {
    width: "48%", minHeight: 62, borderRadius: 15, backgroundColor: "#0D1D31",
    borderWidth: 1, borderColor: "#1A314A", flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, marginBottom: 10,
  },
  typeButtonSelected: { backgroundColor: "#1769AA", borderColor: "#64B5F6" },
  typeLabel: { color: "#8FA4BD", fontSize: 13, fontWeight: "600", marginLeft: 9, flexShrink: 1 },
  typeLabelSelected: { color: "#FFFFFF" },
  input: {
    minHeight: 52, backgroundColor: "#0D1D31", borderWidth: 1, borderColor: "#1A314A",
    borderRadius: 15, paddingHorizontal: 15, color: "#FFFFFF", fontSize: 14,
  },
  descriptionInput: { minHeight: 125, paddingTop: 14, paddingBottom: 14 },
  counterRow: {
    flexDirection: "row", justifyContent: "space-between", marginTop: 7, marginBottom: 15,
  },
  helperText: { color: "#60758C", fontSize: 11 },
  counter: { color: "#60758C", fontSize: 11 },
  locationCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#0D1D31",
    borderWidth: 1, borderColor: "#1A314A", borderRadius: 17, padding: 14, marginBottom: 12,
  },
  locationIcon: {
    width: 45, height: 45, borderRadius: 14, backgroundColor: "#132B45",
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  locationInfo: { flex: 1 },
  locationTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  locationText: { color: "#7F94AA", fontSize: 11, lineHeight: 16 },
  locationRefresh: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: "#132B45",
    alignItems: "center", justifyContent: "center", marginLeft: 8,
  },
  chooseLocationButton: {
    minHeight: 52, borderRadius: 15, backgroundColor: "#1769AA", flexDirection: "row",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 13, gap: 9,
  },
  chooseLocationText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", flex: 1, textAlign: "center" },
  mapHelperText: { color: "#71869D", fontSize: 11, lineHeight: 17, marginTop: 9, marginBottom: 19 },
  warningCard: {
    flexDirection: "row", alignItems: "flex-start", backgroundColor: "#0B1828",
    borderRadius: 15, borderWidth: 1, borderColor: "#172A40", padding: 14, marginBottom: 18,
  },
  warningText: { flex: 1, color: "#7F94AA", fontSize: 11, lineHeight: 17, marginLeft: 10 },
  submitButton: {
    minHeight: 56, borderRadius: 17, backgroundColor: "#1769AA", alignItems: "center",
    justifyContent: "center", flexDirection: "row", gap: 9,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  bottomSpace: { height: 35 },
  pickerContainer: { flex: 1, backgroundColor: "#07111F" },
  pickerHeader: {
    flexDirection: "row", alignItems: "center", paddingTop: Platform.OS === "ios" ? 55 : 25,
    paddingHorizontal: 18, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#16283D",
  },
  pickerBackButton: {
    width: 43, height: 43, borderRadius: 14, backgroundColor: "#102136",
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  pickerHeaderText: { flex: 1 },
  pickerTitle: { color: "#FFFFFF", fontSize: 19, fontWeight: "700" },
  pickerHint: {
    flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 17,
    paddingVertical: 12, backgroundColor: "#0D1D31",
  },
  pickerHintText: { color: "#A7B9CC", fontSize: 12, lineHeight: 17, flex: 1 },
  pickerMap: { flex: 1, width: "100%" },
  pickerBottomPanel: {
    backgroundColor: "#0A1727", paddingHorizontal: 17, paddingTop: 13,
    paddingBottom: Platform.OS === "ios" ? 28 : 17, borderTopWidth: 1, borderTopColor: "#1A314A",
  },
  pickerCurrentLocationButton: {
    minHeight: 43, borderRadius: 13, backgroundColor: "#132B45", flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 9, marginBottom: 11,
  },
  pickerCurrentLocationText: { color: "#D9E9F8", fontSize: 13, fontWeight: "600" },
  selectedCoordinatesCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#0D1D31",
    borderWidth: 1, borderColor: "#1A314A", borderRadius: 13, padding: 12, marginBottom: 11,
  },
  selectedCoordinatesInfo: { marginLeft: 10, flex: 1 },
  selectedCoordinatesTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", marginBottom: 3 },
  selectedCoordinatesText: { color: "#8FA4BD", fontSize: 12 },
  confirmLocationButton: {
    minHeight: 52, borderRadius: 15, backgroundColor: "#1769AA", flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 9,
  },
  confirmLocationText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
