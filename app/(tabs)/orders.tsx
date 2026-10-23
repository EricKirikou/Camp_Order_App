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
    {user && orders.data?.length === 0 ? <EmptyState icon="bag-handle-outline" title="No orders yet" copy="Place an order from any campus kitchen or mart to track its progress here." action="Explore campus picks" onAction={() => router.push("/(tabs)/explore")} /> : null}
    {orders.data?.map((order) => {
      const isPaid = order.paymentStatus === "paid";
      const isCancelled = order.status === "cancelled";
      const isFailed = order.paymentStatus === "failed";
      return (
        <Pressable
          key={order.id}
          onPress={() => router.push({ pathname: "/(commerce)/order/[id]", params: { id: String(order.id) } })}
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: isCancelled ? C.border : !isPaid ? (isFailed ? "#FECACA" : "#FED7AA") : C.border,
            backgroundColor: isCancelled ? "#FAFAFA" : C.white,
            padding: 15,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ gap: 5 }}>
              <Text style={{ color: isCancelled ? C.muted : C.ink, fontWeight: "900", fontSize: 14 }}>{order.orderCode}</Text>
              <Text style={{ color: C.muted, fontSize: 11 }}>
                {new Date(order.createdAt).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
            </View>
            <View style={{ backgroundColor: isPaid ? "#E8F5EC" : isCancelled ? "#F3F4F6" : isFailed ? "#FEE2E2" : "#FFF3E1", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9 }}>
              <Text style={{ color: isPaid ? C.green : isCancelled ? "#6B7280" : isFailed ? C.coral : "#8B5E1B", fontSize: 10, fontWeight: "800" }}>
                {isPaid ? "PAID" : isCancelled ? "CANCELLED" : isFailed ? "FAILED" : order.paymentStatus.toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderColor: C.border, paddingTop: 11 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name={isPaid ? "time-outline" : isCancelled ? "close-circle-outline" : "alert-circle-outline"} size={15} color={isPaid ? C.green : isCancelled ? "#9CA3AF" : isFailed ? C.coral : "#B45309"} />
              <Text style={{ color: isCancelled ? "#6B7280" : C.ink, fontSize: 12, fontWeight: "700" }}>{ORDER_STATUS_LABEL[order.status] ?? order.status}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {!isPaid && !isCancelled ? (
                <View style={{ backgroundColor: "#EFF6FF", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="refresh" size={11} color="#2563EB" />
                  <Text style={{ color: "#2563EB", fontSize: 11, fontWeight: "800" }}>Retry</Text>
                </View>
              ) : null}
              <Text style={{ color: isCancelled ? C.muted : C.green, fontWeight: "900" }}>{formatGhs(order.totalPesewas)}</Text>
            </View>
          </View>
        </Pressable>
      );
    })}
    <Button title="Browse campus services" variant="outline" onPress={() => router.push("/(services)")} />
  </Page>;
}
