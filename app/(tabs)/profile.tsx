import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { Button, C, Notice, Page } from "@/components/camporder/ui";
import { useCampOrderUser } from "@/hooks/use-camporder-user";
import { useSelectedCampus } from "@/hooks/use-selected-campus";
import * as Auth from "@/lib/_core/auth";
import { trpc } from "@/lib/trpc";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading, refresh } = useCampOrderUser();
  const selected = useSelectedCampus();
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await Auth.removeSessionToken();
      await utils.auth.me.invalidate();
      await refresh();
    },
  });
  const doLogout = () => {
    if (Platform.OS === "web") {
      const confirmed = typeof window !== "undefined" ? window.confirm("Sign out of CampOrder?") : true;
      if (confirmed) void logout.mutateAsync().catch(async () => { await Auth.removeSessionToken(); await refresh(); });
    } else {
      Alert.alert("Sign out?", "You can sign back in with your phone number.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => logout.mutate() },
      ]);
    }
  };

  return <Page>
    <Text style={{ color: C.ink, fontSize: 28, fontWeight: "900", letterSpacing: -0.8 }}>Profile</Text>
    {user ? <>
      <View style={{ backgroundColor: C.green, borderRadius: 22, padding: 20, gap: 14 }}><View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.white, fontSize: 22, fontWeight: "900" }}>{user.name?.slice(0,1).toUpperCase() ?? "C"}</Text></View><View style={{ gap: 4 }}><Text style={{ color: C.white, fontSize: 19, fontWeight: "900" }}>{user.name ?? "CampOrder student"}</Text><Text style={{ color: "#D9EEE2", fontSize: 13 }}>{user.phoneNumber}</Text>{user.phoneVerified ? <Text style={{ color: "#D9EEE2", fontSize: 11, fontWeight: "700" }}>✓ Phone verified</Text> : null}</View></View>
      <Pressable onPress={() => router.push("/(auth)/campus")} style={{ borderRadius: 17, padding: 15, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}><Ionicons name="location-outline" color={C.green} size={19} /></View><View style={{ flex: 1, gap: 3 }}><Text style={{ color: C.ink, fontWeight: "800" }}>My campus</Text><Text style={{ color: C.muted, fontSize: 12 }}>{selected.campus?.name ?? "Choose your campus"}</Text></View><Ionicons name="chevron-forward" color={C.muted} size={18} /></Pressable>
      <Button title="My orders" variant="outline" icon="receipt-outline" onPress={() => router.push("/(tabs)/orders")} />
      <Button title="Campus errands & services" variant="outline" icon="sparkles-outline" onPress={() => router.push("/(services)")} />
      {user.role === "admin" ? <Button title="Admin console" variant="outline" icon="settings-outline" onPress={() => router.push("/admin")} /> : null}
      <Notice tone="mango">Listings and service types are sample data until a verified campus partner and fulfillment network are connected.</Notice>
      <Button title="Sign out" variant="quiet" onPress={doLogout} loading={logout.isPending} />
    </> : loading ? <Text style={{ color: C.muted }}>Checking your account…</Text> : <>
      <View style={{ alignItems: "center", gap: 9, paddingVertical: 16 }}><View style={{ width: 76, height: 76, borderRadius: 27, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}><Ionicons name="person-outline" size={32} color={C.green} /></View><Text style={{ color: C.ink, fontSize: 18, fontWeight: "900" }}>Make campus life easier</Text><Text style={{ color: C.muted, fontSize: 13, textAlign: "center", lineHeight: 19 }}>Sign in with your phone to keep orders and bookings together.</Text></View>
      <Button title="Sign in" onPress={() => router.push("/(auth)/login")} />
      <Button title="Create an account" variant="outline" onPress={() => router.push("/(auth)/signup")} />
      <Pressable onPress={() => router.push("/(auth)/campus")} style={{ padding: 14, backgroundColor: C.white, borderRadius: 15, borderWidth: 1, borderColor: C.border, flexDirection: "row", gap: 10, alignItems: "center" }}><Ionicons name="school-outline" color={C.green} size={20} /><Text style={{ color: C.ink, fontWeight: "700" }}>Choose your campus</Text></Pressable>
    </>}
  </Page>;
}
