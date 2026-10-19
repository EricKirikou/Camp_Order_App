import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { C } from "@/components/camporder/ui";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 9 : Math.max(insets.bottom, 8);
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: C.green,
    tabBarInactiveTintColor: "#8A968E",
    tabBarStyle: { height: 57 + bottomPadding, paddingTop: 7, paddingBottom: bottomPadding, backgroundColor: C.white, borderTopColor: C.border, borderTopWidth: 1, elevation: 0 },
    tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
  }}>
    <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
    <Tabs.Screen name="explore" options={{ title: "Explore", tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} /> }} />
    <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} /> }} />
    <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
  </Tabs>;
}
