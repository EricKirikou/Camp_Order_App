import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { Button, C, Header, Notice, Page } from "@/components/camporder/ui";
import { trpc } from "@/lib/trpc";

export default function BookingConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; serviceName?: string }>();
  const detail = trpc.services.bookingById.useQuery({ id: Number(params.id) }, { enabled: Number.isInteger(Number(params.id)) });
  const booking = detail.data?.booking;
  return <Page contentStyle={{ flexGrow: 1, justifyContent: "center" }}>
    <Header title="Booking request" back />
    <View style={{ alignItems: "center", gap: 10, padding: 15 }}><View style={{ width: 78, height: 78, borderRadius: 27, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 32, color: C.green }}>✓</Text></View><Text style={{ color: C.ink, fontSize: 23, fontWeight: "900", textAlign: "center" }}>Request received</Text><Text style={{ color: C.muted, fontSize: 14, textAlign: "center", lineHeight: 20 }}>{params.serviceName ?? "Campus service"} · {booking?.status ?? "Checking"}</Text></View>
    <Notice tone="mango">This means your request was saved, not that a provider has confirmed it. Availability and quoted costs need a verified campus partner.</Notice>
    <Button title="Campus services" onPress={() => router.replace("/(services)")} />
    <Button title="Home" variant="outline" onPress={() => router.replace("/(tabs)")} />
  </Page>;
}
