import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Button, C, Header, Notice, Page } from "@/components/camporder/ui";
import { useCampOrderUser } from "@/hooks/use-camporder-user";
import { useSelectedCampus } from "@/hooks/use-selected-campus";
import { friendlyError } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

export default function CampusScreen() {
  const router = useRouter();
  const { user } = useCampOrderUser();
  const selected = useSelectedCampus();
  const campuses = trpc.catalog.campuses.useQuery();
  const [chosen, setChosen] = useState<number | null>(selected.campus?.id ?? null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const continueToApp = async () => {
    const campus = campuses.data?.find((item) => item.id === chosen);
    if (!campus) { setError("Choose a campus to continue."); return; }
    setSaving(true); setError("");
    try {
      await selected.selectCampus(campus, Boolean(user));
      router.replace("/(tabs)");
    } catch (err) {
      setError(friendlyError(err, "Could not save that campus."));
    } finally { setSaving(false); }
  };

  return <Page>
    <Header title="Choose your campus" back />
    <View style={{ gap: 8 }}><Text style={{ color: C.ink, fontSize: 28, fontWeight: "900", letterSpacing: -0.8 }}>Where do you study?</Text><Text style={{ color: C.muted, fontSize: 14, lineHeight: 20 }}>We&apos;ll use this to show nearby sample listings and campus services.</Text></View>
    {error ? <Notice tone="error">{error}</Notice> : null}
    {campuses.isLoading ? <ActivityIndicator color={C.green} /> : campuses.isError ? <Notice tone="error">Campus list is unavailable right now. Try again shortly.</Notice> : <View style={{ gap: 10 }}>
      {(campuses.data ?? []).map((campus) => {
        const active = chosen === campus.id;
        return <Pressable key={campus.id} onPress={() => setChosen(campus.id)} style={{ borderWidth: 1.5, borderColor: active ? C.green : C.border, backgroundColor: active ? "#F0F7F2" : C.white, borderRadius: 17, padding: 15, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: active ? C.green : C.sage, alignItems: "center", justifyContent: "center" }}><Ionicons name="school-outline" size={20} color={active ? C.white : C.green} /></View>
          <View style={{ flex: 1, gap: 4 }}><Text style={{ fontWeight: "800", color: C.ink, fontSize: 14 }}>{campus.name}</Text><Text style={{ color: C.muted, fontSize: 12 }}>{campus.city}, {campus.region}</Text></View>
          {active ? <Ionicons name="checkmark-circle" size={22} color={C.green} /> : <Ionicons name="ellipse-outline" size={22} color="#A8B4AA" />}
        </Pressable>;
      })}
    </View>}
    <Notice tone="mango">Campus options and marketplace listings are sample preview content. Live vendor availability has not been verified.</Notice>
    <Button title="Continue" onPress={() => void continueToApp()} loading={saving} disabled={chosen === null} />
  </Page>;
}
