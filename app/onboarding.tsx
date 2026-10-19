import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BrandMark, Button, C } from "@/components/camporder/ui";
import { assetUrl, ASSET_PATHS } from "@/lib/camporder/assets";

const SLIDES = [
  { eyebrow: "MADE FOR CAMPUS DAYS", title: "Food, when you need it.", copy: "Find sample meals and local essentials from one simple campus marketplace.", image: ASSET_PATHS.campusDelivery, icon: "fast-food-outline" as const },
  { eyebrow: "EVERYDAY ESSENTIALS", title: "The little things, sorted.", copy: "Browse drinks, groceries, study basics and student-friendly bundles.", image: ASSET_PATHS.essentials, icon: "basket-outline" as const },
  { eyebrow: "MORE TIME FOR YOU", title: "Ask for a helping hand.", copy: "Request errands, a laundry booking, printing or other useful campus services.", image: ASSET_PATHS.jollof, icon: "sparkles-outline" as const },
];
const ONBOARDING_KEY = "camporder.onboardingComplete";

export default function OnboardingScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const slide = SLIDES[index];
  const continueTo = async (path: "/(tabs)" | "/(auth)/login" | "/(auth)/campus") => {
    setLoading(true);
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    router.replace(path);
    setLoading(false);
  };
  return <View style={{ flex: 1, backgroundColor: C.ivory, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18, justifyContent: "space-between" }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><BrandMark /><Pressable onPress={() => void continueTo("/(tabs)")} accessibilityRole="button"><Text style={{ color: C.green, fontWeight: "800", fontSize: 13 }}>Skip</Text></Pressable></View>
    <View style={{ gap: 18 }}>
      <View style={{ height: 300, borderRadius: 28, overflow: "hidden", backgroundColor: C.sage }}><Image source={{ uri: assetUrl(slide.image) }} contentFit="cover" style={{ width: "100%", height: "100%" }} /><View style={{ position: "absolute", top: 15, left: 15, backgroundColor: "rgba(255,253,248,0.95)", width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" }}><Ionicons name={slide.icon} size={23} color={C.green} /></View><View style={{ position: "absolute", bottom: 15, left: 15, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(13,112,72,0.93)" }}><Text style={{ color: C.white, fontWeight: "900", fontSize: 9, letterSpacing: 0.9 }}>SAMPLE CAMPUS PREVIEW</Text></View></View>
      <View style={{ gap: 9 }}><Text style={{ color: C.green, letterSpacing: 1.2, fontSize: 10, fontWeight: "900" }}>{slide.eyebrow}</Text><Text style={{ color: C.ink, fontSize: 31, lineHeight: 36, letterSpacing: -1.1, fontWeight: "900" }}>{slide.title}</Text><Text style={{ color: C.muted, fontSize: 15, lineHeight: 22 }}>{slide.copy}</Text></View>
    </View>
    <View style={{ gap: 14 }}><View style={{ flexDirection: "row", gap: 6 }}>{SLIDES.map((_, dot) => <View key={dot} style={{ width: dot === index ? 23 : 7, height: 7, borderRadius: 8, backgroundColor: dot === index ? C.green : "#CBD8CE" }} />)}</View>
      <Button title={index === SLIDES.length - 1 ? "Choose your campus" : "Continue"} icon="arrow-forward" onPress={() => index < SLIDES.length - 1 ? setIndex(index + 1) : void continueTo("/(auth)/campus")} loading={loading} />
      <Pressable onPress={() => void continueTo("/(auth)/login")} style={{ paddingVertical: 7 }}><Text style={{ textAlign: "center", color: C.green, fontWeight: "800", fontSize: 13 }}>Already have an account? Sign in</Text></Pressable>
      <Text style={{ textAlign: "center", color: C.muted, fontSize: 10, lineHeight: 15 }}>Campus listings are sample content; real availability depends on verified local partners.</Text>
    </View>
  </View>;
}
