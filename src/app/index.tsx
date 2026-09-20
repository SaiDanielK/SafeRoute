import { router } from "expo-router";
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoCircle}>
          <Text style={styles.logo}>🛡️</Text>
        </View>

        <Text style={styles.title}>SafeRoute</Text>

        <Text style={styles.subtitle}>
          Navigation that thinks about your safety.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Text style={styles.cardIconText}>🗺️</Text>
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Safer navigation</Text>

            <Text style={styles.cardDescription}>
              Find routes based on more than just speed. SafeRoute will
              consider safety information, hazards, and your travel conditions.
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.push("/map")}
        >
          <Text style={styles.primaryButtonText}>Open Map</Text>
          <Text style={styles.arrow}>→</Text>
        </Pressable>

        <Text style={styles.footer}>
          Your journey. Your destination. A safer way there.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07111F",
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },

  logoCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#102A43",
    borderWidth: 1,
    borderColor: "#1E496D",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },

  logo: {
    fontSize: 38,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -1.5,
  },

  subtitle: {
    color: "#A9BDD1",
    fontSize: 18,
    lineHeight: 27,
    marginTop: 8,
    marginBottom: 34,
    maxWidth: 340,
  },

  card: {
    flexDirection: "row",
    backgroundColor: "#0C1D2E",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#173650",
    padding: 18,
    marginBottom: 18,
  },

  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#123451",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  cardIconText: {
    fontSize: 24,
  },

  cardContent: {
    flex: 1,
  },

  cardTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 5,
  },

  cardDescription: {
    color: "#8FA8BD",
    fontSize: 14,
    lineHeight: 21,
  },

  primaryButton: {
    height: 60,
    borderRadius: 18,
    backgroundColor: "#20C997",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },

  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  primaryButtonText: {
    color: "#04110D",
    fontSize: 17,
    fontWeight: "800",
  },

  arrow: {
    color: "#04110D",
    fontSize: 25,
    fontWeight: "700",
    marginLeft: 10,
  },

  footer: {
    color: "#617B91",
    textAlign: "center",
    fontSize: 12,
    marginTop: 28,
  },
});