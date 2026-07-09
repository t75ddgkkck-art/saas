import React from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";

const mockQuotes = [
  { id: "1", number: "DEV-2025-001", client: "Sophie B.", total: "4200 €", status: "Envoyé" },
  { id: "2", number: "DEV-2025-002", client: "Lucas R.", total: "890 €", status: "Accepté" },
];

export default function QuotesScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={mockQuotes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.number}>{item.number}</Text>
            <Text style={styles.client}>{item.client}</Text>
            <View style={styles.row}>
              <Text style={styles.total}>{item.total}</Text>
              <Text style={styles.status}>{item.status}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  card: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 10 },
  number: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  client: { fontSize: 14, color: "#64748b", marginTop: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  total: { fontSize: 18, fontWeight: "bold", color: "#0f172a" },
  status: { fontSize: 14, color: "#10b981", fontWeight: "500" },
});
