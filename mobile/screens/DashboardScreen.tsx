import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function DashboardScreen() {
  const navigation = useNavigation<any>();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bonjour 👋</Text>
        <Text style={styles.subtitle}>Tableau de bord</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="CA" value="0 €" color="#10b981" />
        <StatCard label="RDV" value="0" color="#3b82f6" />
        <StatCard label="Devis" value="0" color="#8b5cf6" />
        <StatCard label="Clients" value="0" color="#f59e0b" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate("Appointments")}>
          <Text style={styles.actionText}>📅 Nouveau RDV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate("Quotes")}>
          <Text style={styles.actionText}>📄 Nouveau devis</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate("Clients")}>
          <Text style={styles.actionText}>👥 Ajouter client</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: "bold", color: "#0f172a" },
  subtitle: { fontSize: 16, color: "#64748b", marginTop: 4 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", padding: 10, gap: 10 },
  statCard: { flex: 1, minWidth: "45%", backgroundColor: "#fff", padding: 16, borderRadius: 12, borderLeftWidth: 4 },
  statValue: { fontSize: 24, fontWeight: "bold", color: "#0f172a" },
  statLabel: { fontSize: 14, color: "#64748b", marginTop: 4 },
  section: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#0f172a", marginBottom: 12 },
  actionButton: { backgroundColor: "#0f172a", padding: 16, borderRadius: 12, marginBottom: 10 },
  actionText: { color: "#fff", fontSize: 16, fontWeight: "500" },
});
