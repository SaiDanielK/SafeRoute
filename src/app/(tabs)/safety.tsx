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

import {
  getRecentHazards,
  type CommunityHazard,
  type HazardType,
} from "../../services/hazardService";

import { getCurrentLocationSafetyScore } from "../../services/safety/locationSafetyService";
import type { SafetyScore } from "../../services/safety/safetyTypes";

export default function SafetyTab() {
  const [nwsAlerts, setNwsAlerts] = useState<NWSAlert[]>([]);
  const [nwsLoading, setNwsLoading] = useState(true);
  const [nwsError, setNwsError] = useState<string | null>(null);

  const [amberAlerts, setAmberAlerts] = useState<AmberAlert[]>([]);
  const [amberLoading, setAmberLoading] = useState(true);
  const [amberError, setAmberError] = useState<string | null>(null);

  const [hazards, setHazards] = useState<CommunityHazard[]>([]);
  const [hazardsLoading, setHazardsLoading] = useState(true);
  const [hazardsError, setHazardsError] = useState<string | null>(null);
  const [showAllHazards, setShowAllHazards] = useState(false);

  const [safetyScore, setSafetyScore] = useState<SafetyScore | null>(null);
  const [safetyScoreLoading, setSafetyScoreLoading] = useState(true);
  const [safetyScoreError, setSafetyScoreError] = useState<string | null>(null);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#55D68A";
    if (score >= 60) return "#FFC857";
    if (score >= 40) return "#FF9F43";
    return "#FF6B6B";
  };

  const hazardPresentation = (type: HazardType) => {
    switch (type) {
      case "accident":
        return { icon: "car" as const, color: "#FF6B6B", label: "ACCIDENT" };
      case "road_closed":
        return { icon: "ban" as const, color: "#FF6B6B", label: "ROAD CLOSED" };
      case "construction":
        return { icon: "construct" as const, color: "#FFC857", label: "CONSTRUCTION" };
      case "unsafe_area":
        return { icon: "warning" as const, color: "#FF9F43", label: "CAUTION" };
      case "flooding":
        return { icon: "water" as const, color: "#4DA3FF", label: "FLOODING" };
      case "debris":
        return { icon: "alert-circle" as const, color: "#FFC857", label: "DEBRIS" };
      case "traffic":
        return { icon: "car-sport" as const, color: "#FF9F43", label: "TRAFFIC" };
      default:
        return { icon: "alert-circle" as const, color: "#A78BFA", label: "OTHER" };
    }
  };

  const formatReportTime = (value: unknown) => {
    let date: Date | null = null;

    if (
      value &&
      typeof value === "object" &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate === "function"
    ) {
      date = (value as { toDate: () => Date }).toDate();
    } else if (value instanceof Date) {
      date = value;
    } else if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) date = parsed;
    }

    if (!date) return "Recently reported";

    const elapsed = Math.max(0, Date.now() - date.getTime());
    const minutes = Math.floor(elapsed / 60000);

    if (minutes < 1) return "Reported just now";
    if (minutes < 60) {
      return `Reported ${minutes} min${minutes === 1 ? "" : "s"} ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `Reported ${hours} hour${hours === 1 ? "" : "s"} ago`;
    }

    const days = Math.floor(hours / 24);
    if (days < 7) {
      return `Reported ${days} day${days === 1 ? "" : "s"} ago`;
    }

    return `Reported ${date.toLocaleDateString()}`;
  };

  const loadSafetyScore = async () => {
    try {
      setSafetyScoreLoading(true);
      setSafetyScoreError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setSafetyScore(null);
        setSafetyScoreError(
          "Location permission is needed to calculate your area safety score."
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const result = await getCurrentLocationSafetyScore({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      setSafetyScore(result);
    } catch (error) {
      console.error("Safety score error:", error);
      setSafetyScore(null);
      setSafetyScoreError(
        "We couldn't calculate your safety score right now. Please try again."
      );
    } finally {
      setSafetyScoreLoading(false);
    }
  };

  const loadNWSAlerts = async () => {
    try {
      setNwsLoading(true);
      setNwsError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();

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
      setAmberAlerts(await getAmberAlerts());
    } catch (error) {
      console.error("AMBER Alert error:", error);
      setAmberError(
        "We couldn't load AMBER Alerts right now. Please try again."
      );
    } finally {
      setAmberLoading(false);
    }
  };

  const loadHazards = async () => {
    try {
      setHazardsLoading(true);
      setHazardsError(null);
      setHazards(await getRecentHazards(50));
    } catch (error) {
      console.error("Community hazard load error:", error);
      setHazardsError(
        error instanceof Error
          ? error.message
          : "We couldn't load community hazard reports right now."
      );
    } finally {
      setHazardsLoading(false);
    }
  };

  useEffect(() => {
    void loadNWSAlerts();
    void loadAmberAlerts();
    void loadHazards();
    void loadSafetyScore();
  }, []);

  const displayedHazards = showAllHazards ? hazards : hazards.slice(0, 4);
  const hazardTypeCount = new Set(hazards.map((hazard) => hazard.type)).size;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>SAFEROUTE SAFETY</Text>
            <Text style={styles.title}>Your Safety</Text>
            <Text style={styles.subtitle}>
              Stay informed about what is happening around you.
            </Text>
          </View>

          <View style={styles.shield}>
            <Ionicons name="shield-checkmark" size={25} color="#55D68A" />
          </View>
        </View>

        {/* Area Safety Score */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreTop}>
            <View style={styles.scoreHeading}>
              <Text style={styles.cardLabel}>AREA SAFETY SCORE</Text>
              <Text style={styles.scoreTitle}>
                {safetyScoreLoading
                  ? "Calculating..."
                  : safetyScore
                    ? safetyScore.label
                    : "Score unavailable"}
              </Text>
            </View>

            <View
              style={[
                styles.scoreCircle,
                safetyScore
                  ? {
                      borderColor: getScoreColor(safetyScore.score),
                      backgroundColor: `${getScoreColor(safetyScore.score)}20`,
                    }
                  : styles.scoreCircleUnavailable,
              ]}
            >
              {safetyScoreLoading ? (
                <ActivityIndicator size="small" color="#4DA3FF" />
              ) : (
                <>
                  <Text
                    style={[
                      styles.scoreNumber,
                      safetyScore
                        ? { color: getScoreColor(safetyScore.score) }
                        : styles.scoreNumberUnavailable,
                    ]}
                  >
                    {safetyScore ? safetyScore.score : "—"}
                  </Text>
                  <Text style={styles.scoreOutOf}>/100</Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.progressBackground}>
            <View
              style={[
                styles.progress,
                {
                  width: `${
                    safetyScore
                      ? Math.max(0, Math.min(100, safetyScore.score))
                      : 0
                  }%`,
                  backgroundColor: safetyScore
                    ? getScoreColor(safetyScore.score)
                    : "#4DA3FF",
                },
              ]}
            />
          </View>

          <View style={styles.scoreBottom}>
            <Ionicons
              name={
                safetyScore
                  ? "shield-checkmark"
                  : "information-circle-outline"
              }
              size={16}
              color={
                safetyScore ? getScoreColor(safetyScore.score) : "#8297AF"
              }
            />
            <Text style={styles.scoreMessage}>
              {safetyScoreLoading
                ? "Checking local hazards and safety conditions..."
                : safetyScore
                  ? safetyScore.explanation ||
                    `Your current area safety score is ${safetyScore.score}/100.`
                  : safetyScoreError ||
                    "Your area safety score is currently unavailable."}
            </Text>
          </View>

          {safetyScore?.dataCoverage != null && (
            <Text style={styles.scoreCoverage}>
              Data coverage: {Math.round(safetyScore.dataCoverage)}%
            </Text>
          )}

          {!safetyScoreLoading && !safetyScore && (
            <Pressable onPress={loadSafetyScore} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry safety score</Text>
            </Pressable>
          )}
        </View>

        {/* Safety Alerts */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Safety alerts</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* National Weather Service Alerts */}
        {nwsLoading ? (
          <View style={styles.alertCard}>
            <View style={styles.alertIcon}>
              <ActivityIndicator size="small" color="#4DA3FF" />
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Checking your area...</Text>
              <Text style={styles.alertDescription}>
                SafeRoute is checking the National Weather Service for active
                alerts near you.
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
              <Text style={styles.alertDescription}>{nwsError}</Text>
              <Pressable onPress={loadNWSAlerts} style={styles.retryButton}>
                <Text style={styles.retryText}>Try again</Text>
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
                The National Weather Service isn't currently reporting active
                alerts for your location.
              </Text>
            </View>
          </View>
        ) : (
          nwsAlerts.map((alert) => {
            const alertColor = getNWSAlertColor(alert.severity);

            return (
              <View
                key={alert.id}
                style={[styles.alertCard, { borderColor: alertColor }]}
              >
                <View
                  style={[
                    styles.alertIcon,
                    { backgroundColor: `${alertColor}22` },
                  ]}
                >
                  <Text style={styles.nwsAlertEmoji}>
                    {getNWSAlertIcon(alert.event)}
                  </Text>
                </View>

                <View style={styles.alertContent}>
                  <View style={styles.nwsAlertTitleRow}>
                    <Text style={styles.alertTitle} numberOfLines={2}>
                      {alert.event}
                    </Text>
                    <View
                      style={[
                        styles.nwsSeverityBadge,
                        { backgroundColor: `${alertColor}22` },
                      ]}
                    >
                      <Text
                        style={[styles.nwsSeverityText, { color: alertColor }]}
                      >
                        {alert.severity.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.alertDescription}>{alert.headline}</Text>
                  <Text style={styles.nwsAreaText}>{alert.areaDesc}</Text>

                  {alert.expires ? (
                    <Text style={styles.nwsExpiresText}>
                      Expires {new Date(alert.expires).toLocaleString()}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        {!nwsLoading && (
          <Pressable
            style={styles.refreshAlertsButton}
            onPress={loadNWSAlerts}
          >
            <Ionicons name="refresh" size={15} color="#4DA3FF" />
            <Text style={styles.refreshAlertsText}>
              Refresh weather alerts
            </Text>
          </Pressable>
        )}

        {/* AMBER Alerts */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>AMBER Alerts</Text>
          <View style={styles.amberDelayBadge}>
            <Ionicons name="time-outline" size={11} color="#FF9F43" />
            <Text style={styles.amberDelayText}>24H DELAY</Text>
          </View>
        </View>

        {amberLoading ? (
          <View style={styles.amberCard}>
            <View style={styles.amberIcon}>
              <ActivityIndicator size="small" color="#FF453A" />
            </View>
            <View style={styles.amberContent}>
              <Text style={styles.amberTitle}>Checking AMBER Alerts...</Text>
              <Text style={styles.amberDescription}>
                SafeRoute is checking the official FEMA IPAWS alert archive for
                recent Child Abduction Emergencies.
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
              <Text style={styles.amberTitle}>AMBER Alerts unavailable</Text>
              <Text style={styles.amberDescription}>{amberError}</Text>
              <Pressable onPress={loadAmberAlerts} style={styles.retryButton}>
                <Text style={styles.retryText}>Try again</Text>
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
              <Text style={styles.amberTitle}>No recent AMBER Alerts</Text>
              <Text style={styles.amberDescription}>
                FEMA's IPAWS archive does not currently contain recent Child
                Abduction Emergency records.
              </Text>
            </View>
          </View>
        ) : (
          amberAlerts.map((alert) => (
            <View key={alert.id} style={styles.amberAlertCard}>
              <View style={styles.amberAlertIcon}>
                <Ionicons name="warning" size={22} color="#FF453A" />
              </View>
              <View style={styles.amberContent}>
                <Text style={styles.amberTitle}>{alert.headline}</Text>
                <Text style={styles.amberArea}>{alert.areaDesc}</Text>
                <Text style={styles.amberDescription} numberOfLines={4}>
                  {alert.description}
                </Text>

                {alert.sent ? (
                  <Text style={styles.amberMeta}>
                    Issued {new Date(alert.sent).toLocaleString()}
                  </Text>
                ) : null}

                {alert.expires ? (
                  <Text style={styles.amberMeta}>
                    Expires {new Date(alert.expires).toLocaleString()}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        )}

        {!amberLoading && (
          <Pressable
            style={styles.refreshAlertsButton}
            onPress={loadAmberAlerts}
          >
            <Ionicons name="refresh" size={15} color="#4DA3FF" />
            <Text style={styles.refreshAlertsText}>Refresh AMBER Alerts</Text>
          </Pressable>
        )}

        {/* Community Hazard Reports */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby hazards</Text>
          <Pressable
            onPress={() => setShowAllHazards((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={showAllHazards ? "Show fewer hazards" : "View all hazards"}
          >
            <Text style={styles.viewAll}>
              {showAllHazards ? "Show less" : "View all"}
            </Text>
          </Pressable>
        </View>

        {hazardsLoading ? (
          <View style={styles.hazardCard}>
            <ActivityIndicator size="small" color="#4DA3FF" />
            <View style={[styles.hazardContent, styles.loadingHazardContent]}>
              <Text style={styles.hazardTitle}>
                Loading community reports...
              </Text>
              <Text style={styles.hazardDescription}>
                Checking Firebase for recently submitted hazards.
              </Text>
            </View>
          </View>
        ) : hazardsError ? (
          <View style={styles.hazardCard}>
            <View style={styles.hazardIcon}>
              <Ionicons
                name="cloud-offline-outline"
                size={21}
                color="#FF9F43"
              />
            </View>
            <View style={styles.hazardContent}>
              <Text style={styles.hazardTitle}>Reports unavailable</Text>
              <Text style={styles.hazardDescription}>{hazardsError}</Text>
              <Pressable onPress={loadHazards} style={styles.retryButton}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          </View>
        ) : hazards.length === 0 ? (
          <View style={styles.hazardCard}>
            <View style={styles.hazardIcon}>
              <Ionicons
                name="checkmark-circle-outline"
                size={21}
                color="#55D68A"
              />
            </View>
            <View style={styles.hazardContent}>
              <Text style={styles.hazardTitle}>No community reports yet</Text>
              <Text style={styles.hazardDescription}>
                Be the first to report a road hazard and help your community.
              </Text>
            </View>
          </View>
        ) : (
          displayedHazards.map((hazard) => {
            const presentation = hazardPresentation(hazard.type);

            return (
              <View key={hazard.id} style={styles.hazardCard}>
                <View
                  style={[
                    styles.hazardIcon,
                    { backgroundColor: `${presentation.color}20` },
                  ]}
                >
                  <Ionicons
                    name={presentation.icon}
                    size={21}
                    color={presentation.color}
                  />
                </View>

                <View style={styles.hazardContent}>
                  <View style={styles.hazardTitleRow}>
                    <Text style={styles.hazardTitle}>{hazard.title}</Text>
                    <View
                      style={[
                        styles.mediumBadge,
                        { backgroundColor: `${presentation.color}22` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.mediumText,
                          { color: presentation.color },
                        ]}
                      >
                        {presentation.label}
                      </Text>
                    </View>
                  </View>

                  {hazard.description ? (
                    <Text style={styles.hazardDescription}>
                      {hazard.description}
                    </Text>
                  ) : null}

                  <Text style={styles.reportTime}>
                    {formatReportTime(hazard.createdAt)}
                  </Text>

                  <Text style={[styles.reportTime, styles.coordinates]}>
                    {hazard.latitude.toFixed(4)},{" "}
                    {hazard.longitude.toFixed(4)}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        {!hazardsLoading && !hazardsError && (
          <Pressable style={styles.refreshAlertsButton} onPress={loadHazards}>
            <Ionicons name="refresh" size={15} color="#4DA3FF" />
            <Text style={styles.refreshAlertsText}>
              Refresh community reports
            </Text>
          </Pressable>
        )}

        {/* Report a Hazard */}
        <Pressable
          style={styles.reportButton}
          onPress={() => router.push("/report")}
          accessibilityRole="button"
        >
          <View style={styles.reportButtonIcon}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </View>

          <View style={styles.reportButtonText}>
            <Text style={styles.reportTitle}>Report a hazard</Text>
            <Text style={styles.reportSubtitle}>
              Help keep your community safer
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={21} color="#8EA5BE" />
        </Pressable>

        {/* Community Safety — real Firebase data */}
        <Text style={styles.sectionTitle}>Community safety</Text>

        <View style={styles.communityCard}>
          <View style={styles.communityHeader}>
            <View style={styles.communityIcon}>
              <Ionicons name="people" size={21} color="#A78BFA" />
            </View>
            <View style={styles.communityHeaderText}>
              <Text style={styles.communityTitle}>Local reports</Text>
              <Text style={styles.communitySubtitle}>
                See what your community is reporting
              </Text>
            </View>
          </View>

          <View style={styles.communityStats}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>
                {hazardsLoading ? "—" : hazardsError ? "—" : hazards.length}
              </Text>
              <Text style={styles.statLabel}>Reports</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.stat}>
              <Text style={styles.statNumber}>
                {hazardsLoading || hazardsError ? "—" : hazardTypeCount}
              </Text>
              <Text style={styles.statLabel}>Types</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.stat}>
              <Text style={styles.statNumber}>
                {hazardsLoading || hazardsError
                  ? "—"
                  : displayedHazards.length}
              </Text>
              <Text style={styles.statLabel}>Shown</Text>
            </View>
          </View>

          {hazardsError ? (
            <Text style={styles.communityNote}>
              Unable to retrieve report statistics. Try refreshing the reports
              above.
            </Text>
          ) : !hazardsLoading && hazards.length === 0 ? (
            <Text style={styles.communityNote}>
              Community statistics will appear when reports are submitted.
            </Text>
          ) : null}
        </View>

        {/* SafeRoute AI */}
        <Text style={styles.sectionTitle}>SafeRoute AI</Text>

        <Pressable
          style={styles.aiCard}
          onPress={() => router.push("/ai")}
          accessibilityRole="button"
        >
          <View style={styles.aiIcon}>
            <Ionicons name="sparkles" size={25} color="#FFFFFF" />
          </View>

          <View style={styles.aiContent}>
            <Text style={styles.aiTitle}>Ask about your safety</Text>
            <Text style={styles.aiDescription}>
              Get help understanding alerts, hazards, and safer travel options.
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={21} color="#FFFFFF" />
        </Pressable>

        {/* Emergency Center */}
        <Pressable
          style={styles.emergencyCard}
          onPress={() => router.push("/emergency")}
          accessibilityRole="button"
        >
          <View style={styles.emergencyIcon}>
            <Ionicons name="shield" size={22} color="#FFFFFF" />
          </View>

          <View style={styles.emergencyContent}>
            <Text style={styles.emergencyTitle}>Emergency Center</Text>
            <Text style={styles.emergencySubtitle}>
              Quick access to emergency tools
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={21} color="#FFFFFF" />
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
    paddingBottom: 44,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
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
  scoreHeading: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 12,
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
  scoreCircleUnavailable: {
    backgroundColor: "#172A40",
    borderColor: "#536C87",
  },
  scoreNumber: {
    color: "#55D68A",
    fontSize: 24,
    fontWeight: "900",
  },
  scoreNumberUnavailable: {
    color: "#8297AF",
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
    borderRadius: 5,
  },
  scoreBottom: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 13,
  },
  scoreMessage: {
    flex: 1,
    color: "#8297AF",
    fontSize: 11,
    lineHeight: 17,
    marginLeft: 7,
  },
  scoreCoverage: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 8,
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
    minWidth: 0,
  },
  alertTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 5,
    flexShrink: 1,
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
    minWidth: 0,
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
    minWidth: 0,
  },
  loadingHazardContent: {
    marginLeft: 12,
  },
  hazardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
  },
  hazardTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
    marginRight: 6,
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
  coordinates: {
    marginTop: 4,
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
  communityHeaderText: {
    flex: 1,
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
    flex: 1,
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
  communityNote: {
    color: "#7189A5",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 14,
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
    minWidth: 0,
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
    height: 44,
  },
});