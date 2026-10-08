import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Linking } from "react-native";

export default function EmergencyTab() {
  const handleSOS = () => {
    Alert.alert(
      "Emergency SOS",
      "This will start the SafeRoute emergency process. In a real emergency, call 911 immediately.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            Linking.openURL("tel:911");
          },
        },
      ]
    );
  };

  const call911 = () => {
    Linking.openURL("tel:911");
  };

  const shareLocation = () => {
    Alert.alert(
      "Share Location",
      "Your current location will be prepared for sharing with your trusted contacts."
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
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

        {/* SOS Card */}
        <View style={styles.sosCard}>
          <Text style={styles.sosLabel}>EMERGENCY SOS</Text>

          <Text style={styles.sosDescription}>
            If you are in immediate danger, use SOS to quickly
            contact emergency services.
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

        {/* Call 911 */}
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

          <Ionicons
            name="chevron-forward"
            size={21}
            color="#FFFFFF"
          />
        </Pressable>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Emergency actions</Text>

        <View style={styles.actionGrid}>
          <Pressable
            style={styles.actionCard}
            onPress={shareLocation}
          >
            <View style={styles.actionIcon}>
              <Ionicons
                name="location"
                size={22}
                color="#4DA3FF"
              />
            </View>

            <Text style={styles.actionTitle}>
              Share location
            </Text>

            <Text style={styles.actionSubtitle}>
              Send your location to trusted people
            </Text>
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() =>
              Alert.alert(
                "Emergency Contacts",
                "Your trusted emergency contacts will appear here."
              )
            }
          >
            <View style={styles.actionIcon}>
              <Ionicons
                name="people"
                size={22}
                color="#A78BFA"
              />
            </View>

            <Text style={styles.actionTitle}>
              Trusted contacts
            </Text>

            <Text style={styles.actionSubtitle}>
              Quickly reach someone you trust
            </Text>
          </Pressable>
        </View>

        {/* Active Trip */}
        <Text style={styles.sectionTitle}>Trip safety</Text>

        <View style={styles.tripCard}>
          <View style={styles.tripHeader}>
            <View style={styles.tripIcon}>
              <Ionicons name="navigate" size={21} color="#55D68A" />
            </View>

            <View style={styles.tripInfo}>
              <Text style={styles.tripTitle}>No active trip</Text>
              <Text style={styles.tripSubtitle}>
                Start a SafeRoute trip to enable trip safety features.
              </Text>
            </View>
          </View>

          <View style={styles.tripDivider} />

          <View style={styles.tripFeatures}>
            <View style={styles.feature}>
              <Ionicons
                name="location-outline"
                size={17}
                color="#7189A5"
              />
              <Text style={styles.featureText}>
                Live location
              </Text>
            </View>

            <View style={styles.feature}>
              <Ionicons
                name="notifications-outline"
                size={17}
                color="#7189A5"
              />
              <Text style={styles.featureText}>
                Safety alerts
              </Text>
            </View>
          </View>
        </View>

        {/* Trusted Contacts */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trusted contacts</Text>

          <Pressable
            onPress={() =>
              Alert.alert(
                "Trusted Contacts",
                "Contact management will be connected to your SafeRoute profile."
              )
            }
          >
            <Text style={styles.manageText}>Manage</Text>
          </Pressable>
        </View>

        <View style={styles.contactCard}>
          <View style={styles.contactAvatar}>
            <Text style={styles.contactInitial}>P</Text>
          </View>

          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>Parent</Text>
            <Text style={styles.contactStatus}>
              Emergency contact
            </Text>
          </View>

          <Pressable
            style={styles.contactCall}
            onPress={() =>
              Alert.alert(
                "Contact Parent",
                "A phone number will be connected here once trusted contacts are configured."
              )
            }
          >
            <Ionicons name="call" size={18} color="#55D68A" />
          </Pressable>
        </View>

        <Pressable
          style={styles.addContact}
          onPress={() =>
            Alert.alert(
              "Add Trusted Contact",
              "Trusted contact setup will be connected to your SafeRoute profile."
            )
          }
        >
          <View style={styles.addContactIcon}>
            <Ionicons name="person-add" size={19} color="#4DA3FF" />
          </View>

          <View style={styles.addContactContent}>
            <Text style={styles.addContactTitle}>
              Add emergency contact
            </Text>

            <Text style={styles.addContactSubtitle}>
              Choose someone you trust
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color="#7890AA"
          />
        </Pressable>

        {/* Safety Information */}
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
              Call 911 or your local emergency number. Move to a
              safe location if you can, and follow instructions from
              emergency responders.
            </Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          SafeRoute emergency features are intended to help you
          quickly access assistance. They do not replace emergency
          services or professional emergency response.
        </Text>

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

  content: {
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 30,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },

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
    shadowOffset: {
      width: 0,
      height: 6,
    },
  },

  sosButtonPressed: {
    transform: [{ scale: 0.96 }],
  },

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

  callContent: {
    flex: 1,
  },

  callTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 3,
  },

  callSubtitle: {
    color: "#FFD9D9",
    fontSize: 10,
  },

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

  actionSubtitle: {
    color: "#7189A5",
    fontSize: 9,
    lineHeight: 14,
  },

  tripCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 19,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1D334F",
    marginBottom: 28,
  },

  tripHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  tripIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#123426",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
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

  tripSubtitle: {
    color: "#7189A5",
    fontSize: 10,
    lineHeight: 15,
  },

  tripDivider: {
    height: 1,
    backgroundColor: "#1B3048",
    marginVertical: 15,
  },

  tripFeatures: {
    flexDirection: "row",
  },

  feature: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 22,
  },

  featureText: {
    color: "#7189A5",
    fontSize: 9,
    marginLeft: 5,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  manageText: {
    color: "#4DA3FF",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 13,
  },

  contactCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 18,
    padding: 14,
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

  contactInitial: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },

  contactInfo: {
    flex: 1,
  },

  contactName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 3,
  },

  contactStatus: {
    color: "#7189A5",
    fontSize: 10,
  },

  contactCall: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#123426",
    alignItems: "center",
    justifyContent: "center",
  },

  addContact: {
    backgroundColor: "#12263F",
    borderRadius: 18,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#24415F",
    marginBottom: 28,
  },

  addContactIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#183552",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  addContactContent: {
    flex: 1,
  },

  addContactTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 3,
  },

  addContactSubtitle: {
    color: "#7189A5",
    fontSize: 9,
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

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 5,
  },

  infoText: {
    color: "#7189A5",
    fontSize: 10,
    lineHeight: 16,
  },

  disclaimer: {
    color: "#526B85",
    fontSize: 9,
    lineHeight: 14,
    textAlign: "center",
    paddingHorizontal: 10,
    marginTop: 4,
  },

  bottomSpace: {
    height: 20,
  },
});