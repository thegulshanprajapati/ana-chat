import React from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.card}>
        <Text style={styles.title}>AnaChat Mobile</Text>
        <Text style={styles.description}>
          Local-first messaging with SQLite, MMKV caching, and shared backend integration.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    justifyContent: "center",
    alignItems: "center"
  },
  card: {
    margin: 16,
    padding: 24,
    borderRadius: 24,
    backgroundColor: "rgba(15,23,42,0.9)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10
  },
  title: {
    fontSize: 28,
    color: "#f8fafc",
    marginBottom: 12,
    fontWeight: "700"
  },
  description: {
    fontSize: 16,
    color: "#cbd5e1"
  }
});
