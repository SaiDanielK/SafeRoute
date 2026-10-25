
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
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { firebaseApp } from "../../../src/firebase/firebaseConfig";
import { firebaseAuth } from "../../../src/firebase/auth";
import {
  LocationShareStatus,
  subscribeToLocationSharing,
  startLocationSharing,
  stopLocationSharing,
} from "../../../src/services/locationSharingService";

const db = getFirestore(firebaseApp);

type TrustedContact = {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  userId: string;
};

const EMPTY_FORM = {
  name: "",
  relationship: "",
  phone: "",
};

const EMPTY_LOCATION_STATUS: LocationShareStatus = {
  active: false,
  userId: "",
  latitude: null,
  longitude: null,
  mapUrl: null,
  updatedAt: null,
};

export default function EmergencyTab() {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] =
    useState<TrustedContact | null>(null);

  const [name, setName] = useState(EMPTY_FORM.name);
  const [relationship, setRelationship] = useState(
    EMPTY_FORM.relationship
  );
  const [phone, setPhone] = useState(EMPTY_FORM.phone);

  const [locationStatus, setLocationStatus] =
    useState<LocationShareStatus>(EMPTY_LOCATION_STATUS);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);

  // Listen for changes to the signed-in user's trusted contacts.
  useEffect(() => {
    const currentUser = firebaseAuth.currentUser;

    if (!currentUser) {
      setContacts([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const contactsQuery = query(
      collection(db, "trustedContacts"),
      where("userId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      contactsQuery,
      (snapshot) => {
        const savedContacts: TrustedContact[] = snapshot.docs.map(
          (item) => {
            const data = item.data();

            return {
              id: item.id,
              name: String(data.name ?? ""),
              relationship: String(data.relationship ?? ""),
              phone: String(data.phone ?? ""),
              userId: String(data.userId ?? ""),
            };
          }
        );

        savedContacts.sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        setContacts(savedContacts);
        setLoading(false);
      },
      (error) => {
        console.error("Trusted contacts listener failed:", error);
        setLoading(false);

        Alert.alert(
          "Couldn't load contacts",
          "SafeRoute couldn't load your trusted contacts. Check your connection and Firestore permissions."
        );
      }
    );

    return unsubscribe;
  }, []);

  // Subscribe to the same shared location service used by Trips.
  useEffect(() => {
    setLocationLoading(true);

    const unsubscribe = subscribeToLocationSharing(
      (status) => {
        setLocationStatus(status);
        setLocationLoading(false);
      },
      (error) => {
        console.error(
          "Emergency location-sharing listener failed:",
          error
        );
        setLocationLoading(false);

        Alert.alert(
          "Couldn't load location status",
          "SafeRoute couldn't load your location-sharing status. Check your connection and Firestore permissions."
        );
      }
    );

    return unsubscribe;
  }, []);

  const resetForm = useCallback(() => {
    setName("");
    setRelationship("");
    setPhone("");
    setEditingContact(null);
  }, []);

  const openAddContact = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditContact = (contact: TrustedContact) => {
    setEditingContact(contact);
    setName(contact.name);
    setRelationship(contact.relationship);
    setPhone(contact.phone);
    setModalVisible(true);
  };

  const closeForm = () => {
    if (saving) return;
    setModalVisible(false);
    resetForm();
  };

  const saveContact = async () => {
    const currentUser = firebaseAuth.currentUser;
    const cleanName = name.trim();
    const cleanRelationship = relationship.trim();
    const cleanPhone = phone.trim();

    if (!currentUser) {
      Alert.alert(
        "Sign in required",
        "Please sign in to save trusted contacts."
      );
      return;
    }

    if (!cleanName || !cleanPhone) {
      Alert.alert(
        "Missing information",
        "Enter the contact's name and phone number."
      );
      return;
    }

    const normalizedPhone = cleanPhone.replace(/[\s().-]/g, "");

    if (!/^\+?\d{7,15}$/.test(normalizedPhone)) {
      Alert.alert(
        "Check phone number",
        "Enter a valid phone number, including the country code if needed."
      );
      return;
    }

    setSaving(true);

    try {
      if (editingContact) {
        if (editingContact.userId !== currentUser.uid) {
          throw new Error("You cannot edit another user's contact.");
        }

        await updateDoc(
          doc(db, "trustedContacts", editingContact.id),
          {
            name: cleanName,
            relationship: cleanRelationship,
            phone: cleanPhone,
            updatedAt: serverTimestamp(),
          }
        );
      } else {
        await addDoc(collection(db, "trustedContacts"), {
          userId: currentUser.uid,
          name: cleanName,
          relationship: cleanRelationship,
          phone: cleanPhone,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setModalVisible(false);
      resetForm();
    } catch (error) {
      console.error("Failed to save trusted contact:", error);

      Alert.alert(
        "Couldn't save contact",
        "Please try again. If the problem continues, check your Firestore security rules for trusted contacts."
      );
    } finally {
      setSaving(false);
    }
  };

  const callContact = async (contact: TrustedContact) => {
    const phoneNumber = contact.phone.replace(/[^\d+]/g, "");
    const url = `tel:${phoneNumber}`;

    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert(
          "Calling unavailable",
          "This device cannot open the phone dialer."
        );
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Couldn't start call",
        "Try calling this contact using your phone app."
      );
    }
  };

  const confirmDeleteContact = (contact: TrustedContact) => {
    Alert.alert(
      "Remove trusted contact?",
      `Remove ${contact.name} from your trusted contacts?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const currentUser = firebaseAuth.currentUser;

            if (!currentUser || contact.userId !== currentUser.uid) {
              Alert.alert(
                "Unable to remove",
                "You can only remove contacts from your own account."
              );
              return;
            }

            try {
              await deleteDoc(
                doc(db, "trustedContacts", contact.id)
              );
            } catch (error) {
              console.error("Failed to remove contact:", error);

              Alert.alert(
                "Couldn't remove contact",
                "Please check your connection and Firestore permissions."
              );
            }
          },
        },
      ]
    );
  };

  const call911 = async () => {
    try {
      await Linking.openURL("tel:911");
    } catch {
      Alert.alert(
        "Unable to open phone",
        "Please dial 911 directly if you are in immediate danger."
      );
    }
  };

  const handleSOS = () => {
    Alert.alert(
      "Emergency SOS",
      "This will open the phone dialer for emergency services. In a real emergency, call 911 immediately.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call 911",
          style: "destructive",
          onPress: call911,
        },
      ]
    );
  };

  const openSharedLocation = async () => {
    if (!locationStatus.mapUrl) {
      Alert.alert(
        "Location unavailable",
        "There is no saved location link to open."
      );
      return;
    }

    try {
      await Linking.openURL(locationStatus.mapUrl);
    } catch {
      Alert.alert(
        "Couldn't open location",
        "Please try opening the saved location again."
      );
    }
  };

  const handleLocationSharing = async () => {
    if (locationBusy) return;

    const currentUser = firebaseAuth.currentUser;

    if (!currentUser) {
      Alert.alert(
        "Sign in required",
        "Please sign in to use location sharing."
      );
      return;
    }

    if (locationStatus.active) {
      const options: Array<{
        text: string;
        style?: "cancel" | "destructive" | "default";
        onPress?: () => void;
      }> = [
        { text: "Cancel", style: "cancel" },
      ];

      if (locationStatus.mapUrl) {
        options.push({
          text: "Open location",
          onPress: () => {
            void openSharedLocation();
          },
        });
      }

      options.push({
        text: "Share again",
        onPress: () => {
          void startNewLocationShare();
        },
      });

      options.push({
        text: "Stop sharing",
        style: "destructive",
        onPress: () => {
          void stopCurrentLocationShare();
        },
      });

      Alert.alert(
        "Location sharing",
        "Your latest location snapshot is saved. You can open its map link, share a fresh snapshot, or stop sharing.",
        options
      );

      return;
    }

    await startNewLocationShare();
  };

  const startNewLocationShare = async () => {
    if (locationBusy) return;

    setLocationBusy(true);

    try {
      await startLocationSharing();

      Alert.alert(
        "Location snapshot saved",
        "SafeRoute saved your current location and opened the native share sheet. Choose an app or contact there if you want to send the map link. If you dismissed the share sheet, you can share the saved link again from Emergency Center."
      );
    } catch (error) {
      console.error("Couldn't start location sharing:", error);

      Alert.alert(
        "Couldn't share location",
        error instanceof Error
          ? error.message
          : "Please check your location permission and internet connection, then try again."
      );
    } finally {
      setLocationBusy(false);
    }
  };

  const stopCurrentLocationShare = async () => {
    if (locationBusy) return;

    setLocationBusy(true);

    try {
      await stopLocationSharing();

      Alert.alert(
        "Location sharing stopped",
        "SafeRoute has marked your saved location share as inactive."
      );
    } catch (error) {
      console.error("Couldn't stop location sharing:", error);

      Alert.alert(
        "Couldn't stop sharing",
        error instanceof Error
          ? error.message
          : "Please try again and check your connection."
      );
    } finally {
      setLocationBusy(false);
    }
  };

  const formatLocationUpdateTime = () => {
    if (!locationStatus.updatedAt) {
      return "Update time unavailable";
    }

    return locationStatus.updatedAt.toLocaleString();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>SAFEROUTE EMERGENCY</Text>
            <Text style={styles.title}>Emergency Center</Text>
            <Text style={styles.subtitle}>
              Quick access to emergency tools when you need them.
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <Ionicons name="shield" size={25} color="#FF6B6B" />
          </View>
        </View>

        <View style={styles.sosCard}>
          <Text style={styles.sosLabel}>EMERGENCY SOS</Text>

          <Text style={styles.sosDescription}>
            If you are in immediate danger, use SOS to contact
            emergency services.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.sosButton,
              pressed && styles.sosButtonPressed,
            ]}
            onPress={handleSOS}
          >
            <View style={styles.sosInner}>
              <Ionicons name="warning" size={38} color="#FFFFFF" />
              <Text style={styles.sosText}>SOS</Text>
              <Text style={styles.sosSmallText}>TAP FOR HELP</Text>
            </View>
          </Pressable>

          <Text style={styles.sosNote}>
            In the United States, emergency services can be reached
            at 911.
          </Text>
        </View>

        <Pressable style={styles.callCard} onPress={call911}>
          <View style={styles.callIcon}>
            <Ionicons name="call" size={24} color="#FFFFFF" />
          </View>

          <View style={styles.callContent}>
            <Text style={styles.callTitle}>Call 911</Text>
            <Text style={styles.callSubtitle}>
              Contact emergency services directly
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={21} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.sectionTitle}>Emergency actions</Text>

        <View style={styles.actionGrid}>
          <Pressable
            style={styles.actionCard}
            onPress={handleLocationSharing}
            disabled={locationBusy || locationLoading}
          >
            <View style={styles.actionIcon}>
              {locationBusy || locationLoading ? (
                <ActivityIndicator color="#4DA3FF" size="small" />
              ) : (
                <Ionicons
                  name="location"
                  size={22}
                  color="#4DA3FF"
                />
              )}
            </View>

            <Text style={styles.actionTitle}>
              {locationBusy
                ? "Please wait..."
                : locationStatus.active
                  ? "Manage location"
                  : "Share location"}
            </Text>

            <Text style={styles.actionSubtitle}>
              {locationLoading
                ? "Checking sharing status..."
                : locationStatus.active
                  ? "Location sharing is active"
                  : "Share your current location snapshot"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={openAddContact}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="people" size={22} color="#A78BFA" />
            </View>
            <Text style={styles.actionTitle}>Trusted contacts</Text>
            <Text style={styles.actionSubtitle}>
              Manage your emergency contacts
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Trip safety</Text>

        <View style={styles.tripCard}>
          <View style={styles.tripHeader}>
            <View style={styles.tripIcon}>
              <Ionicons
                name={locationStatus.active ? "location" : "navigate"}
                size={21}
                color="#55D68A"
              />
            </View>

            <View style={styles.tripInfo}>
              <Text style={styles.tripTitle}>
                {locationLoading
                  ? "Checking location status..."
                  : locationStatus.active
                    ? "Location sharing is active"
                    : "No active location share"}
              </Text>

              <Text style={styles.tripSubtitle}>
                {locationLoading
                  ? "Loading your saved sharing status."
                  : locationStatus.active
                    ? "A location snapshot is saved. Your position is not updating continuously."
                    : "Share your current location snapshot when you need someone to have your map link."}
              </Text>
            </View>
          </View>

          {locationStatus.active && (
            <>
              <View style={styles.tripDivider} />

              <View style={styles.locationDetails}>
                <View style={styles.locationDetailRow}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color="#7189A5"
                  />
                  <Text style={styles.locationDetailText}>
                    Last updated: {formatLocationUpdateTime()}
                  </Text>
                </View>

                {locationStatus.latitude !== null &&
                  locationStatus.longitude !== null && (
                    <Text style={styles.coordinatesText}>
                      {locationStatus.latitude.toFixed(5)},{" "}
                      {locationStatus.longitude.toFixed(5)}
                    </Text>
                  )}

                {locationStatus.mapUrl && (
                  <Pressable
                    style={styles.openLocationButton}
                    onPress={openSharedLocation}
                  >
                    <Ionicons
                      name="map-outline"
                      size={17}
                      color="#4DA3FF"
                    />
                    <Text style={styles.openLocationText}>
                      Open saved location
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.stopSharingButton,
                    pressed && styles.stopSharingButtonPressed,
                    locationBusy && styles.buttonDisabled,
                  ]}
                  onPress={stopCurrentLocationShare}
                  disabled={locationBusy}
                >
                  {locationBusy ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons
                        name="stop-circle-outline"
                        size={17}
                        color="#FFFFFF"
                      />
                      <Text style={styles.stopSharingText}>
                        Stop sharing
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          )}

          <View style={styles.tripDivider} />

          <View style={styles.tripFeatures}>
            <View style={styles.feature}>
              <Ionicons
                name="location-outline"
                size={17}
                color="#7189A5"
              />
              <Text style={styles.featureText}>
                Location snapshot
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeadingWrap}>
            <Text style={styles.sectionTitle}>Trusted contacts</Text>
            <Text style={styles.contactCount}>
              {contacts.length} saved
            </Text>
          </View>

          <Pressable onPress={openAddContact} hitSlop={10}>
            <Text style={styles.manageText}>+ Add</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#20C997" size="small" />
            <Text style={styles.loadingText}>
              Loading trusted contacts...
            </Text>
          </View>
        ) : contacts.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="people-outline"
                size={28}
                color="#4DA3FF"
              />
            </View>
            <Text style={styles.emptyTitle}>
              No trusted contacts yet
            </Text>
            <Text style={styles.emptySubtitle}>
              Add someone you trust so you can quickly call them when
              you need help.
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={openAddContact}
            >
              <Ionicons
                name="person-add"
                size={17}
                color="#07111F"
              />
              <Text style={styles.emptyButtonText}>
                Add trusted contact
              </Text>
            </Pressable>
          </View>
        ) : (
          contacts.map((contact) => (
            <View style={styles.contactCard} key={contact.id}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactInitial}>
                  {contact.name.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactStatus}>
                  {contact.relationship || "Trusted contact"}
                </Text>
                <Text style={styles.contactPhone}>{contact.phone}</Text>
              </View>

              <Pressable
                style={styles.contactCall}
                onPress={() => callContact(contact)}
                accessibilityLabel={`Call ${contact.name}`}
                hitSlop={5}
              >
                <Ionicons name="call" size={18} color="#55D68A" />
              </Pressable>

              <Pressable
                style={styles.contactMore}
                onPress={() =>
                  Alert.alert(contact.name, "Manage this contact", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Edit",
                      onPress: () => openEditContact(contact),
                    },
                    {
                      text: "Remove",
                      style: "destructive",
                      onPress: () => confirmDeleteContact(contact),
                    },
                  ])
                }
                accessibilityLabel={`Manage ${contact.name}`}
                hitSlop={5}
              >
                <Ionicons
                  name="ellipsis-vertical"
                  size={20}
                  color="#A8B8C9"
                />
              </Pressable>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Emergency information</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons
              name="information-circle"
              size={22}
              color="#4DA3FF"
            />
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              If you are in immediate danger
            </Text>
            <Text style={styles.infoText}>
              Call 911 or your local emergency number. Move to a safe
              location if you can, and follow instructions from
              emergency responders.
            </Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          SafeRoute emergency features help you access assistance.
          They do not replace emergency services. Notify your trusted contacts immediately when you use SOS or share your
          location.
        </Text>

        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeForm}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeadingWrap}>
                <Text style={styles.modalEyebrow}>
                  EMERGENCY CONTACTS
                </Text>
                <Text style={styles.modalTitle}>
                  {editingContact
                    ? "Edit contact"
                    : "Add trusted contact"}
                </Text>
              </View>

              <Pressable
                style={styles.modalClose}
                onPress={closeForm}
                disabled={saving}
                hitSlop={8}
              >
                <Ionicons name="close" size={23} color="#FFFFFF" />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>FULL NAME *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Alex Johnson"
              placeholderTextColor="#60758D"
              autoCapitalize="words"
              maxLength={80}
              returnKeyType="next"
            />

            <Text style={styles.inputLabel}>RELATIONSHIP</Text>
            <TextInput
              style={styles.input}
              value={relationship}
              onChangeText={setRelationship}
              placeholder="e.g. Parent, friend, guardian"
              placeholderTextColor="#60758D"
              autoCapitalize="sentences"
              maxLength={60}
              returnKeyType="next"
            />

            <Text style={styles.inputLabel}>PHONE NUMBER *</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. +1 555 123 4567"
              placeholderTextColor="#60758D"
              keyboardType="phone-pad"
              maxLength={25}
              returnKeyType="done"
            />

            <Text style={styles.modalNote}>
              Only add people who have agreed to be your trusted contacts.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.saveButtonPressed,
                saving && styles.saveButtonDisabled,
              ]}
              onPress={saveContact}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#07111F" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle"
                    size={19}
                    color="#07111F"
                  />
                  <Text style={styles.saveButtonText}>
                    {editingContact ? "Save changes" : "Save contact"}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={closeForm}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07111F" },
  content: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 43 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerText: { flex: 1, paddingRight: 12 },
  eyebrow: {
    color: "#FF6B6B",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: 5,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 5,
  },
  subtitle: {
    color: "#8095AE",
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 275,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#321D28",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#66323A",
  },
  sosCard: {
    backgroundColor: "#321B25",
    borderRadius: 25,
    padding: 21,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#66333C",
    marginBottom: 14,
  },
  sosLabel: {
    color: "#FF8B8B",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 7,
  },
  sosDescription: {
    color: "#C89A9E",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    maxWidth: 290,
    marginBottom: 20,
  },
  sosButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#C83F48",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 8,
    borderColor: "#813039",
    elevation: 8,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  sosButtonPressed: { transform: [{ scale: 0.96 }] },
  sosInner: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: "#A9363D",
    alignItems: "center",
    justifyContent: "center",
  },
  sosText: {
    color: "#FFFFFF",
    fontSize: 37,
    fontWeight: "900",
    marginTop: 2,
  },
  sosSmallText: {
    color: "#FFD9D9",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: -2,
  },
  sosNote: {
    color: "#A87379",
    fontSize: 9,
    textAlign: "center",
    marginTop: 17,
  },
  callCard: {
    backgroundColor: "#A9363D",
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },
  callIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  callContent: { flex: 1 },
  callTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 3,
  },
  callSubtitle: { color: "#FFD9D9", fontSize: 10 },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 13,
  },
  actionGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  actionCard: {
    width: "48%",
    backgroundColor: "#0E1D30",
    borderRadius: 18,
    padding: 15,
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
    marginBottom: 12,
  },
  actionTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  actionSubtitle: { color: "#7189A5", fontSize: 9, lineHeight: 14 },
  tripCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 19,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1D334F",
    marginBottom: 28,
  },
  tripHeader: { flexDirection: "row", alignItems: "center" },
  tripIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#123426",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  tripInfo: { flex: 1 },
  tripTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  tripSubtitle: { color: "#7189A5", fontSize: 10, lineHeight: 15 },
  tripDivider: {
    height: 1,
    backgroundColor: "#1B3048",
    marginVertical: 15,
  },
  tripFeatures: { flexDirection: "row", flexWrap: "wrap" },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 18,
    marginBottom: 3,
  },
  featureText: { color: "#7189A5", fontSize: 9, marginLeft: 5 },
  locationDetails: {
    backgroundColor: "#0A1727",
    borderRadius: 13,
    padding: 12,
    marginTop: 14,
  },
  locationDetailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationDetailText: {
    color: "#A8B8C9",
    fontSize: 10,
    marginLeft: 7,
    flex: 1,
  },
  coordinatesText: {
    color: "#7189A5",
    fontSize: 10,
    marginTop: 8,
  },
  openLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 8,
    marginTop: 4,
  },
  openLocationText: {
    color: "#4DA3FF",
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 7,
  },
  stopSharingButton: {
    backgroundColor: "#8F3540",
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  stopSharingButtonPressed: { opacity: 0.8 },
  buttonDisabled: { opacity: 0.6 },
  stopSharingText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 7,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeadingWrap: { flex: 1 },
  manageText: {
    color: "#4DA3FF",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 13,
  },
  contactCount: {
    color: "#7189A5",
    fontSize: 10,
    marginTop: -8,
    marginBottom: 13,
  },
  loadingCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 18,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },
  loadingText: { color: "#A8B8C9", fontSize: 12, marginLeft: 10 },
  emptyCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1D334F",
    alignItems: "center",
    marginBottom: 28,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#12263F",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  emptySubtitle: {
    color: "#7189A5",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 7,
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: "#20C997",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyButtonText: {
    color: "#07111F",
    fontSize: 12,
    fontWeight: "900",
  },
  contactCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1D334F",
    marginBottom: 10,
  },
  contactAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#4C3D7E",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  contactInitial: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  contactInfo: { flex: 1, minWidth: 0 },
  contactName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 3,
  },
  contactStatus: { color: "#7189A5", fontSize: 10, marginBottom: 3 },
  contactPhone: { color: "#A8B8C9", fontSize: 11 },
  contactCall: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#123426",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 5,
  },
  contactMore: {
    width: 30,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  infoCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#1D334F",
    marginBottom: 13,
  },
  infoIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#122A43",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  infoContent: { flex: 1 },
  infoTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 5,
  },
  infoText: { color: "#7189A5", fontSize: 10, lineHeight: 16 },
  disclaimer: {
    color: "#526B85",
    fontSize: 9,
    lineHeight: 14,
    textAlign: "center",
    paddingHorizontal: 10,
    marginTop: 4,
  },
  bottomSpace: { height: 43 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#0B192A",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 25,
    paddingBottom: 30,
    borderWidth: 1,
    borderColor: "#1D334F",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  modalHeadingWrap: { flex: 1 },
  modalEyebrow: {
    color: "#20C997",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginBottom: 6,
  },
  modalTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#172A40",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  inputLabel: {
    color: "#A8B8C9",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#102239",
    borderWidth: 1,
    borderColor: "#24415F",
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#FFFFFF",
    fontSize: 14,
  },
  modalNote: {
    color: "#7189A5",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 15,
    marginBottom: 18,
  },
  saveButton: {
    backgroundColor: "#20C997",
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonPressed: { opacity: 0.85 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#07111F", fontSize: 14, fontWeight: "900" },
  cancelButton: { paddingVertical: 14, alignItems: "center" },
  cancelButtonText: { color: "#A8B8C9", fontSize: 13, fontWeight: "700" },
});
