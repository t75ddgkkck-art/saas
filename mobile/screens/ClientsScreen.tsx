import React from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";

const mockClients = [
  { id: "1", name: "Marie Lefebvre", phone: "+33611223344", spent: "1250 €" },
  { id: "2", name: "Pierre Martin", phone: "+33655667788", spent: "890 €" },
];

export default function ClientsScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={mockClients}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.phone}>{item.phone}</Text>
            <Text style={styles.spent}>{item.spent} dépensés</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  card: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 10 },
  name: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  phone: { fontSize: 14, color: "#64748b", marginTop: 4 },
  spent: { fontSize: 14, color: "#10b981", fontWeight: "500", marginTop: 8 },
});
