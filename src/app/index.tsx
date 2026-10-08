
import { router } from "expo-router";
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoCircle}>
          <Text style={styles.logo}>🛡️</Text>
        </View>

        <Text style={styles.title}>Welcome to SafeRoute!</Text>

        <Text style={styles.subtitle}>
          Navigation that thinks about your safety.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.push("/auth")}
        >
          <Text style={styles.buttonText}>Get Started</Text>
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
    paddingHorizontal: 28,
    justifyContent: "center",
    alignItems: "center",
  },

  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#102A43",
    borderWidth: 1,
    borderColor: "#1E496D",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },

  logo: {
    fontSize: 45,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 35,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -1,
  },

  subtitle: {
    color: "#A9BDD1",
    fontSize: 17,
    lineHeight: 26,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 42,
  },

  button: {
    width: "100%",
    height: 60,
    borderRadius: 18,
    backgroundColor: "#20C997",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  buttonText: {
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
    marginTop: 30,
  },
});