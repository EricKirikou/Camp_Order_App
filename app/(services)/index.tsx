import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Button, C, Header, Notice, Page } from "@/components/camporder/ui";
import { useSelectedCampus } from "@/hooks/use-selected-campus";
import { formatGhs, serviceDisplayName } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  "Study support": "print-outline",
  "Room care": "shirt-outline",
  Errands: "bicycle-outline",
  Repairs: "construct-outline",
  "Personal care": "cut-outline",
};

export default function ServicesScreen() {
  const router = useRouter();
  const campus = useSelectedCampus();
  const list = trpc.services.list.useQuery();
  return <Page>
    <Header title="Campus services" subtitle={campus.campus ? campus.campus.name : "Your campus, sorted"} back />
    <View style={{ gap: 8 }}><Text style={{ color: C.ink, fontSize: 28, fontWeight: "900", letterSpacing: -0.8 }}>More time for you.</Text><Text style={{ color: C.muted, fontSize: 14, lineHeight: 20 }}>Request a hand with the practical stuff around campus.</Text></View>
    <Button title="Create a personal errand" icon="add" onPress={() => router.push("/(services)/errand")} />
    {list.isLoading ? <Text style={{ color: C.muted }}>Loading campus services…</Text> : null}
    {list.isError ? <Notice tone="error">Campus services are unavailable right now.</Notice> : null}
    <View style={{ gap: 11 }}>{(list.data ?? []).map((service) => <Pressable key={service.id} onPress={() => router.push({ pathname: "/(services)/book/[id]", params: { id: String(service.id) } })} style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 19, padding: 15, flexDirection: "row", alignItems: "center", gap: 13 }}>
      <View style={{ width: 49, height: 49, borderRadius: 16, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}><Ionicons name={ICONS[service.category] ?? "sparkles-outline"} size={22} color={C.green} /></View>
      <View style={{ flex: 1, gap: 5 }}><Text style={{ color: C.ink, fontSize: 15, fontWeight: "800" }}>{serviceDisplayName(service.slug, service.name)}</Text><Text style={{ color: C.muted, fontSize: 12, lineHeight: 17 }} numberOfLines={2}>{service.description}</Text><Text style={{ color: C.green, fontSize: 12, fontWeight: "800" }}>From {formatGhs(service.startingPricePesewas)}</Text></View>
      <Ionicons name="chevron-forward" size={18} color={C.muted} />
    </Pressable>)}</View>
  </Page>;
}
