import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { C } from "@/components/camporder/ui";

export default function EntryRoute() {
  const [destination, setDestination] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem("camporder.onboardingComplete").then((value) => {
      if (active) setDestination(value === "1" ? "/(tabs)" : "/onboarding");
    }).catch(() => { if (active) setDestination("/onboarding"); });
    return () => { active = false; };
  }, []);
  if (!destination) return <View style={{ flex: 1, backgroundColor: C.ivory, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.green} /></View>;
  return <Redirect href={destination as any} />;
}
