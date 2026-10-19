import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Button, C, EmptyState, Notice, Page, SectionTitle } from "@/components/camporder/ui";
import { useCampOrderUser } from "@/hooks/use-camporder-user";
import { formatGhs, ORDER_STATUS_LABEL } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

export default function OrdersScreen() {
  const router = useRouter();
  const { user, loading } = useCampOrderUser();
  const orders = trpc.orders.mine.useQuery(undefined, { enabled: Boolean(user), retry: false });
  return <Page>
    <SectionTitle title="My orders" action="Browse" onAction={() => router.push("/(tabs)/explore")} />
    <Text style={{ color: C.muted, fontSize: 13, marginTop: -12 }}>Your payments and campus deliveries</Text>
    {!user && !loading ? <EmptyState icon="receipt-outline" title="Your orders live here" copy="Sign in to check orders placed with your verified account." action="Sign in" onAction={() => router.push("/(auth)/login")} /> : null}
    {user && orders.isLoading ? <Text style={{ color: C.muted }}>Loading your orders…</Text> : null}
    {user && orders.isError ? <Notice tone="error">We couldn&apos;t load your orders right now. Please try again.</Notice> : null}
    {user && orders.data?.length === 0 ? <EmptyState icon="bag-handle-outline" title="No orders yet" copy="Find a sample campus pick and your real checkout history will appear here." action="Explore campus picks" onAction={() => router.push("/(tabs)/explore")} /> : null}
    {orders.data?.map((order) => <Pressable key={order.id} onPress={() => router.push({ pathname: "/(commerce)/order/[id]", params: { id: String(order.id) } })} style={{ borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.white, padding: 15, gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}><View style={{ gap: 5 }}><Text style={{ color: C.ink, fontWeight: "900", fontSize: 14 }}>{order.orderCode}</Text><Text style={{ color: C.muted, fontSize: 11 }}>{new Date(order.createdAt).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}</Text></View><View style={{ backgroundColor: order.paymentStatus === "paid" ? "#E8F5EC" : "#FFF3E1", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9 }}><Text style={{ color: order.paymentStatus === "paid" ? C.green : "#8B5E1B", fontSize: 10, fontWeight: "800" }}>{order.paymentStatus === "paid" ? "PAID" : order.paymentStatus.toUpperCase()}</Text></View></View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderColor: C.border, paddingTop: 11 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Ionicons name="time-outline" size={15} color={C.green} /><Text style={{ color: C.ink, fontSize: 12, fontWeight: "700" }}>{ORDER_STATUS_LABEL[order.status] ?? order.status}</Text></View><Text style={{ color: C.green, fontWeight: "900" }}>{formatGhs(order.totalPesewas)}</Text></View>
    </Pressable>)}
    <Button title="Browse campus services" variant="outline" onPress={() => router.push("/(services)")} />
  </Page>;
}
