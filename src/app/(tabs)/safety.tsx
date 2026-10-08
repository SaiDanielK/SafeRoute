import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Location from "expo-location";

import {
  getActiveNWSAlerts,
  getNWSAlertColor,
  getNWSAlertIcon,
  type NWSAlert,
} from "../../services/nwsService";

import {
  getAmberAlerts,
  type AmberAlert,
} from "../../services/amberAlertService";

export default function SafetyTab() {
  const [nwsAlerts, setNwsAlerts] = useState<NWSAlert[]>([]);
  const [nwsLoading, setNwsLoading] = useState(true);
  const [nwsError, setNwsError] = useState<string | null>(null);

  const [amberAlerts, setAmberAlerts] = useState<AmberAlert[]>([]);
  const [amberLoading, setAmberLoading] = useState(true);
  const [amberError, setAmberError] = useState<string | null>(null);

  const loadNWSAlerts = async () => {
    try {
      setNwsLoading(true);
      setNwsError(null);

      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setNwsError(
          "Location permission is needed to show weather alerts for your area."
        );
        setNwsAlerts([]);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const alerts = await getActiveNWSAlerts(
        position.coords.latitude,
        position.coords.longitude
      );

      setNwsAlerts(alerts);
    } catch (error) {
      console.error("NWS alert error:", error);

      setNwsError(
        "We couldn't load weather alerts right now. Please try again."
      );
    } finally {
      setNwsLoading(false);
    }
  };

  const loadAmberAlerts = async () => {
    try {
      setAmberLoading(true);
      setAmberError(null);

      const alerts = await getAmberAlerts();

      setAmberAlerts(alerts);
    } catch (error) {
      console.error("AMBER Alert error:", error);

      setAmberError(
        "We couldn't load AMBER Alerts right now. Please try again."
      );
    } finally {
      setAmberLoading(false);
    }
  };

  useEffect(() => {
    loadNWSAlerts();
    loadAmberAlerts();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SAFEROUTE SAFETY</Text>

            <Text style={styles.title}>Your Safety</Text>

            <Text style={styles.subtitle}>
              Stay informed about what is happening around you.
            </Text>
          </View>

          <View style={styles.shield}>
            <Ionicons
              name="shield-checkmark"
              size={25}
              color="#55D68A"
            />
          </View>
        </View>

        {/* Safety Score */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreTop}>
            <View>
              <Text style={styles.cardLabel}>
                AREA SAFETY SCORE
              </Text>

              <Text style={styles.scoreTitle}>
                Looking good
              </Text>
            </View>

            <View style={styles.scoreCircle}>
              <Text style={styles.scoreNumber}>92</Text>
              <Text style={styles.scoreOutOf}>/100</Text>
            </View>
          </View>

          <View style={styles.progressBackground}>
            <View style={styles.progress} />
          </View>

          <View style={styles.scoreBottom}>
            <Ionicons
              name="trending-up"
              size={16}
              color="#55D68A"
            />

            <Text style={styles.scoreMessage}>
              Your area currently has a high safety rating.
            </Text>
          </View>
        </View>

        {/* Safety Alerts */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Safety alerts
          </Text>

          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />

            <Text style={styles.liveText}>
              LIVE
            </Text>
          </View>
        </View>

        {/* NWS Alerts */}
        {nwsLoading ? (
          <View style={styles.alertCard}>
            <View style={styles.alertIcon}>
              <ActivityIndicator
                size="small"
                color="#4DA3FF"
              />
            </View>

            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>
                Checking your area...
              </Text>

              <Text style={styles.alertDescription}>
                SafeRoute is checking the National Weather Service
                for active alerts near you.
              </Text>
            </View>
          </View>
        ) : nwsError ? (
          <View style={styles.alertCard}>
            <View style={styles.alertIcon}>
              <Ionicons
                name="cloud-offline-outline"
                size={23}
                color="#FF9F43"
              />
            </View>

            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>
                Weather alerts unavailable
              </Text>

              <Text style={styles.alertDescription}>
                {nwsError}
              </Text>

              <Pressable
                onPress={loadNWSAlerts}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>
                  Try again
                </Text>
              </Pressable>
            </View>
          </View>
        ) : nwsAlerts.length === 0 ? (
          <View style={styles.alertCard}>
            <View style={styles.alertIcon}>
              <Ionicons
                name="checkmark-circle"
                size={23}
                color="#55D68A"
              />
            </View>

            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>
                No active weather alerts nearby
              </Text>

              <Text style={styles.alertDescription}>
                The National Weather Service isn't currently
                reporting active alerts for your location.
              </Text>
            </View>
          </View>
        ) : (
          nwsAlerts.map((alert) => {
            const alertColor = getNWSAlertColor(
              alert.severity
            );

            return (
              <View
                key={alert.id}
                style={[
                  styles.alertCard,
                  {
                    borderColor: alertColor,
                  },
                ]}
              >
                <View
                  style={[
                    styles.alertIcon,
                    {
                      backgroundColor: `${alertColor}22`,
                    },
                  ]}
                >
                  <Text style={styles.nwsAlertEmoji}>
                    {getNWSAlertIcon(alert.event)}
                  </Text>
                </View>

                <View style={styles.alertContent}>
                  <View style={styles.nwsAlertTitleRow}>
                    <Text
                      style={styles.alertTitle}
                      numberOfLines={2}
                    >
                      {alert.event}
                    </Text>

                    <View
                      style={[
                        styles.nwsSeverityBadge,
                        {
                          backgroundColor: `${alertColor}22`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.nwsSeverityText,
                          {
                            color: alertColor,
                          },
                        ]}
                      >
                        {alert.severity.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.alertDescription}>
                    {alert.headline}
                  </Text>

                  <Text style={styles.nwsAreaText}>
                    {alert.areaDesc}
                  </Text>

                  {alert.expires ? (
                    <Text style={styles.nwsExpiresText}>
                      Expires{" "}
                      {new Date(
                        alert.expires
                      ).toLocaleString()}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        {/* Refresh NWS Alerts */}
        {!nwsLoading && (
          <Pressable
            style={styles.refreshAlertsButton}
            onPress={loadNWSAlerts}
          >
            <Ionicons
              name="refresh"
              size={15}
              color="#4DA3FF"
            />

            <Text style={styles.refreshAlertsText}>
              Refresh weather alerts
            </Text>
          </Pressable>
        )}

        {/* AMBER Alerts */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            AMBER Alerts
          </Text>

          <View style={styles.amberDelayBadge}>
            <Ionicons
              name="time-outline"
              size={11}
              color="#FF9F43"
            />

            <Text style={styles.amberDelayText}>
              24H DELAY
            </Text>
          </View>
        </View>

        {amberLoading ? (
          <View style={styles.amberCard}>
            <View style={styles.amberIcon}>
              <ActivityIndicator
                size="small"
                color="#FF453A"
              />
            </View>

            <View style={styles.amberContent}>
              <Text style={styles.amberTitle}>
                Checking AMBER Alerts...
              </Text>

              <Text style={styles.amberDescription}>
                SafeRoute is checking the official FEMA IPAWS
                alert archive for recent Child Abduction
                Emergencies.
              </Text>
            </View>
          </View>
        ) : amberError ? (
          <View style={styles.amberCard}>
            <View style={styles.amberIcon}>
              <Ionicons
                name="cloud-offline-outline"
                size={23}
                color="#FF9F43"
              />
            </View>

            <View style={styles.amberContent}>
              <Text style={styles.amberTitle}>
                AMBER Alerts unavailable
              </Text>

              <Text style={styles.amberDescription}>
                {amberError}
              </Text>

              <Pressable
                onPress={loadAmberAlerts}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>
                  Try again
                </Text>
              </Pressable>
            </View>
          </View>
        ) : amberAlerts.length === 0 ? (
          <View style={styles.amberCard}>
            <View style={styles.amberIcon}>
              <Ionicons
                name="checkmark-circle"
                size={23}
                color="#55D68A"
              />
            </View>

            <View style={styles.amberContent}>
              <Text style={styles.amberTitle}>
                No recent AMBER Alerts
              </Text>

              <Text style={styles.amberDescription}>
                FEMA's IPAWS archive does not currently contain
                recent Child Abduction Emergency records.
              </Text>
            </View>
          </View>
        ) : (
          amberAlerts.map((alert) => (
            <View
              key={alert.id}
              style={styles.amberAlertCard}
            >
              <View style={styles.amberAlertIcon}>
                <Ionicons
                  name="warning"
                  size={22}
                  color="#FF453A"
                />
              </View>

              <View style={styles.amberContent}>
                <Text style={styles.amberTitle}>
                  {alert.headline}
                </Text>

                <Text style={styles.amberArea}>
                  {alert.areaDesc}
                </Text>

                <Text
                  style={styles.amberDescription}
                  numberOfLines={4}
                >
                  {alert.description}
                </Text>

                {alert.sent ? (
                  <Text style={styles.amberMeta}>
                    Issued{" "}
                    {new Date(
                      alert.sent
                    ).toLocaleString()}
                  </Text>
                ) : null}

                {alert.expires ? (
                  <Text style={styles.amberMeta}>
                    Expires{" "}
                    {new Date(
                      alert.expires
                    ).toLocaleString()}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        )}

        {/* Refresh AMBER Alerts */}
        {!amberLoading && (
          <Pressable
            style={styles.refreshAlertsButton}
            onPress={loadAmberAlerts}
          >
            <Ionicons
              name="refresh"
              size={15}
              color="#4DA3FF"
            />

            <Text style={styles.refreshAlertsText}>
              Refresh AMBER Alerts
            </Text>
          </Pressable>
        )}

        {/* Hazard Reports */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Nearby hazards
          </Text>

          <Pressable>
            <Text style={styles.viewAll}>
              View all
            </Text>
          </Pressable>
        </View>

        <View style={styles.hazardCard}>
          <View style={styles.hazardIcon}>
            <Ionicons
              name="construct"
              size={21}
              color="#FFC857"
            />
          </View>

          <View style={styles.hazardContent}>
            <View style={styles.hazardTitleRow}>
              <Text style={styles.hazardTitle}>
                Road construction
              </Text>

              <View style={styles.mediumBadge}>
                <Text style={styles.mediumText}>
                  MEDIUM
                </Text>
              </View>
            </View>

            <Text style={styles.hazardDescription}>
              Construction may affect pedestrian access nearby.
            </Text>

            <Text style={styles.reportTime}>
              Reported recently
            </Text>
          </View>
        </View>

        <View style={styles.hazardCard}>
          <View style={styles.hazardIcon}>
            <Ionicons
              name="warning"
              size={21}
              color="#FF9F43"
            />
          </View>

          <View style={styles.hazardContent}>
            <View style={styles.hazardTitleRow}>
              <Text style={styles.hazardTitle}>
                Traffic caution
              </Text>

              <View style={styles.lowBadge}>
                <Text style={styles.lowText}>
                  LOW
                </Text>
              </View>
            </View>

            <Text style={styles.hazardDescription}>
              Increased traffic reported along a nearby road.
            </Text>

            <Text style={styles.reportTime}>
              Reported recently
            </Text>
          </View>
        </View>

        {/* Report Hazard */}
        <Pressable style={styles.reportButton}>
          <View style={styles.reportButtonIcon}>
            <Ionicons
              name="add"
              size={22}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.reportButtonText}>
            <Text style={styles.reportTitle}>
              Report a hazard
            </Text>

            <Text style={styles.reportSubtitle}>
              Help keep your community safer
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color="#8EA5BE"
          />
        </Pressable>

        {/* Community Safety */}
        <Text style={styles.sectionTitle}>
          Community safety
        </Text>

        <View style={styles.communityCard}>
          <View style={styles.communityHeader}>
            <View style={styles.communityIcon}>
              <Ionicons
                name="people"
                size={21}
                color="#A78BFA"
              />
            </View>

            <View>
              <Text style={styles.communityTitle}>
                Local reports
              </Text>

              <Text style={styles.communitySubtitle}>
                See what your community is reporting
              </Text>
            </View>
          </View>

          <View style={styles.communityStats}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>
                12
              </Text>

              <Text style={styles.statLabel}>
                Reports
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.stat}>
              <Text style={styles.statNumber}>
                8
              </Text>

              <Text style={styles.statLabel}>
                Resolved
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.stat}>
              <Text style={styles.statNumber}>
                4
              </Text>

              <Text style={styles.statLabel}>
                Active
              </Text>
            </View>
          </View>
        </View>

        {/* AI Assistant */}
        <Text style={styles.sectionTitle}>
          SafeRoute AI
        </Text>

        <Pressable
          style={styles.aiCard}
          onPress={() => router.push("/ai")}
        >
          <View style={styles.aiIcon}>
            <Ionicons
              name="sparkles"
              size={25}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.aiContent}>
            <Text style={styles.aiTitle}>
              Ask about your safety
            </Text>

            <Text style={styles.aiDescription}>
              Get help understanding alerts, hazards, and safer
              travel options.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color="#FFFFFF"
          />
        </Pressable>

        {/* Emergency */}
        <Pressable
          style={styles.emergencyCard}
          onPress={() => router.push("/emergency")}
        >
          <View style={styles.emergencyIcon}>
            <Ionicons
              name="shield"
              size={22}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.emergencyContent}>
            <Text style={styles.emergencyTitle}>
              Emergency Center
            </Text>

            <Text style={styles.emergencySubtitle}>
              Quick access to emergency tools
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
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
    alignItems: "center",
    justifyContent: "space-between",
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
    maxWidth: 270,
    lineHeight: 18,
  },

  shield: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#123426",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1C5138",
  },

  scoreCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 23,
    padding: 19,
    borderWidth: 1,
    borderColor: "#1D334F",
    marginBottom: 28,
  },

  scoreTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardLabel: {
    color: "#7189A5",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 6,
  },

  scoreTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },

  scoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#123426",
    borderWidth: 4,
    borderColor: "#55D68A",
    alignItems: "center",
    justifyContent: "center",
  },

  scoreNumber: {
    color: "#55D68A",
    fontSize: 24,
    fontWeight: "900",
  },

  scoreOutOf: {
    color: "#7791A9",
    fontSize: 9,
    marginTop: -3,
  },

  progressBackground: {
    height: 7,
    backgroundColor: "#172A40",
    borderRadius: 5,
    overflow: "hidden",
    marginTop: 19,
  },

  progress: {
    height: "100%",
    width: "92%",
    backgroundColor: "#55D68A",
    borderRadius: 5,
  },

  scoreBottom: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 13,
  },

  scoreMessage: {
    color: "#8297AF",
    fontSize: 11,
    marginLeft: 7,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
  },

  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 13,
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#12263F",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 13,
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#55D68A",
    marginRight: 5,
  },

  liveText: {
    color: "#55D68A",
    fontSize: 9,
    fontWeight: "900",
  },

  alertCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#1D334F",
    marginBottom: 10,
  },

  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#122A43",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  alertContent: {
    flex: 1,
  },

  alertTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 5,
  },

  alertDescription: {
    color: "#7D92AA",
    fontSize: 11,
    lineHeight: 17,
  },

  retryButton: {
    alignSelf: "flex-start",
    marginTop: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#122A43",
  },

  retryText: {
    color: "#4DA3FF",
    fontSize: 10,
    fontWeight: "800",
  },

  refreshAlertsButton: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    marginTop: -1,
    marginBottom: 25,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#0D2035",
  },

  refreshAlertsText: {
    color: "#4DA3FF",
    fontSize: 9,
    fontWeight: "800",
    marginLeft: 5,
  },

  nwsAlertEmoji: {
    fontSize: 22,
  },

  nwsAlertTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
  },

  nwsSeverityBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginLeft: 7,
    marginTop: 1,
  },

  nwsSeverityText: {
    fontSize: 7,
    fontWeight: "900",
  },

  nwsAreaText: {
    color: "#68819C",
    fontSize: 9,
    marginTop: 7,
  },

  nwsExpiresText: {
    color: "#536C87",
    fontSize: 8,
    marginTop: 4,
  },

  amberDelayBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#302719",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 13,
  },

  amberDelayText: {
    color: "#FF9F43",
    fontSize: 8,
    fontWeight: "900",
    marginLeft: 4,
  },

  amberCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#1D334F",
    marginBottom: 10,
  },

  amberAlertCard: {
    backgroundColor: "#241719",
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#713039",
    marginBottom: 10,
  },

  amberIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#122A43",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  amberAlertIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#401F24",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  amberContent: {
    flex: 1,
  },

  amberTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 5,
  },

  amberArea: {
    color: "#FF9F43",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 7,
  },

  amberDescription: {
    color: "#9A8790",
    fontSize: 11,
    lineHeight: 17,
  },

  amberMeta: {
    color: "#75636A",
    fontSize: 8,
    marginTop: 5,
  },

  viewAll: {
    color: "#4DA3FF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 13,
  },

  hazardCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#1D334F",
    marginBottom: 10,
  },

  hazardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#292A25",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  hazardContent: {
    flex: 1,
  },

  hazardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },

  hazardTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
  },

  mediumBadge: {
    backgroundColor: "#40351D",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  mediumText: {
    color: "#FFC857",
    fontSize: 7,
    fontWeight: "900",
  },

  lowBadge: {
    backgroundColor: "#20392D",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  lowText: {
    color: "#55D68A",
    fontSize: 7,
    fontWeight: "900",
  },

  hazardDescription: {
    color: "#7D92AA",
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 7,
  },

  reportTime: {
    color: "#536C87",
    fontSize: 9,
  },

  reportButton: {
    backgroundColor: "#12263F",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#24415F",
    marginTop: 6,
    marginBottom: 28,
  },

  reportButtonIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#1E4B72",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  reportButtonText: {
    flex: 1,
  },

  reportTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 3,
  },

  reportSubtitle: {
    color: "#7890AA",
    fontSize: 10,
  },

  communityCard: {
    backgroundColor: "#0E1D30",
    borderRadius: 19,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1D334F",
    marginBottom: 28,
  },

  communityHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  communityIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#28203D",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  communityTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 3,
  },

  communitySubtitle: {
    color: "#758CA6",
    fontSize: 10,
  },

  communityStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 20,
    paddingTop: 17,
    borderTopWidth: 1,
    borderTopColor: "#1B3048",
  },

  stat: {
    alignItems: "center",
  },

  statNumber: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 3,
  },

  statLabel: {
    color: "#7189A5",
    fontSize: 9,
  },

  statDivider: {
    height: 28,
    width: 1,
    backgroundColor: "#1B3048",
  },

  aiCard: {
    backgroundColor: "#172442",
    borderRadius: 19,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#344B77",
    marginBottom: 14,
  },

  aiIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: "#6650B8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  aiContent: {
    flex: 1,
  },

  aiTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },

  aiDescription: {
    color: "#9BAAC5",
    fontSize: 10,
    lineHeight: 15,
  },

  emergencyCard: {
    backgroundColor: "#A9363D",
    borderRadius: 19,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },

  emergencyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  emergencyContent: {
    flex: 1,
  },

  emergencyTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 3,
  },

  emergencySubtitle: {
    color: "#FFD9D9",
    fontSize: 10,
  },

  bottomSpace: {
    height: 20,
  },
});