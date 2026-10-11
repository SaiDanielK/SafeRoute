
import React, { useMemo, useRef } from "react";
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatDuration } from "../utils/formatters";

export type NavigationPreviewStep = {
  instruction: string;
  distanceMeters: number;
  coordinate: {
    latitude: number;
    longitude: number;
  } | null;
};

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

  previewSteps?: NavigationPreviewStep[];
  activeStepIndex?: number;
  previewStepIndex?: number | null;
  onPreviewStepChange?: (index: number | null) => void;
};

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) {
    return "0 mi";
  }

  const miles = meters / 1609.344;

  return miles < 10
    ? `${miles.toFixed(1)} mi`
    : `${Math.round(miles)} mi`;
}

function getDirectionIcon(instruction: string): string {
  const value = instruction.toLowerCase();

  if (value.includes("u-turn") || value.includes("uturn")) return "↩";
  if (value.includes("roundabout")) return "⟳";
  if (value.includes("left") && value.includes("slight")) return "↙";
  if (value.includes("right") && value.includes("slight")) return "↘";
  if (value.includes("left")) return "←";
  if (value.includes("right")) return "→";
  if (value.includes("arrive") || value.includes("destination")) return "●";

  return "↑";
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
  previewSteps = [],
  activeStepIndex = 0,
  previewStepIndex = null,
  onPreviewStepChange,
}: NavigationPanelProps) {
  const translateX = useRef(new Animated.Value(0)).current;

  function handleLayout(event: LayoutChangeEvent) {
    onHeightChange?.(event.nativeEvent.layout.height);
  }

  const safeActiveStepIndex = Math.max(
    0,
    Math.min(
      Number.isFinite(activeStepIndex) ? activeStepIndex : 0,
      Math.max(0, previewSteps.length - 1)
    )
  );

  const isPreviewing =
    previewStepIndex !== null &&
    previewStepIndex !== undefined &&
    Number.isInteger(previewStepIndex) &&
    previewStepIndex >= safeActiveStepIndex &&
    previewStepIndex < previewSteps.length;

  const safePreviewStepIndex = isPreviewing
    ? previewStepIndex
    : safeActiveStepIndex;

  const displayedStep = isPreviewing
    ? previewSteps[safePreviewStepIndex]
    : currentStep;

  const displayedNextStep = isPreviewing
    ? previewSteps[safePreviewStepIndex + 1] ?? null
    : nextStep;

  const snapCardBack = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      stiffness: 240,
      damping: 24,
      mass: 0.7,
    }).start();
  };

  const animateToInstruction = (
    direction: "left" | "right",
    nextIndex: number | null
  ) => {
    const outgoingX = direction === "left" ? -440 : 440;
    const incomingX = direction === "left" ? 440 : -440;

    Animated.timing(translateX, {
      toValue: outgoingX,
      duration: 155,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        translateX.setValue(0);
        return;
      }

      onPreviewStepChange?.(nextIndex);

      translateX.setValue(incomingX);

      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        stiffness: 230,
        damping: 23,
        mass: 0.75,
      }).start();
    });
  };

  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,

        onMoveShouldSetPanResponder: (_, gestureState) =>
          active &&
          !arrived &&
          previewSteps.length > 0 &&
          Math.abs(gestureState.dx) > 8 &&
          Math.abs(gestureState.dx) >
            Math.abs(gestureState.dy) * 1.2,

        onPanResponderGrant: () => {
          translateX.stopAnimation();
        },

        onPanResponderMove: (_, gestureState) => {
          // The card physically follows the user's finger.
          translateX.setValue(gestureState.dx);
        },

        onPanResponderRelease: (_, gestureState) => {
          if (
            !active ||
            arrived ||
            !onPreviewStepChange ||
            previewSteps.length === 0
          ) {
            snapCardBack();
            return;
          }

          const horizontalDistance = Math.abs(gestureState.dx);
          const verticalDistance = Math.abs(gestureState.dy);

          if (
            horizontalDistance < 45 ||
            horizontalDistance < verticalDistance * 1.1
          ) {
            snapCardBack();
            return;
          }

          const currentIndex = isPreviewing
            ? safePreviewStepIndex
            : safeActiveStepIndex;

          if (gestureState.dx < 0) {
            // Drag left to reveal the next instruction.
            const nextIndex = Math.min(
              previewSteps.length - 1,
              currentIndex + 1
            );

            if (nextIndex !== currentIndex) {
              animateToInstruction("left", nextIndex);
            } else {
              snapCardBack();
            }

            return;
          }

          // Drag right to go back or return to live navigation.
          if (currentIndex > safeActiveStepIndex) {
            const previousIndex = currentIndex - 1;

            animateToInstruction(
              "right",
              previousIndex <= safeActiveStepIndex
                ? null
                : previousIndex
            );
          } else if (isPreviewing) {
            animateToInstruction("right", null);
          } else {
            snapCardBack();
          }
        },

        onPanResponderTerminate: () => {
          snapCardBack();
        },

        onPanResponderTerminationRequest: () => false,
      }),
    [
      active,
      arrived,
      previewSteps,
      isPreviewing,
      safePreviewStepIndex,
      safeActiveStepIndex,
      onPreviewStepChange,
      translateX,
    ]
  );

  if (arrived) {
    return (
      <View
        onLayout={handleLayout}
        style={[styles.container, nightMode && styles.containerNight]}
      >
        <View style={styles.arrivedIcon}>
          <Text style={styles.arrivedIconText}>✓</Text>
        </View>

        <Text style={[styles.title, nightMode && styles.textWhite]}>
          You've arrived
        </Text>

        <Text style={[styles.subtitle, nightMode && styles.textMutedNight]}>
          You have reached your destination.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={onFinish}
          accessibilityRole="button"
          accessibilityLabel="Finish navigation"
        >
          <Text style={styles.primaryButtonText}>Done</Text>
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
            <Text style={styles.recalculatingText}>Recalculating…</Text>
          </View>
        ) : null}

        <View style={styles.activeHeader}>
          <View style={styles.liveIndicator}>
            <View
              style={[
                styles.liveDot,
                isPreviewing && styles.previewDot,
              ]}
            />

            <Text
              style={[
                styles.liveText,
                isPreviewing && styles.previewHeaderText,
              ]}
            >
              {isPreviewing ? "TURN PREVIEW" : "LIVE NAVIGATION"}
            </Text>
          </View>

          <Pressable
            style={styles.closeButton}
            onPress={onEnd}
            accessibilityRole="button"
            accessibilityLabel="End navigation"
          >
            <Text style={styles.closeButtonText}>×</Text>
          </Pressable>
        </View>

        {isPreviewing ? (
          <View style={styles.previewBanner}>
            <Ionicons name="eye-outline" size={15} color="#0C8E70" />

            <Text style={styles.previewBannerText}>
              PREVIEW TURN {safePreviewStepIndex + 1} OF {previewSteps.length}
            </Text>

            <Text style={styles.previewSwipeHint}>Swipe to browse</Text>
          </View>
        ) : previewSteps.length > 0 ? (
          <View style={styles.swipeHintRow}>
            <Ionicons
              name="swap-horizontal-outline"
              size={14}
              color={nightMode ? "#7893A8" : "#8298A8"}
            />

            <Text
              style={[
                styles.swipeHintText,
                nightMode && styles.textMutedNight,
              ]}
            >
              Swipe the instruction to preview upcoming turns
            </Text>
          </View>
        ) : null}

        <Animated.View
          {...swipeResponder.panHandlers}
          style={[
            styles.instructionCard,
            isPreviewing && styles.instructionCardPreview,
            nightMode && styles.instructionCardNight,
            {
              transform: [{ translateX }],
            },
          ]}
          accessible
          accessibilityLabel={
            displayedStep?.instruction ?? "Continue on the route"
          }
        >
          <View
            style={[
              styles.instructionIcon,
              isPreviewing && styles.instructionIconPreview,
            ]}
          >
            <Text style={styles.instructionIconText}>
              {displayedStep
                ? getDirectionIcon(displayedStep.instruction)
                : "→"}
            </Text>
          </View>

          <View style={styles.instructionContent}>
            <Text
              style={[
                styles.instructionText,
                nightMode && styles.textWhite,
              ]}
              numberOfLines={3}
            >
              {displayedStep?.instruction ?? "Continue on the route"}
            </Text>

            {displayedStep ? (
              <Text
                style={[
                  styles.instructionDistance,
                  nightMode && styles.textMutedNight,
                ]}
              >
                {formatDistance(displayedStep.distanceMeters)}
              </Text>
            ) : null}
          </View>

          {isPreviewing ? (
            <View style={styles.previewEye}>
              <Ionicons name="eye" size={18} color="#0C8E70" />
            </View>
          ) : null}
        </Animated.View>

        {isPreviewing ? (
          <Pressable
            style={({ pressed }) => [
              styles.returnLiveButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {
              translateX.setValue(0);
              onPreviewStepChange?.(null);
            }}
            accessibilityRole="button"
            accessibilityLabel="Return to live navigation"
          >
            <Ionicons name="navigate" size={15} color="#0C8E70" />

            <Text style={styles.returnLiveText}>
              Return to Live Navigation
            </Text>
          </Pressable>
        ) : null}

        {displayedNextStep ? (
          <View style={styles.nextStepRow}>
            <Text
              style={[
                styles.nextLabel,
                nightMode && styles.textMutedNight,
              ]}
            >
              NEXT
            </Text>

            <Text
              style={[
                styles.nextInstruction,
                nightMode && styles.textWhiteSoft,
              ]}
              numberOfLines={1}
            >
              {displayedNextStep.instruction}
            </Text>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text
              style={[
                styles.statLabel,
                nightMode && styles.textMutedNight,
              ]}
            >
              ARRIVAL
            </Text>

            <Text
              style={[
                styles.statValue,
                nightMode && styles.textWhite,
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit
            >
              {formatDuration(remainingDurationSeconds)}
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.stat}>
            <Text
              style={[
                styles.statLabel,
                nightMode && styles.textMutedNight,
              ]}
            >
              DISTANCE
            </Text>

            <Text
              style={[
                styles.statValue,
                nightMode && styles.textWhite,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatDistance(remainingDistanceMeters)}
            </Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <Pressable
            style={[
              styles.controlButton,
              nightMode && styles.controlButtonNight,
            ]}
            onPress={onToggleVoice}
            accessibilityRole="button"
            accessibilityLabel={
              voiceEnabled ? "Mute voice guidance" : "Enable voice guidance"
            }
          >
            <Text style={styles.controlIcon}>
              {voiceEnabled ? "🔊" : "🔇"}
            </Text>

            <Text
              style={[
                styles.controlText,
                nightMode && styles.textWhiteSoft,
              ]}
            >
              {voiceEnabled ? "Voice" : "Muted"}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.controlButton,
              nightMode && styles.controlButtonNight,
            ]}
            onPress={onToggleNightMode}
            accessibilityRole="button"
            accessibilityLabel="Toggle navigation night mode"
          >
            <Text style={styles.controlIcon}>
              {nightMode ? "☀️" : "🌙"}
            </Text>

            <Text
              style={[
                styles.controlText,
                nightMode && styles.textWhiteSoft,
              ]}
            >
              {nightMode ? "Day" : "Night"}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.endButton,
              nightMode && styles.endButtonNight,
            ]}
            onPress={onEnd}
            accessibilityRole="button"
            accessibilityLabel="End navigation"
          >
            <Text style={styles.endButtonText}>End</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      onLayout={handleLayout}
      style={[styles.container, nightMode && styles.containerNight]}
    >
      <View style={styles.readyHeader}>
        <View style={styles.readyHeaderText}>
          <Text
            style={[
              styles.readyEyebrow,
              nightMode && styles.textMutedNight,
            ]}
          >
            ROUTE READY
          </Text>

          <Text style={[styles.title, nightMode && styles.textWhite]}>
            Ready to navigate
          </Text>
        </View>

        <View style={styles.readyHeaderActions}>
          {onToggleExpanded ? (
            <Pressable
              style={({ pressed }) => [
                styles.expandButton,
                pressed && styles.buttonPressed,
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
            <Text style={styles.readyShieldText}>🛡️</Text>
          </View>
        </View>
      </View>

      <View style={styles.readyStats}>
        <View style={styles.readyStat}>
          <Text
            style={[
              styles.readyStatLabel,
              nightMode && styles.textMutedNight,
            ]}
          >
            ETA
          </Text>

          <Text
            style={[
              styles.readyStatValue,
              nightMode && styles.textWhite,
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            {formatDuration(remainingDurationSeconds)}
          </Text>
        </View>

        <View style={styles.readyStatDivider} />

        <View style={styles.readyStat}>
          <Text
            style={[
              styles.readyStatLabel,
              nightMode && styles.textMutedNight,
            ]}
          >
            DISTANCE
          </Text>

          <Text
            style={[
              styles.readyStatValue,
              nightMode && styles.textWhite,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatDistance(remainingDistanceMeters)}
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.buttonPressed,
        ]}
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel="Start navigation"
      >
        <Text style={styles.primaryButtonText}>Start Navigation</Text>
        <Text style={styles.primaryButtonArrow}>→</Text>
      </Pressable>

      <View style={styles.readyControls}>
        <Pressable
          style={[
            styles.smallControlButton,
            nightMode && styles.controlButtonNight,
          ]}
          onPress={onToggleVoice}
          accessibilityRole="button"
          accessibilityLabel={
            voiceEnabled ? "Mute voice guidance" : "Enable voice guidance"
          }
        >
          <Text style={styles.smallControlIcon}>
            {voiceEnabled ? "🔊" : "🔇"}
          </Text>

          <Text
            style={[
              styles.smallControlText,
              nightMode && styles.textWhiteSoft,
            ]}
          >
            {voiceEnabled ? "Voice On" : "Voice Off"}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.smallControlButton,
            nightMode && styles.controlButtonNight,
          ]}
          onPress={onToggleNightMode}
          accessibilityRole="button"
          accessibilityLabel="Toggle navigation night mode"
        >
          <Text style={styles.smallControlIcon}>
            {nightMode ? "☀️" : "🌙"}
          </Text>

          <Text
            style={[
              styles.smallControlText,
              nightMode && styles.textWhiteSoft,
            ]}
          >
            {nightMode ? "Day Mode" : "Night Mode"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
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
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  activeContainer: { paddingTop: 14 },
  containerNight: {
    backgroundColor: "#081522",
    borderColor: "#183247",
  },
  textWhite: { color: "#FFFFFF" },
  textWhiteSoft: { color: "#DCEAF5" },
  textMutedNight: { color: "#7893A8" },
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
  readyHeaderText: { flex: 1, marginRight: 10 },
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
  readyShieldText: { fontSize: 23 },
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
  readyStat: { flex: 1 },
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
  liveIndicator: { flexDirection: "row", alignItems: "center" },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#20C997",
    marginRight: 7,
  },
  previewDot: { backgroundColor: "#E5A100" },
  liveText: {
    color: "#20A981",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  previewHeaderText: { color: "#B47A00" },
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
  swipeHintRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 3,
  },
  swipeHintText: {
    color: "#8298A8",
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 5,
    flex: 1,
  },
  previewBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#E5F8F2",
    marginBottom: 8,
  },
  previewBannerText: {
    color: "#0C8E70",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
    marginLeft: 6,
  },
  previewSwipeHint: {
    color: "#368C78",
    fontSize: 9,
    fontWeight: "600",
    marginLeft: "auto",
  },
  instructionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: 14,
    backgroundColor: "#F2F7FA",
    marginBottom: 10,
  },
  instructionCardPreview: {
    borderWidth: 1,
    borderColor: "#78D8BE",
    backgroundColor: "#F0FBF7",
  },
  instructionCardNight: {
    backgroundColor: "#102333",
    borderColor: "#1D3B50",
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
  instructionIconPreview: { backgroundColor: "#C9F2E5" },
  instructionIconText: {
    color: "#0F9E79",
    fontSize: 27,
    fontWeight: "800",
  },
  instructionContent: { flex: 1 },
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
  previewEye: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D8F5EA",
    marginLeft: 8,
  },
  returnLiveButton: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: "#E5F8F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    paddingHorizontal: 12,
    gap: 7,
  },
  returnLiveText: {
    color: "#0C8E70",
    fontSize: 11,
    fontWeight: "800",
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
  stat: { flex: 1 },
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
  controlIcon: { fontSize: 15, marginBottom: 2 },
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
