import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Button, C } from "@/components/camporder/ui";
import { ASSET_PATHS } from "@/lib/camporder/assets";

const SLIDES = [
  { eyebrow: "DELIVERY, ON YOUR ROUTE", title: "Campus to your door.", copy: "Order from nearby kitchens, shops, and campus essentials delivered straight to your door.", image: ASSET_PATHS.campusDelivery, icon: "bicycle-outline" as const },
  { eyebrow: "GOOD FOOD, CLOSE BY", title: "Your next meal, sorted.", copy: "Find comforting meals and refreshing drinks between lectures and study sessions.", image: ASSET_PATHS.jollof, icon: "fast-food-outline" as const },
  { eyebrow: "FRESH PICKS FOR YOUR DAY", title: "Stock up on campus.", copy: "Browse grocery staples and everyday essentials without leaving your campus routine.", image: ASSET_PATHS.essentials, icon: "basket-outline" as const },
];
const ONBOARDING_KEY = "camporder.onboardingComplete";

export default function OnboardingScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const slide = SLIDES[index];
  const continueTo = async (path: "/(tabs)" | "/(auth)/login" | "/(auth)/campus") => {
    setLoading(true);
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, "1");
      router.replace(path);
    } finally {
      setLoading(false);
    }
  };
  const imageHeight = Math.min(390, Math.max(250, height * 0.42));

  return <View style={{ flex: 1, backgroundColor: C.ivory, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 18, justifyContent: "space-between" }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Image source={ASSET_PATHS.favicon} contentFit="contain" style={{ width: 34, height: 34 }} />
        <Text style={{ color: C.ink, fontSize: 19 }}><Text style={{ fontWeight: "400" }}>Camp</Text><Text style={{ fontWeight: "800" }}>Order</Text></Text>
      </View>
      <Text style={{ color: C.muted, fontSize: 12, fontWeight: "700" }}>{String(index + 1).padStart(2, "0")} / 03</Text>
      <Pressable onPress={() => void continueTo("/(tabs)")} accessibilityRole="button" accessibilityLabel="Skip onboarding" hitSlop={10}><Text style={{ color: C.green, fontWeight: "800", fontSize: 13 }}>Skip</Text></Pressable>
    </View>

    <View style={{ gap: 20 }}>
      <View style={{ height: imageHeight, borderRadius: 24, overflow: "hidden", backgroundColor: C.sage }}>
        <Image source={slide.image} contentFit="cover" style={{ width: "100%", height: "100%" }} />
        <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(12,34,24,0.12)" }} />
        <View style={{ position: "absolute", left: 14, top: 14, width: 42, height: 42, borderRadius: 14, backgroundColor: C.ivory, alignItems: "center", justifyContent: "center" }}><Ionicons name={slide.icon} size={21} color={C.green} /></View>
        <View style={{ position: "absolute", left: 14, right: 14, bottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ backgroundColor: C.ivory, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 }}><Text style={{ color: C.greenDark, fontSize: 10, fontWeight: "900" }}>All locations around campus</Text></View>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.green, alignItems: "center", justifyContent: "center" }}><Ionicons name="arrow-forward" size={17} color={C.white} /></View>
        </View>
      </View>

      <View style={{ gap: 9, minHeight: 119 }}>
        <Text style={{ color: C.green, fontSize: 10, fontWeight: "900" }}>{slide.eyebrow}</Text>
        <Text style={{ color: C.ink, fontSize: 30, lineHeight: 35, fontWeight: "900" }}>{slide.title}</Text>
        <Text style={{ color: C.muted, fontSize: 14, lineHeight: 21 }}>{slide.copy}</Text>
      </View>
    </View>

    <View style={{ gap: 13 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        {SLIDES.map((item, dot) => <Pressable key={item.eyebrow} onPress={() => setIndex(dot)} accessibilityRole="button" accessibilityLabel={`Go to onboarding slide ${dot + 1}`} hitSlop={8} style={{ paddingVertical: 7 }}><View style={{ width: dot === index ? 25 : 7, height: 7, borderRadius: 8, backgroundColor: dot === index ? C.green : "#CBD8CE" }} /></Pressable>)}
      </View>
      <Button title={index === SLIDES.length - 1 ? "Get started" : "Continue"} icon="arrow-forward" onPress={() => index < SLIDES.length - 1 ? setIndex(index + 1) : void continueTo("/(tabs)")} loading={loading} />
      <Pressable onPress={() => void continueTo("/(auth)/login")} style={{ paddingVertical: 4 }}><Text style={{ textAlign: "center", color: C.green, fontWeight: "800", fontSize: 13 }}>Already have an account? Sign in</Text></Pressable>
      <Text style={{ textAlign: "center", color: C.muted, fontSize: 10, lineHeight: 15 }}>Fast, convenient campus ordering and delivery.</Text>
    </View>
  </View>;
}
