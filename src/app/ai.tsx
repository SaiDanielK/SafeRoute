import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

import {
  askSafeRouteAI,
  cancelSafeRouteAI,
  SafeRouteAICancelledError,
} from "../services/geminiService";

import { getActiveNWSAlerts } from "../services/nwsService";
import { getAmberAlerts } from "../services/amberAlertService";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const SUGGESTED_QUESTIONS = [
  "Are there any weather alerts near me right now?",
  "Are there any AMBER Alerts right now?",
  "What should I do during a severe weather alert?",
  "How can I stay safer while walking at night?",
];

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(
        <View
          key={`space-${index}`}
          style={styles.markdownSpacer}
        />
      );

      return;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(
        <Text
          key={`h3-${index}`}
          style={styles.markdownHeading3}
        >
          {renderInlineMarkdown(trimmed.substring(4))}
        </Text>
      );

      return;
    }

    if (trimmed.startsWith("## ")) {
      elements.push(
        <Text
          key={`h2-${index}`}
          style={styles.markdownHeading2}
        >
          {renderInlineMarkdown(trimmed.substring(3))}
        </Text>
      );

      return;
    }

    if (trimmed.startsWith("# ")) {
      elements.push(
        <Text
          key={`h1-${index}`}
          style={styles.markdownHeading1}
        >
          {renderInlineMarkdown(trimmed.substring(2))}
        </Text>
      );

      return;
    }

    if (
      trimmed.startsWith("- ") ||
      trimmed.startsWith("* ")
    ) {
      elements.push(
        <View
          key={`bullet-${index}`}
          style={styles.markdownListRow}
        >
          <Text style={styles.markdownBullet}>
            •
          </Text>

          <Text style={styles.markdownText}>
            {renderInlineMarkdown(trimmed.substring(2))}
          </Text>
        </View>
      );

      return;
    }

    const numberedMatch =
      trimmed.match(/^(\d+)\.\s+(.*)$/);

    if (numberedMatch) {
      elements.push(
        <View
          key={`number-${index}`}
          style={styles.markdownListRow}
        >
          <Text style={styles.markdownNumber}>
            {numberedMatch[1]}.
          </Text>

          <Text style={styles.markdownText}>
            {renderInlineMarkdown(numberedMatch[2])}
          </Text>
        </View>
      );

      return;
    }

    if (trimmed.startsWith("> ")) {
      elements.push(
        <View
          key={`quote-${index}`}
          style={styles.markdownQuote}
        >
          <Text style={styles.markdownQuoteText}>
            {renderInlineMarkdown(trimmed.substring(2))}
          </Text>
        </View>
      );

      return;
    }

    elements.push(
      <Text
        key={`paragraph-${index}`}
        style={styles.markdownText}
      >
        {renderInlineMarkdown(trimmed)}
      </Text>
    );
  });

  return elements;
}

function renderInlineMarkdown(text: string) {
  const parts: React.ReactNode[] = [];

  const regex =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

  const matches = text.split(regex);

  matches.forEach((part, index) => {
    if (!part) {
      return;
    }

    if (
      part.startsWith("**") &&
      part.endsWith("**")
    ) {
      parts.push(
        <Text
          key={`bold-${index}`}
          style={styles.markdownBold}
        >
          {part.slice(2, -2)}
        </Text>
      );

      return;
    }

    if (
      part.startsWith("*") &&
      part.endsWith("*")
    ) {
      parts.push(
        <Text
          key={`italic-${index}`}
          style={styles.markdownItalic}
        >
          {part.slice(1, -1)}
        </Text>
      );

      return;
    }

    if (
      part.startsWith("`") &&
      part.endsWith("`")
    ) {
      parts.push(
        <Text
          key={`code-${index}`}
          style={styles.markdownCode}
        >
          {part.slice(1, -1)}
        </Text>
      );

      return;
    }

    parts.push(
      <Text key={`text-${index}`}>
        {part}
      </Text>
    );
  });

  return parts;
}

export default function AIScreen() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>(
    []
  );

  const [loading, setLoading] = useState(false);

  const [thinkingStatus, setThinkingStatus] =
    useState("Preparing response...");

  const [weatherContext, setWeatherContext] =
    useState("");

  const [amberContext, setAmberContext] =
    useState("");

  const [locationLoading, setLocationLoading] =
    useState(true);

  useEffect(() => {
    loadSafetyData();
  }, []);

  useEffect(() => {
    if (!loading) {
      return;
    }

    const statuses = [
      "Reviewing your question...",
      "Checking your live safety data...",
      "Analyzing the available information...",
      "Preparing a safety response...",
      "Finishing response...",
    ];

    let index = 0;

    setThinkingStatus(statuses[0]);

    const interval = setInterval(() => {
      index =
        (index + 1) % statuses.length;

      setThinkingStatus(statuses[index]);
    }, 2200);

    return () => {
      clearInterval(interval);
    };
  }, [loading]);

  async function loadSafetyData() {
    setLocationLoading(true);

    try {
      const amberPromise = getAmberAlerts();

      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        setWeatherContext(
          "The user has not granted location permission, so current NWS alerts could not be loaded."
        );
      } else {
        const location =
          await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

        try {
          const alerts = await getActiveNWSAlerts(
            location.coords.latitude,
            location.coords.longitude
          );

          if (alerts.length === 0) {
            setWeatherContext(
              "There are currently no active National Weather Service alerts for the user's current location."
            );
          } else {
            const formattedAlerts = alerts
              .map((alert, index) => {
                return [
                  `Alert ${index + 1}:`,
                  `Event: ${alert.event}`,
                  `Headline: ${alert.headline}`,
                  `Severity: ${alert.severity}`,
                  `Urgency: ${alert.urgency}`,
                  `Certainty: ${alert.certainty}`,
                  `Area: ${alert.areaDesc}`,
                  `Description: ${alert.description}`,
                  alert.instruction
                    ? `Instructions: ${alert.instruction}`
                    : "",
                  alert.expires
                    ? `Expires: ${alert.expires}`
                    : "",
                ]
                  .filter(Boolean)
                  .join("\n");
              })
              .join("\n\n");

            setWeatherContext(formattedAlerts);
          }
        } catch {
          setWeatherContext(
            "SafeRoute was unable to retrieve current National Weather Service alerts."
          );
        }
      }

      try {
        const amberAlerts = await amberPromise;

        if (amberAlerts.length === 0) {
          setAmberContext(
            "There are currently no AMBER Alerts in the FEMA/IPAWS archive data available to SafeRoute."
          );
        } else {
          const formattedAmberAlerts =
            amberAlerts
              .map((alert, index) => {
                return [
                  `AMBER Alert ${index + 1}:`,
                  `Event: ${alert.event}`,
                  `Headline: ${alert.headline}`,
                  `Area: ${alert.areaDesc}`,
                  `Description: ${alert.description}`,
                  alert.instruction
                    ? `Instructions: ${alert.instruction}`
                    : "",
                  alert.expires
                    ? `Expires: ${alert.expires}`
                    : "",
                  `Source: ${alert.senderName}`,
                ]
                  .filter(Boolean)
                  .join("\n");
              })
              .join("\n\n");

          setAmberContext(
            formattedAmberAlerts
          );
        }
      } catch {
        setAmberContext(
          "SafeRoute was unable to retrieve AMBER Alert information from the FEMA/IPAWS archive."
        );
      }
    } catch {
      setWeatherContext(
        "SafeRoute was unable to retrieve current weather safety data."
      );

      setAmberContext(
        "SafeRoute was unable to retrieve AMBER Alert information."
      );
    } finally {
      setLocationLoading(false);
    }
  }

  async function handleAsk() {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || loading) {
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmedQuestion,
    };

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    setQuestion("");
    setLoading(true);
    setThinkingStatus("Reviewing your question...");

    try {
      const answer = await askSafeRouteAI(
        trimmedQuestion,
        {
          weatherAlerts: weatherContext,
          amberAlerts: amberContext,
        }
      );

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: answer,
      };

      setMessages((current) => [
        ...current,
        assistantMessage,
      ]);
    } catch (error) {
      /*
       * Cancellation is expected behavior, so don't
       * show an error message when the user presses X.
       */
      if (
        error instanceof SafeRouteAICancelledError
      ) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while contacting SafeRoute AI.";

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        text:
          `Sorry, I couldn't answer that right now.\n\n${message}`,
      };

      setMessages((current) => [
        ...current,
        errorMessage,
      ]);
    } finally {
      setLoading(false);
    }
  }

  function cancelResponse() {
    if (!loading) {
      return;
    }

    /*
     * This now actually aborts the Gemini network
     * request through AbortController.
     */
    cancelSafeRouteAI();

    setLoading(false);
    setThinkingStatus("Response cancelled.");
  }

  function useSuggestedQuestion(value: string) {
    setQuestion(value);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="chevron-back"
            size={26}
            color="#FFFFFF"
          />
        </Pressable>

        <View style={styles.headerIcon}>
          <Ionicons
            name="sparkles"
            size={23}
            color="#FFFFFF"
          />
        </View>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>
            SafeRoute AI
          </Text>

          <Text style={styles.headerSubtitle}>
            {locationLoading
              ? "Loading live safety data..."
              : "Your safety assistant"}
          </Text>
        </View>

        <Pressable
          style={styles.refreshButton}
          onPress={loadSafetyData}
          disabled={locationLoading}
        >
          {locationLoading ? (
            <ActivityIndicator
              size="small"
              color="#7DD3FC"
            />
          ) : (
            <Ionicons
              name="refresh"
              size={19}
              color="#7DD3FC"
            />
          )}
        </Pressable>
      </View>

      {/* LIVE DATA STATUS */}
      <View style={styles.liveDataBar}>
        <View
          style={[
            styles.liveDot,
            locationLoading &&
              styles.liveDotLoading,
          ]}
        />

        <Text style={styles.liveDataText}>
          {locationLoading
            ? "Checking NWS + AMBER Alert data..."
            : "NWS + AMBER Alert data connected"}
        </Text>
      </View>

      {/* CHAT */}
      <ScrollView
        style={styles.messages}
        contentContainerStyle={
          styles.messagesContent
        }
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={styles.welcomeContainer}>
            <View style={styles.largeIcon}>
              <Ionicons
                name="shield-checkmark"
                size={42}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.welcomeTitle}>
              How can I help?
            </Text>

            <Text style={styles.welcomeText}>
              SafeRoute AI can use live weather and
              AMBER Alert information to help answer
              your safety questions.
            </Text>

            <View style={styles.suggestions}>
              {SUGGESTED_QUESTIONS.map(
                (item) => (
                  <Pressable
                    key={item}
                    style={styles.suggestion}
                    onPress={() =>
                      useSuggestedQuestion(item)
                    }
                  >
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={18}
                      color="#7DD3FC"
                    />

                    <Text
                      style={styles.suggestionText}
                    >
                      {item}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          </View>
        ) : (
          <>
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  message.role === "user"
                    ? styles.userRow
                    : styles.assistantRow,
                ]}
              >
                {message.role === "assistant" && (
                  <View
                    style={
                      styles.smallAssistantIcon
                    }
                  >
                    <Ionicons
                      name="sparkles"
                      size={15}
                      color="#FFFFFF"
                    />
                  </View>
                )}

                <View
                  style={[
                    styles.messageBubble,
                    message.role === "user"
                      ? styles.userBubble
                      : styles.assistantBubble,
                  ]}
                >
                  {message.role === "user" ? (
                    <Text
                      style={styles.userMessageText}
                    >
                      {message.text}
                    </Text>
                  ) : (
                    <View>
                      {renderMarkdown(
                        message.text
                      )}
                    </View>
                  )}
                </View>
              </View>
            ))}

            {/* AI THINKING INDICATOR */}
            {loading && (
              <View style={styles.messageRow}>
                <View
                  style={
                    styles.smallAssistantIcon
                  }
                >
                  <Ionicons
                    name="sparkles"
                    size={15}
                    color="#FFFFFF"
                  />
                </View>

                <View
                  style={[
                    styles.messageBubble,
                    styles.assistantBubble,
                    styles.thinkingBubble,
                  ]}
                >
                  <View style={styles.thinkingHeader}>
                    <ActivityIndicator
                      size="small"
                      color="#7DD3FC"
                    />

                    <Text
                      style={
                        styles.thinkingTitle
                      }
                    >
                      SafeRoute AI
                    </Text>
                  </View>

                  <Text
                    style={styles.thinkingStatus}
                  >
                    {thinkingStatus}
                  </Text>

                  <View
                    style={
                      styles.thinkingDots
                    }
                  >
                    <View
                      style={styles.thinkingDot}
                    />
                    <View
                      style={styles.thinkingDot}
                    />
                    <View
                      style={styles.thinkingDot}
                    />
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* INPUT */}
      <View style={styles.inputArea}>
        <TextInput
        value={question}
        onChangeText={setQuestion}
        placeholder={
            loading
            ? "SafeRoute AI is responding..."
            : "Ask about safety..."
        }
        placeholderTextColor="#7E8CA3"
        multiline
        maxLength={1000}
        editable={!loading}
        returnKeyType="send"
        blurOnSubmit={true}
        onSubmitEditing={handleAsk}
        style={[
            styles.input,
            loading && styles.inputDisabled,
        ]}
        />

        {loading ? (
          /*
           * REAL CANCEL BUTTON
           */
          <Pressable
            style={styles.cancelButton}
            onPress={cancelResponse}
          >
            <Ionicons
              name="close"
              size={25}
              color="#FFFFFF"
            />
          </Pressable>
        ) : (
          /*
           * SEND BUTTON
           */
          <Pressable
            style={[
              styles.sendButton,
              !question.trim() &&
                styles.sendButtonDisabled,
            ]}
            onPress={handleAsk}
            disabled={!question.trim()}
          >
            <Ionicons
              name="arrow-up"
              size={22}
              color="#FFFFFF"
            />
          </Pressable>
        )}
      </View>

      {/* DISCLAIMER */}
      <Text style={styles.disclaimer}>
        SafeRoute AI uses live NWS data and
        FEMA/IPAWS AMBER Alert data when available.
        The FEMA/IPAWS archive has a 24-hour delay.
        SafeRoute AI does not replace emergency
        services.
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071426",
  },

  header: {
    minHeight: 92,
    paddingTop: 44,
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#172A42",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#12243A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#176B87",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  headerText: {
    flex: 1,
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },

  headerSubtitle: {
    color: "#91A3BA",
    fontSize: 12,
    marginTop: 2,
  },

  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#102238",
    alignItems: "center",
    justifyContent: "center",
  },

  liveDataBar: {
    height: 34,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0A1C30",
    borderBottomWidth: 1,
    borderBottomColor: "#142941",
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#30D158",
    marginRight: 8,
  },

  liveDotLoading: {
    backgroundColor: "#FFCC00",
  },

  liveDataText: {
    color: "#8FA5BC",
    fontSize: 11,
  },

  messages: {
    flex: 1,
  },

  messagesContent: {
    padding: 18,
    paddingBottom: 24,
    flexGrow: 1,
  },

  welcomeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 30,
  },

  largeIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#176B87",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  welcomeTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },

  welcomeText: {
    color: "#9AAAC0",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 10,
    maxWidth: 360,
  },

  suggestions: {
    width: "100%",
    marginTop: 28,
    gap: 10,
  },

  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#102238",
    borderWidth: 1,
    borderColor: "#1B3552",
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },

  suggestionText: {
    flex: 1,
    color: "#DCE8F5",
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 11,
  },

  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 14,
  },

  userRow: {
    justifyContent: "flex-end",
  },

  assistantRow: {
    justifyContent: "flex-start",
  },

  smallAssistantIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#176B87",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  messageBubble: {
    maxWidth: "82%",
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },

  userBubble: {
    backgroundColor: "#176B87",
    borderBottomRightRadius: 5,
  },

  assistantBubble: {
    backgroundColor: "#102238",
    borderWidth: 1,
    borderColor: "#1B3552",
    borderBottomLeftRadius: 5,
    paddingVertical: 10,
  },

  userMessageText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 21,
  },

  thinkingBubble: {
    minWidth: 220,
    paddingVertical: 13,
  },

  thinkingHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  thinkingTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 9,
  },

  thinkingStatus: {
    color: "#91A3BA",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },

  thinkingDots: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 9,
    gap: 4,
  },

  thinkingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#7DD3FC",
    opacity: 0.7,
  },

  markdownText: {
    color: "#DCE8F5",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 7,
  },

  markdownBold: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  markdownItalic: {
    color: "#DCE8F5",
    fontStyle: "italic",
  },

  markdownCode: {
    backgroundColor: "#172A42",
    color: "#7DD3FC",
    borderRadius: 4,
    paddingHorizontal: 4,
  },

  markdownHeading1: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    marginBottom: 8,
  },

  markdownHeading2: {
    color: "#FFFFFF",
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "700",
    marginBottom: 7,
  },

  markdownHeading3: {
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
    marginBottom: 6,
  },

  markdownListRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
  },

  markdownBullet: {
    color: "#7DD3FC",
    fontSize: 17,
    lineHeight: 21,
    width: 20,
  },

  markdownNumber: {
    color: "#7DD3FC",
    fontSize: 14,
    lineHeight: 21,
    width: 24,
    fontWeight: "700",
  },

  markdownQuote: {
    borderLeftWidth: 3,
    borderLeftColor: "#176B87",
    backgroundColor: "#0A1C30",
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 7,
  },

  markdownQuoteText: {
    color: "#B7C7D9",
    fontSize: 14,
    lineHeight: 20,
  },

  markdownSpacer: {
    height: 3,
  },

  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: "#09182B",
    borderTopWidth: 1,
    borderTopColor: "#172A42",
  },

  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: "#102238",
    borderWidth: 1,
    borderColor: "#1B3552",
    borderRadius: 24,
    paddingHorizontal: 17,
    paddingTop: 13,
    paddingBottom: 11,
    color: "#FFFFFF",
    fontSize: 15,
  },

  inputDisabled: {
    opacity: 0.65,
  },

  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#176B87",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  sendButtonDisabled: {
    opacity: 0.45,
  },

  cancelButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#B4232E",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  disclaimer: {
    color: "#64768D",
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
});