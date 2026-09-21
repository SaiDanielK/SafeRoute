import React from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatDuration } from "../utils/formatters";

type NavigationPanelProps = {
  active: boolean;
  arrived: boolean;
  recalculating: boolean;

  currentStep: {
    instruction: string;
    distanceMeters: number;
  } | null;

  nextStep: {
    instruction: string;
    distanceMeters: number;
  } | null;

  voiceEnabled: boolean;
  nightMode: boolean;

  remainingDistanceMeters: number;
  remainingDurationSeconds: number;

  onStart: () => void;
  onEnd: () => void;
  onFinish: () => void;
  onToggleVoice: () => void;
  onToggleNightMode: () => void;
  onToggleExpanded?: () => void;

  onHeightChange?: (height: number) => void;
};

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) {
    return "0 mi";
  }

  const miles = meters / 1609.344;

  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }

  return `${Math.round(miles)} mi`;
}

export default function NavigationPanel({
  active,
  arrived,
  recalculating,
  currentStep,
  nextStep,
  voiceEnabled,
  nightMode,
  remainingDistanceMeters,
  remainingDurationSeconds,
  onStart,
  onEnd,
  onFinish,
  onToggleVoice,
  onToggleNightMode,
  onToggleExpanded,
  onHeightChange,
}: NavigationPanelProps) {
  function handleLayout(event: LayoutChangeEvent) {
    onHeightChange?.(event.nativeEvent.layout.height);
  }

  if (arrived) {
    return (
      <View
        onLayout={handleLayout}
        style={[
          styles.container,
          nightMode && styles.containerNight,
        ]}
      >
        <View style={styles.arrivedIcon}>
          <Text style={styles.arrivedIconText}>✓</Text>
        </View>

        <Text
          style={[
            styles.title,
            nightMode && styles.textWhite,
          ]}
        >
          You've arrived
        </Text>

        <Text
          style={[
            styles.subtitle,
            nightMode && styles.textMutedNight,
          ]}
        >
          You have reached your destination.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={onFinish}
        >
          <Text style={styles.primaryButtonText}>
            Done
          </Text>
        </Pressable>
      </View>
    );
  }

  if (active) {
    return (
      <View
        onLayout={handleLayout}
        style={[
          styles.container,
          styles.activeContainer,
          nightMode && styles.containerNight,
        ]}
      >
        {recalculating ? (
          <View style={styles.recalculatingBanner}>
            <View style={styles.spinnerDot} />

            <Text style={styles.recalculatingText}>
              Recalculating…
            </Text>
          </View>
        ) : null}

        <View style={styles.activeHeader}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />

            <Text style={styles.liveText}>
              LIVE NAVIGATION
            </Text>
          </View>

          <Pressable
            style={styles.closeButton}
            onPress={onEnd}
          >
            <Text style={styles.closeButtonText}>
              ×
            </Text>
          </Pressable>
        </View>

        {currentStep ? (
          <View style={styles.instructionCard}>
            <View style={styles.instructionIcon}>
              <Text style={styles.instructionIconText}>
                {getDirectionIcon(
                  currentStep.instruction
                )}
              </Text>
            </View>

            <View style={styles.instructionContent}>
              <Text
                style={styles.instructionText}
                numberOfLines={3}
              >
                {currentStep.instruction}
              </Text>

              <Text
                style={[
                  styles.instructionDistance,
                  nightMode &&
                    styles.textMutedNight,
                ]}
              >
                {formatDistance(
                  currentStep.distanceMeters
                )}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.instructionCard}>
            <View style={styles.instructionIcon}>
              <Text style={styles.instructionIconText}>
                →
              </Text>
            </View>

            <View style={styles.instructionContent}>
              <Text
                style={[
                  styles.instructionText,
                  nightMode &&
                    styles.textWhite,
                ]}
              >
                Continue on the route
              </Text>
            </View>
          </View>
        )}

        {nextStep ? (
          <View style={styles.nextStepRow}>
            <Text
              style={[
                styles.nextLabel,
                nightMode &&
                  styles.textMutedNight,
              ]}
            >
              NEXT
            </Text>

            <Text
              style={[
                styles.nextInstruction,
                nightMode &&
                  styles.textWhiteSoft,
              ]}
              numberOfLines={1}
            >
              {nextStep.instruction}
            </Text>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text
              style={[
                styles.statLabel,
                nightMode &&
                  styles.textMutedNight,
              ]}
            >
              ARRIVAL
            </Text>

            <Text
              style={[
                styles.statValue,
                nightMode &&
                  styles.textWhite,
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit
            >
              {formatDuration(
                remainingDurationSeconds
              )}
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.stat}>
            <Text
              style={[
                styles.statLabel,
                nightMode &&
                  styles.textMutedNight,
              ]}
            >
              DISTANCE
            </Text>

            <Text
              style={[
                styles.statValue,
                nightMode &&
                  styles.textWhite,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatDistance(
                remainingDistanceMeters
              )}
            </Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <Pressable
            style={[
              styles.controlButton,
              nightMode &&
                styles.controlButtonNight,
            ]}
            onPress={onToggleVoice}
          >
            <Text style={styles.controlIcon}>
              {voiceEnabled ? "🔊" : "🔇"}
            </Text>

            <Text
              style={[
                styles.controlText,
                nightMode &&
                  styles.textWhiteSoft,
              ]}
            >
              {voiceEnabled
                ? "Voice"
                : "Muted"}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.controlButton,
              nightMode &&
                styles.controlButtonNight,
            ]}
            onPress={onToggleNightMode}
          >
            <Text style={styles.controlIcon}>
              {nightMode ? "☀️" : "🌙"}
            </Text>

            <Text
              style={[
                styles.controlText,
                nightMode &&
                  styles.textWhiteSoft,
              ]}
            >
              {nightMode ? "Day" : "Night"}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.endButton,
              nightMode &&
                styles.endButtonNight,
            ]}
            onPress={onEnd}
          >
            <Text style={styles.endButtonText}>
              End
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.container,
        nightMode && styles.containerNight,
      ]}
    >
      <View style={styles.readyHeader}>
        <View style={styles.readyHeaderText}>
          <Text
            style={[
              styles.readyEyebrow,
              nightMode &&
                styles.textMutedNight,
            ]}
          >
            ROUTE READY
          </Text>

          <Text
            style={[
              styles.title,
              nightMode &&
                styles.textWhite,
            ]}
          >
            Ready to navigate
          </Text>
        </View>

        <View style={styles.readyHeaderActions}>
          {onToggleExpanded ? (
            <Pressable
              style={({ pressed }) => [
                styles.expandButton,
                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={onToggleExpanded}
              accessibilityRole="button"
              accessibilityLabel="Expand route details"
            >
              <Ionicons
                name="expand-outline"
                size={20}
                color="#526A7B"
              />
            </Pressable>
          ) : null}

          <View style={styles.readyShield}>
            <Text style={styles.readyShieldText}>
              🛡️
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.readyStats}>
        <View style={styles.readyStat}>
          <Text
            style={[
              styles.readyStatLabel,
              nightMode &&
                styles.textMutedNight,
            ]}
          >
            ETA
          </Text>

          <Text
            style={styles.readyStatValue}
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            {formatDuration(
              remainingDurationSeconds
            )}
          </Text>
        </View>

        <View style={styles.readyStatDivider} />

        <View style={styles.readyStat}>
          <Text
            style={[
              styles.readyStatLabel,
              nightMode &&
                styles.textMutedNight,
            ]}
          >
            DISTANCE
          </Text>

          <Text
            style={styles.readyStatValue}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatDistance(
              remainingDistanceMeters
            )}
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.buttonPressed,
        ]}
        onPress={onStart}
      >
        <Text style={styles.primaryButtonText}>
          Start Navigation
        </Text>

        <Text style={styles.primaryButtonArrow}>
          →
        </Text>
      </Pressable>

      <View style={styles.readyControls}>
        <Pressable
          style={[
            styles.smallControlButton,
            nightMode &&
              styles.controlButtonNight,
          ]}
          onPress={onToggleVoice}
        >
          <Text style={styles.smallControlIcon}>
            {voiceEnabled ? "🔊" : "🔇"}
          </Text>

          <Text
            style={[
              styles.smallControlText,
              nightMode &&
                styles.textWhiteSoft,
            ]}
          >
            {voiceEnabled
              ? "Voice On"
              : "Voice Off"}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.smallControlButton,
            nightMode &&
              styles.controlButtonNight,
          ]}
          onPress={onToggleNightMode}
        >
          <Text style={styles.smallControlIcon}>
            {nightMode ? "☀️" : "🌙"}
          </Text>

          <Text
            style={[
              styles.smallControlText,
              nightMode &&
                styles.textWhiteSoft,
            ]}
          >
            {nightMode
              ? "Day Mode"
              : "Night Mode"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function getDirectionIcon(
  instruction: string
): string {
  const value =
    instruction.toLowerCase();

  if (
    value.includes("u-turn") ||
    value.includes("uturn")
  ) {
    return "↩";
  }

  if (value.includes("roundabout")) {
    return "⟳";
  }

  if (
    value.includes("left") &&
    value.includes("slight")
  ) {
    return "↙";
  }

  if (
    value.includes("right") &&
    value.includes("slight")
  ) {
    return "↘";
  }

  if (value.includes("left")) {
    return "←";
  }

  if (value.includes("right")) {
    return "→";
  }

  if (
    value.includes("arrive") ||
    value.includes("destination")
  ) {
    return "●";
  }

  return "↑";
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#DCE7F0",
    padding: 18,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 10,
  },

  activeContainer: {
    paddingTop: 14,
  },

  containerNight: {
    backgroundColor: "#081522",
    borderColor: "#183247",
  },

  textWhite: {
    color: "#FFFFFF",
  },

  textWhiteSoft: {
    color: "#DCEAF5",
  },

  textMutedNight: {
    color: "#7893A8",
  },

  arrivedIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#20C997",
    alignSelf: "center",
    marginBottom: 12,
  },

  arrivedIconText: {
    color: "#04110D",
    fontSize: 30,
    fontWeight: "900",
  },

  title: {
    color: "#102030",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  subtitle: {
    color: "#6E8496",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 16,
  },

  readyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  readyHeaderText: {
    flex: 1,
    marginRight: 10,
  },

  readyHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  readyEyebrow: {
    color: "#7893A8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 4,
  },

  readyShield: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F8F3",
  },

  readyShieldText: {
    fontSize: 23,
  },

  expandButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F8",
    borderWidth: 1,
    borderColor: "#E0E8EE",
  },

  readyStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "#F4F8FB",
  },

  readyStat: {
    flex: 1,
  },

  readyStatLabel: {
    color: "#7893A8",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 3,
  },

  readyStatValue: {
    color: "#102030",
    fontSize: 18,
    fontWeight: "800",
  },

  readyStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#D7E2EA",
    marginHorizontal: 16,
  },

  activeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#20C997",
    marginRight: 7,
  },

  liveText: {
    color: "#20A981",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF3F7",
  },

  closeButtonText: {
    color: "#5F7486",
    fontSize: 24,
    lineHeight: 25,
    fontWeight: "400",
  },

  recalculatingBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 13,
    backgroundColor: "#FFF5DD",
    marginBottom: 10,
  },

  spinnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5A100",
    marginRight: 8,
  },

  recalculatingText: {
    color: "#9A6900",
    fontSize: 12,
    fontWeight: "700",
  },

  instructionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: 14,
    backgroundColor: "#F2F7FA",
    marginBottom: 10,
  },

  instructionIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DDF7EF",
    marginRight: 12,
  },

  instructionIconText: {
    color: "#0F9E79",
    fontSize: 27,
    fontWeight: "800",
  },

  instructionContent: {
    flex: 1,
  },

  instructionText: {
    color: "#102030",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
  },

  instructionDistance: {
    color: "#71889A",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },

  nextStepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    marginBottom: 13,
  },

  nextLabel: {
    color: "#8AA0B0",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginRight: 8,
  },

  nextInstruction: {
    flex: 1,
    color: "#4D6679",
    fontSize: 11,
    fontWeight: "600",
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E3EBF0",
    paddingVertical: 12,
    marginBottom: 12,
  },

  stat: {
    flex: 1,
  },

  statLabel: {
    color: "#8AA0B0",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 3,
  },

  statValue: {
    color: "#102030",
    fontSize: 18,
    fontWeight: "800",
  },

  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#DCE6EC",
    marginHorizontal: 14,
  },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  controlButton: {
    flex: 1,
    minHeight: 43,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F8",
    borderWidth: 1,
    borderColor: "#E0E8EE",
  },

  controlButtonNight: {
    backgroundColor: "#102333",
    borderColor: "#1D3B50",
  },

  controlIcon: {
    fontSize: 15,
    marginBottom: 2,
  },

  controlText: {
    color: "#4C6475",
    fontSize: 9,
    fontWeight: "700",
  },

  endButton: {
    minHeight: 43,
    paddingHorizontal: 17,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFE8E8",
    borderWidth: 1,
    borderColor: "#FFD0D0",
  },

  endButtonNight: {
    backgroundColor: "#35191D",
    borderColor: "#5C292F",
  },

  endButtonText: {
    color: "#D84A4A",
    fontSize: 10,
    fontWeight: "800",
  },

  primaryButton: {
    height: 56,
    borderRadius: 17,
    backgroundColor: "#20C997",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  primaryButtonText: {
    color: "#04110D",
    fontSize: 16,
    fontWeight: "900",
  },

  primaryButtonArrow: {
    color: "#04110D",
    fontSize: 23,
    fontWeight: "800",
    marginLeft: 9,
  },

  readyControls: {
    flexDirection: "row",
    gap: 8,
    marginTop: 9,
  },

  smallControlButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F8",
    borderWidth: 1,
    borderColor: "#E0E8EE",
  },

  smallControlIcon: {
    fontSize: 14,
    marginRight: 5,
  },

  smallControlText: {
    color: "#526A7B",
    fontSize: 9,
    fontWeight: "700",
  },
});