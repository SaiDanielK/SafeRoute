import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import {
  logIn,
  signInGuest,
  signUp,
} from "../firebase/auth";

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAuth() {
    setError("");

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      if (isLogin) {
        await logIn(cleanEmail, password);
      } else {
        await signUp(cleanEmail, password);
      }

      router.replace("/(tabs)");
    } catch (err: any) {
      console.log("SafeRoute auth error:", err);

      switch (err?.code) {
        case "auth/invalid-credential":
          setError("Incorrect email or password.");
          break;

        case "auth/email-already-in-use":
          setError("An account with this email already exists.");
          break;

        case "auth/invalid-email":
          setError("Please enter a valid email address.");
          break;

        case "auth/weak-password":
          setError("Your password is too weak.");
          break;

        case "auth/user-not-found":
          setError("No account was found with this email.");
          break;

        case "auth/wrong-password":
          setError("Incorrect password.");
          break;

        default:
          setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setError("");

    try {
      setLoading(true);
      await signInGuest();
      router.replace("/(tabs)");
    } catch (err) {
      console.log("SafeRoute guest sign-in error:", err);
      setError("Could not continue as a guest. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setError("");
    setIsLogin((current) => !current);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <View style={styles.logoCircle}>
            <Text style={styles.logo}>🛡️</Text>
          </View>

          <Text style={styles.title}>SafeRoute</Text>

          <Text style={styles.subtitle}>
            {isLogin
              ? "Welcome back. Let's get you there safely."
              : "Create your SafeRoute account."}
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>

            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#617B91"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loading}
            />

            <Text style={styles.label}>Password</Text>

            <TextInput
              style={styles.input}
              placeholder="At least 6 characters"
              placeholderTextColor="#617B91"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#04110D" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isLogin ? "Log In" : "Create Account"}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.switchButton}
              onPress={switchMode}
              disabled={loading}
            >
              <Text style={styles.switchText}>
                {isLogin
                  ? "Don't have an account? "
                  : "Already have an account? "}

                <Text style={styles.switchTextBold}>
                  {isLogin ? "Sign Up" : "Log In"}
                </Text>
              </Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.divider} />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.guestButton,
                pressed && styles.guestPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleGuest}
              disabled={loading}
            >
              <Text style={styles.guestButtonText}>
                Continue as Guest
              </Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>
            Your journey. Your destination. A safer way there.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07111F",
  },

  keyboard: {
    flex: 1,
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },

  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#102A43",
    borderWidth: 1,
    borderColor: "#1E496D",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },

  logo: {
    fontSize: 34,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -1.5,
    textAlign: "center",
  },

  subtitle: {
    color: "#A9BDD1",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 7,
    marginBottom: 28,
    textAlign: "center",
  },

  form: {
    width: "100%",
  },

  label: {
    color: "#DCE8F2",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },

  input: {
    height: 54,
    backgroundColor: "#0C1D2E",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#173650",
    color: "#FFFFFF",
    fontSize: 16,
    paddingHorizontal: 16,
    marginBottom: 17,
  },

  errorBox: {
    backgroundColor: "#351A20",
    borderWidth: 1,
    borderColor: "#71313B",
    borderRadius: 13,
    padding: 12,
    marginBottom: 16,
  },

  errorText: {
    color: "#FFB4BE",
    fontSize: 14,
    lineHeight: 20,
  },

  primaryButton: {
    height: 56,
    borderRadius: 17,
    backgroundColor: "#20C997",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  primaryButtonText: {
    color: "#04110D",
    fontSize: 17,
    fontWeight: "800",
  },

  switchButton: {
    alignItems: "center",
    paddingVertical: 17,
  },

  switchText: {
    color: "#8FA8BD",
    fontSize: 14,
  },

  switchTextBold: {
    color: "#20C997",
    fontWeight: "800",
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 5,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#173650",
  },

  orText: {
    color: "#617B91",
    fontSize: 12,
    fontWeight: "700",
    marginHorizontal: 12,
  },

  guestButton: {
    height: 54,
    borderRadius: 17,
    backgroundColor: "#102A43",
    borderWidth: 1,
    borderColor: "#1E496D",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  guestPressed: {
    opacity: 0.75,
  },

  guestButtonText: {
    color: "#DCE8F2",
    fontSize: 16,
    fontWeight: "700",
  },

  footer: {
    color: "#617B91",
    textAlign: "center",
    fontSize: 11,
    marginTop: 24,
  },
});