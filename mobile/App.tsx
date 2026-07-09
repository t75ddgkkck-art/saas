// ArtisanPro Mobile - React Native + Expo
// Push natif + mode offline

import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { View, Text, StyleSheet } from "react-native";

import DashboardScreen from "./screens/DashboardScreen";
import AppointmentsScreen from "./screens/AppointmentsScreen";
import QuotesScreen from "./screens/QuotesScreen";
import ClientsScreen from "./screens/ClientsScreen";

// Configuration des notifications push
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    // Demander permission push au démarrage
    registerForPushNotifications();
  }, []);

  async function registerForPushNotifications() {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      console.log("Permission push refusée");
      return;
    }

    const token = await Notifications.getExpoPushTokenAsync();
    console.log("Push Token:", token.data);

    // Envoyer le token au serveur pour l'associer au compte
    // await fetch("/api/push/register", { method: "POST", body: JSON.stringify({ token: token.data }) });
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator initialRouteName="Dashboard">
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: "ArtisanPro" }}
        />
        <Stack.Screen
          name="Appointments"
          component={AppointmentsScreen}
          options={{ title: "Rendez-vous" }}
        />
        <Stack.Screen
          name="Quotes"
          component={QuotesScreen}
          options={{ title: "Devis" }}
        />
        <Stack.Screen
          name="Clients"
          component={ClientsScreen}
          options={{ title: "Clients" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
