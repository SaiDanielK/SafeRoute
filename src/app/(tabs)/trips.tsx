import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function TripsTab() {
  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SAFEROUTE TRIPS</Text>
            <Text style={styles.title}>Your Trips</Text>
            <Text style={styles.subtitle}>
              Plan safer journeys and keep track of where you've been.
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <Ionicons name="navigate" size={24} color="#4DA3FF" />
          </View>
        </View>

        {/* Plan a Trip */}
        <Pressable
          style={styles.planCard}
          onPress={() => router.push("/map")}
        >
          <View style={styles.planIcon}>
            <Ionicons name="navigate-circle" size={28} color="#FFFFFF" />
          </View>

          <View style={styles.planContent}>
            <Text style={styles.planTitle}>Plan a trip</Text>
            <Text style={styles.planSubtitle}>
              Find the safest route to your destination.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={22}
            color="#FFFFFF"
          />
        </Pressable>

        {/* Search Destination */}
        <Pressable
          style={styles.searchBox}
          onPress={() => router.push("/map")}
        >
          <Ionicons name="search" size={20} color="#7890AA" />

          <Text style={styles.searchText}>
            Where do you want to go?
          </Text>

          <View style={styles.searchArrow}>
            <Ionicons
              name="arrow-forward"
              size={17}
              color="#4DA3FF"
            />
          </View>
        </Pressable>

        {/* Quick Destinations */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick destinations</Text>

          <Pressable>
            <Text style={styles.viewAll}>Manage</Text>
          </Pressable>
        </View>

        <View style={styles.destinationRow}>
          <Pressable
            style={styles.destinationCard}
            onPress={() => router.push("/map")}
          >
            <View style={styles.destinationIcon}>
              <Ionicons name="home" size={21} color="#55D68A" />
            </View>
            <Text style={styles.destinationTitle}>Home</Text>
            <Text style={styles.destinationSubtitle}>
              Saved place
            </Text>
          </Pressable>

          <Pressable
            style={styles.destinationCard}
            onPress={() => router.push("/map")}
          >
            <View style={styles.destinationIcon}>
              <Ionicons name="school" size={21} color="#4DA3FF" />
            </View>
            <Text style={styles.destinationTitle}>School</Text>
            <Text style={styles.destinationSubtitle}>
              Saved place
            </Text>
          </Pressable>

          <Pressable
            style={styles.destinationCard}
            onPress={() => router.push("/map")}
          >
            <View style={styles.destinationIcon}>
              <Ionicons name="add" size={23} color="#A78BFA" />
            </View>
            <Text style={styles.destinationTitle}>Add</Text>
            <Text style={styles.destinationSubtitle}>
              New place
            </Text>
          </Pressable>
        </View>

        {/* Recent Trips */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent trips</Text>

          <Pressable>
            <Text style={styles.viewAll}>See all</Text>
          </Pressable>
        </View>

        <Pressable style={styles.tripCard}>
          <View style={styles.tripIcon}>
            <Ionicons name="walk" size={21} color="#55D68A" />
          </View>

          <View style={styles.tripInfo}>
            <Text style={styles.tripTitle}>Home → School</Text>
            <Text style={styles.tripDate}>Today • Walking</Text>

            <View style={styles.tripMeta}>
              <Ionicons
                name="time-outline"
                size={13}
                color="#7189A5"
              />
              <Text style={styles.tripMetaText}>29 min</Text>

              <Ionicons
                name="navigate-outline"
                size={13}
                color="#7189A5"
              />
              <Text style={styles.tripMetaText}>1.4 mi</Text>
            </View>
          </View>

          <View style={styles.safeScore}>
            <Text style={styles.safeScoreNumber}>92</Text>
            <Text style={styles.safeScoreLabel}>SAFE</Text>
          </View>
        </Pressable>

        <Pressable style={styles.tripCard}>
          <View style={styles.tripIcon}>
            <Ionicons name="bicycle" size={21} color="#4DA3FF" />
          </View>

          <View style={styles.tripInfo}>
            <Text style={styles.tripTitle}>Home → Library</Text>
            <Text style={styles.tripDate}>Yesterday • Cycling</Text>

            <View style={styles.tripMeta}>
              <Ionicons
                name="time-outline"
                size={13}
                color="#7189A5"
              />
              <Text style={styles.tripMetaText}>12 min</Text>

              <Ionicons
                name="navigate-outline"
                size={13}
                color="#7189A5"
              />
              <Text style={styles.tripMetaText}>2.1 mi</Text>
            </View>
          </View>

          <View style={styles.safeScore}>
            <Text style={styles.safeScoreNumber}>87</Text>
            <Text style={styles.safeScoreLabel}>SAFE</Text>
          </View>
        </Pressable>

        <Pressable style={styles.tripCard}>
          <View style={styles.tripIcon}>
            <Ionicons name="car" size={21} color="#FFC857" />
          </View>

          <View style={styles.tripInfo}>
            <Text style={styles.tripTitle}>School → Park</Text>
            <Text style={styles.tripDate}>Sep 30 • Driving</Text>

            <View style={styles.tripMeta}>
              <Ionicons
                name="time-outline"
                size={13}
                color="#7189A5"
              />
              <Text style={styles.tripMetaText}>8 min</Text>

              <Ionicons
                name="navigate-outline"
                size={13}
                color="#7189A5"
              />
              <Text style={styles.tripMetaText}>2.7 mi</Text>
            </View>
          </View>

          <View style={styles.safeScore}>
            <Text style={styles.safeScoreNumber}>81</Text>
            <Text style={styles.safeScoreLabel}>SAFE</Text>
          </View>
        </Pressable>

        {/* People Tracking */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>People tracking you</Text>

          <Pressable>
            <Text style={styles.viewAll}>Manage</Text>
          </Pressable>
        </View>

        <View style={styles.peopleCard}>
          <View style={styles.personAvatar}>
            <Text style={styles.avatarText}>P</Text>
          </View>

          <View style={styles.personInfo}>
            <Text style={styles.personName}>Parent</Text>
            <Text style={styles.personStatus}>
              Can see your active trips
            </Text>
          </View>

          <View style={styles.onlineIndicator} />
        </View>

        <Pressable style={styles.addPersonButton}>
          <View style={styles.addPersonIcon}>
            <Ionicons name="person-add" size={19} color="#4DA3FF" />
          </View>

          <View style={styles.addPersonText}>
            <Text style={styles.addPersonTitle}>
              Add a trusted person
            </Text>
            <Text style={styles.addPersonSubtitle}>
              Let someone follow your trip
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color="#7890AA"
          />
        </Pressable>

        {/* Open Map */}
        <Pressable
          style={styles.mapButton}
          onPress={() => router.push("/map")}
        >
          <Ionicons name="map" size={20} color="#FFFFFF" />
          <Text style={styles.mapButtonText}>
            Open SafeRoute Map
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
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

  content: {
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 30,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },

  eyebrow: {
    color: "#4DA3FF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: 5,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "900",
    marginBottom: 5,
  },

  subtitle: {
    color: "#8095AE",
    fontSize: 12,
    maxWidth: 275,
    lineHeight: 18,
  },

  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#12263F",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#24415F",
  },

  planCard: {
    backgroundColor: "#1A4F7A",
    borderRadius: 21,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#316F9E",
    marginBottom: 12,
  },

  planIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#24699A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  planContent: {
    flex: 1,
  },

  planTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
  },

  planSubtitle: {
    color: "#C7E4F8",
    fontSize: 10,
    lineHeight: 15,
  },

  searchBox: {
    backgroundColor: "#0E1D30",
    borderRadius: 17,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1D334F",
    marginBottom: 28,
  },

  searchText: {
    color: "#7890AA",
    fontSize: 13,
    marginLeft: 11,
    flex: 1,
  },

  searchArrow: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#122A43",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 13,
  },

  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 13,
  },

  viewAll: {
    color: "#4DA3FF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 13,
  },

  destinationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },

  destinationCard: {
    width: "31.5%",
    backgroundColor: "#0E1D30",
    borderRadius: 17,
    padding: 13,
    borderWidth: 1,
    borderColor: "#1D334F",
  },

  destinationIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: "#12263F",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  destinationTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 3,
  },

  destinationSubtitle: {
    color: "#637C97",
    fontSize: 8,
  },

  tripCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1D334F",
    marginBottom: 10,
  },

  tripIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#12263F",
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
    marginBottom: 3,
  },

  tripDate: {
    color: "#7189A5",
    fontSize: 9,
    marginBottom: 7,
  },

  tripMeta: {
    flexDirection: "row",
    alignItems: "center",
  },

  tripMetaText: {
    color: "#7189A5",
    fontSize: 9,
    marginLeft: 4,
    marginRight: 10,
  },

  safeScore: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: "#123426",
    alignItems: "center",
    justifyContent: "center",
  },

  safeScoreNumber: {
    color: "#55D68A",
    fontSize: 16,
    fontWeight: "900",
  },

  safeScoreLabel: {
    color: "#5F9677",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  peopleCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1D334F",
    marginBottom: 10,
  },

  personAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#4C3D7E",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },

  personInfo: {
    flex: 1,
  },

  personName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 3,
  },

  personStatus: {
    color: "#7189A5",
    fontSize: 10,
  },

  onlineIndicator: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#55D68A",
    borderWidth: 2,
    borderColor: "#0E1D30",
  },

  addPersonButton: {
    backgroundColor: "#12263F",
    borderRadius: 18,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#24415F",
    marginBottom: 28,
  },

  addPersonIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#183552",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  addPersonText: {
    flex: 1,
  },

  addPersonTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 3,
  },

  addPersonSubtitle: {
    color: "#7189A5",
    fontSize: 9,
  },

  mapButton: {
    backgroundColor: "#1E5B8C",
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3275A8",
  },

  mapButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
    marginLeft: 10,
  },

  bottomSpace: {
    height: 20,
  },
});