import React from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";

const mockAppointments = [
  { id: "1", title: "Réparation fuite", client: "Marie L.", date: "2025-01-15", time: "09:00" },
  { id: "2", title: "Installation chauffe-eau", client: "Pierre M.", date: "2025-01-16", time: "14:00" },
];

export default function AppointmentsScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={mockAppointments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.client}>{item.client}</Text>
            <Text style={styles.time}>{item.date} • {item.time}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucun rendez-vous</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  card: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  client: { fontSize: 14, color: "#64748b", marginTop: 4 },
  time: { fontSize: 13, color: "#94a3b8", marginTop: 8 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
});
