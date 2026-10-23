import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { Button, C, Header, Notice, Page } from "@/components/camporder/ui";
import { formatGhs, ORDER_STATUS_LABEL } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

const STEPS = ["placed", "accepted", "preparing", "on_the_way", "completed"];
export default function OrderDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = trpc.orders.byId.useQuery({ id: Number(id) }, { enabled: Number.isInteger(Number(id)) });
  if (order.isLoading) return <Page><Header title="Order tracking" back /><Text style={{ color: C.muted }}>Checking order status…</Text></Page>;
  if (!order.data) return <Page><Header title="Order tracking" back /><Notice tone="error">Order not found or not available for this account.</Notice><Button title="View my orders" onPress={() => router.replace("/(tabs)/orders")} /></Page>;
  const data = order.data;
  const currentIndex = STEPS.indexOf(data.status);
  return <Page>
    <Header title="Order tracking" subtitle={data.orderCode} back />
    <View style={{ alignItems: "center", paddingVertical: 14, gap: 10 }}><View style={{ width: 68, height: 68, borderRadius: 23, backgroundColor: data.paymentStatus === "paid" ? C.sage : C.paleMango, alignItems: "center", justifyContent: "center" }}><Ionicons name={data.paymentStatus === "paid" ? "checkmark-circle-outline" : "time-outline"} size={33} color={data.paymentStatus === "paid" ? C.green : "#9A661E"} /></View><Text style={{ color: C.ink, fontSize: 21, fontWeight: "900" }}>{ORDER_STATUS_LABEL[data.status] ?? data.status}</Text><Text style={{ color: C.muted, fontSize: 12 }}>{data.paymentStatus === "paid" ? "Payment confirmed by Paystack" : `Payment status: ${data.paymentStatus}`}</Text></View>
    <View style={{ borderRadius: 18, backgroundColor: C.white, padding: 16, borderWidth: 1, borderColor: C.border, gap: 15 }}><Text style={{ color: C.ink, fontSize: 16, fontWeight: "900" }}>Order progress</Text>{STEPS.map((step, index) => {
      const complete = currentIndex >= index;
      const isCurrent = data.status === step;
      return <View key={step} style={{ flexDirection: "row", alignItems: "center", gap: 11 }}><View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: complete ? C.green : C.sage, alignItems: "center", justifyContent: "center" }}><Ionicons name={complete ? "checkmark" : "ellipse-outline"} size={14} color={complete ? C.white : C.green} /></View><Text style={{ color: isCurrent ? C.green : complete ? C.ink : C.muted, fontSize: 13, fontWeight: isCurrent ? "900" : "600" }}>{ORDER_STATUS_LABEL[step]}</Text></View>;
    })}</View>
    <View style={{ borderRadius: 18, backgroundColor: C.white, padding: 16, borderWidth: 1, borderColor: C.border, gap: 11 }}><Text style={{ color: C.ink, fontSize: 16, fontWeight: "900" }}>Items</Text>{data.items.map((item) => <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Text style={{ color: C.muted, flex: 1 }}>{item.quantity} × {item.productName}</Text><Text style={{ color: C.ink, fontWeight: "700" }}>{formatGhs(item.unitPricePesewas * item.quantity)}</Text></View>)}<View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderColor: C.border, paddingTop: 11 }}><Text style={{ color: C.ink, fontWeight: "900" }}>Total</Text><Text style={{ color: C.green, fontWeight: "900" }}>{formatGhs(data.totalPesewas)}</Text></View></View>
    <View style={{ gap: 4 }}><Text style={{ color: C.ink, fontWeight: "800" }}>Delivery point</Text><Text style={{ color: C.muted, fontSize: 13 }}>{data.deliveryAddress}</Text></View>
    <Button title="Back to orders" variant="outline" onPress={() => router.replace("/(tabs)/orders")} />
  </Page>;
}
