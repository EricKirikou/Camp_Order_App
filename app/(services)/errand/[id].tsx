import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { Button, C, Header, Notice, Page } from "@/components/camporder/ui";
import { SERVICE_STATUS_LABEL } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

export default function ErrandTrackingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = trpc.services.errandById.useQuery({ id: Number(id) }, { enabled: Number.isInteger(Number(id)) });
  if (request.isLoading) return <Page><Header title="Errand review" back /><Text style={{ color: C.muted }}>Loading saved request…</Text></Page>;
  if (!request.data) return <Page><Header title="Errand review" back /><Notice tone="error">This errand request isn&apos;t available for your account.</Notice><Button title="View my requests" onPress={() => router.replace("/(services)/requests")} /></Page>;
  const item = request.data;
  return <Page>
    <Header title="Errand review" subtitle="Your request summary" back />
    <View style={{ alignItems: "center", gap: 10, paddingVertical: 10 }}><View style={{ width: 68, height: 68, borderRadius: 22, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}><Ionicons name="clipboard-outline" size={32} color={C.green} /></View><Text style={{ color: C.ink, fontSize: 22, fontWeight: "900" }}>Request saved</Text><Text style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>Current status: {SERVICE_STATUS_LABEL[item.status]}</Text></View>
    <View style={{ padding: 16, gap: 12, backgroundColor: C.white, borderRadius: 17, borderWidth: 1, borderColor: C.border }}><Text style={{ color: C.ink, fontSize: 17, fontWeight: "900" }}>{item.title}</Text><Text style={{ color: C.muted, fontSize: 13, lineHeight: 19 }}>{item.details}</Text>{item.pickupLocation ? <Text style={{ color: C.ink, fontSize: 12 }}>Pickup · {item.pickupLocation}</Text> : null}{item.dropoffLocation ? <Text style={{ color: C.ink, fontSize: 12 }}>Drop-off · {item.dropoffLocation}</Text> : null}<View style={{ borderTopWidth: 1, borderColor: C.border, paddingTop: 10 }}><Text style={{ color: C.muted, fontSize: 12 }}>Quote</Text><Text style={{ color: C.green, fontWeight: "900", fontSize: 16 }}>{item.quotedPricePesewas ? `From ${item.quotedPricePesewas / 100} GHS` : "Awaiting a provider quote"}</Text></View></View>
    <Notice tone="mango">No campus runner has accepted this request. This preview does not dispatch a real person or guarantee a quote.</Notice>
    <Button title="View my requests" onPress={() => router.replace("/(services)/requests")} />
    <Button title="Create another errand" variant="outline" onPress={() => router.push("/(services)/errand")} />
  </Page>;
}
