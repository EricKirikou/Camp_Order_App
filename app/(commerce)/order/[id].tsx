import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Button, C, Header, Notice, Page } from "@/components/camporder/ui";
import { formatGhs, friendlyError, ORDER_STATUS_LABEL } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

const STEPS = ["placed", "accepted", "preparing", "on_the_way", "completed"];

export default function OrderDetailsScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = trpc.orders.byId.useQuery({ id: Number(id) }, { enabled: Number.isInteger(Number(id)) });
  const retryPayment = trpc.payments.retryPayment.useMutation();
  const reorder = trpc.orders.reorder.useMutation();
  const cancelOrder = trpc.orders.cancel.useMutation();
  const [actionError, setActionError] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  if (order.isLoading) return <Page><Header title="Order tracking" back /><Text style={{ color: C.muted }}>Checking order status…</Text></Page>;
  if (!order.data) return <Page><Header title="Order tracking" back /><Notice tone="error">Order not found or not available for this account.</Notice><Button title="View my orders" onPress={() => router.replace("/(tabs)/orders")} /></Page>;

  const data = order.data;
  const isPaid = data.paymentStatus === "paid";
  const isFailed = data.paymentStatus === "failed";
  const isPending = !isPaid && (data.status === "payment_pending" || data.paymentStatus === "pending");
  const isCancelled = data.status === "cancelled";
  const canRetry = !isPaid && !isCancelled;
  const canCancel = !isPaid && !isCancelled;
  const currentIndex = STEPS.indexOf(data.status);

  const handleRetryPayment = async () => {
    setActionError("");
    try {
      const callbackUrl = Platform.OS === "web" && typeof window !== "undefined" ? `${window.location.origin}/payment` : undefined;
      const res = await retryPayment.mutateAsync({ orderId: data.id, callbackUrl });
      if (Platform.OS === "web") {
        window.location.assign(res.authorizationUrl);
        return;
      }
      const browserResult = await WebBrowser.openAuthSessionAsync(res.authorizationUrl);
      if (browserResult.type === "cancel" || browserResult.type === "dismiss") {
        router.replace({ pathname: "/(commerce)/payment", params: { reference: res.reference } });
      }
    } catch (err) {
      setActionError(friendlyError(err, "We couldn't start payment retry."));
    }
  };

  const handleReorder = async () => {
    setActionError("");
    try {
      await reorder.mutateAsync({ id: data.id });
      router.push("/(commerce)/cart");
    } catch (err) {
      setActionError(friendlyError(err, "Could not add items back to cart."));
    }
  };

  const handleCancelOrder = async () => {
    setActionError("");
    try {
      await cancelOrder.mutateAsync({ id: data.id });
      setCancelSuccess(true);
      setShowCancelConfirm(false);
      await utils.orders.byId.invalidate({ id: data.id });
      await utils.orders.mine.invalidate();
    } catch (err) {
      setActionError(friendlyError(err, "We couldn't cancel this order."));
    }
  };

  return <Page>
    <Header title="Order tracking" subtitle={data.orderCode} back />

    <View style={{ alignItems: "center", paddingVertical: 14, gap: 10 }}>
      <View style={{ width: 68, height: 68, borderRadius: 23, backgroundColor: isPaid ? C.sage : isFailed ? "#FEE2E2" : C.paleMango, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={isPaid ? "checkmark-circle-outline" : isFailed ? "alert-circle-outline" : "time-outline"} size={33} color={isPaid ? C.green : isFailed ? C.coral : "#9A661E"} />
      </View>
      <Text style={{ color: C.ink, fontSize: 21, fontWeight: "900" }}>{ORDER_STATUS_LABEL[data.status] ?? data.status}</Text>
      <Text style={{ color: C.muted, fontSize: 12 }}>{isPaid ? "Payment confirmed by Paystack" : `Payment status: ${data.paymentStatus}`}</Text>
    </View>

    {actionError ? <Notice tone="error">{actionError}</Notice> : null}
    {cancelSuccess ? <Notice tone="mango">This order has been cancelled.</Notice> : null}

    {isFailed ? (
      <Notice tone="error">This payment couldn't be processed. Tap "Retry Payment" to pay securely and send this order to the kitchen, or cancel this order.</Notice>
    ) : isPending ? (
      <Notice tone="mango">Payment has not been completed yet. Retry payment now to have your order processed, or cancel if you changed your mind.</Notice>
    ) : isCancelled ? (
      <Notice tone="error">This order was cancelled. You can re-order these items into your cart anytime.</Notice>
    ) : null}

    {isPaid ? (
      <View style={{ borderRadius: 18, backgroundColor: C.white, padding: 16, borderWidth: 1, borderColor: C.border, gap: 15 }}>
        <Text style={{ color: C.ink, fontSize: 16, fontWeight: "900" }}>Order progress</Text>
        {STEPS.map((step, index) => {
          const complete = currentIndex >= index;
          const isCurrent = data.status === step;
          return (
            <View key={step} style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: complete ? C.green : C.sage, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={complete ? "checkmark" : "ellipse-outline"} size={14} color={complete ? C.white : C.green} />
              </View>
              <Text style={{ color: isCurrent ? C.green : complete ? C.ink : C.muted, fontSize: 13, fontWeight: isCurrent ? "900" : "600" }}>
                {ORDER_STATUS_LABEL[step]}
              </Text>
            </View>
          );
        })}
      </View>
    ) : (
      <View style={{ borderRadius: 18, backgroundColor: C.white, padding: 16, borderWidth: 1, borderColor: isFailed ? "#FECACA" : C.border, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Ionicons name={isFailed ? "alert-circle" : isCancelled ? "close-circle" : "card-outline"} size={22} color={isFailed || isCancelled ? C.coral : "#B45309"} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.ink, fontSize: 15, fontWeight: "800" }}>{isCancelled ? "Order Cancelled" : isFailed ? "Payment Incomplete / Failed" : "Awaiting Payment"}</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{isCancelled ? "This order was cancelled and will not be prepared." : "Orders are sent to vendors immediately after payment is confirmed."}</Text>
          </View>
        </View>
      </View>
    )}

    <View style={{ borderRadius: 18, backgroundColor: C.white, padding: 16, borderWidth: 1, borderColor: C.border, gap: 11 }}>
      <Text style={{ color: C.ink, fontSize: 16, fontWeight: "900" }}>Items</Text>
      {data.items.map((item) => (
        <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ color: C.muted, flex: 1 }}>{item.quantity} × {item.productName}</Text>
          <Text style={{ color: C.ink, fontWeight: "700" }}>{formatGhs(item.unitPricePesewas * item.quantity)}</Text>
        </View>
      ))}
      <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderColor: C.border, paddingTop: 11 }}>
        <Text style={{ color: C.ink, fontWeight: "900" }}>Total</Text>
        <Text style={{ color: C.green, fontWeight: "900" }}>{formatGhs(data.totalPesewas)}</Text>
      </View>
    </View>

    <View style={{ gap: 4 }}>
      <Text style={{ color: C.ink, fontWeight: "800" }}>Delivery point</Text>
      <Text style={{ color: C.muted, fontSize: 13 }}>{data.deliveryAddress}</Text>
    </View>

    {canRetry ? (
      <Button title="Retry Payment" icon="refresh-outline" onPress={() => void handleRetryPayment()} loading={retryPayment.isPending} />
    ) : null}

    {canCancel ? (
      showCancelConfirm ? (
        <View style={{ backgroundColor: "#FEF2F2", padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#FECACA", gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="warning-outline" size={20} color="#DC2626" />
            <Text style={{ color: "#991B1B", fontWeight: "800", fontSize: 14 }}>Cancel this order?</Text>
          </View>
          <Text style={{ color: "#7F1D1D", fontSize: 12, lineHeight: 18 }}>
            This will mark this unpaid order as cancelled. You can still re-order items to your cart anytime.
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            <Button
              title="Yes, cancel order"
              variant="danger"
              onPress={() => void handleCancelOrder()}
              loading={cancelOrder.isPending}
              style={{ flex: 1 }}
            />
            <Button
              title="Keep order"
              variant="outline"
              onPress={() => setShowCancelConfirm(false)}
              disabled={cancelOrder.isPending}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : (
        <Button
          title="Cancel this order"
          icon="close-circle-outline"
          variant="outline"
          onPress={() => setShowCancelConfirm(true)}
          style={{ borderColor: "#FCA5A5" }}
        />
      )
    ) : null}

    <Button title="Re-order items to cart" icon="cart-outline" variant="outline" onPress={() => void handleReorder()} loading={reorder.isPending} />

    <Button title="Back to orders" variant="outline" onPress={() => router.replace("/(tabs)/orders")} />
  </Page>;
}
