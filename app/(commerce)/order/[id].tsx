import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Button, C, Header, Notice, Page } from "@/components/camporder/ui";
import { formatGhs, friendlyError, ORDER_STATUS_LABEL } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

import { RiderLiveMap } from "@/components/camporder/RiderLiveMap";
import { useCampOrderUser } from "@/hooks/use-camporder-user";
import { useEffect } from "react";

const STEPS = ["placed", "accepted", "preparing", "on_the_way", "completed"];

function PrepWaitCard({
  updatedAt,
  etaMin = 20,
  vendorName = "Campus Kitchen",
}: {
  updatedAt?: string | Date;
  etaMin?: number;
  vendorName?: string;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!updatedAt) return etaMin * 60;
    const startMs = new Date(updatedAt).getTime();
    const targetMs = startMs + etaMin * 60 * 1000;
    return Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!updatedAt) return;
    const interval = setInterval(() => {
      const startMs = new Date(updatedAt).getTime();
      const targetMs = startMs + etaMin * 60 * 1000;
      const left = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
      setSecondsLeft(left);
    }, 1000);
    return () => clearInterval(interval);
  }, [updatedAt, etaMin]);

  const totalSeconds = Math.max(60, etaMin * 60);
  const elapsed = totalSeconds - secondsLeft;
  const progressPercent = Math.min(100, Math.max(5, Math.floor((elapsed / totalSeconds) * 100)));
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formatted = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

  return (
    <View style={{ backgroundColor: "#FFF8ED", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#FDE68A", gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="restaurant" size={18} color="#D97706" />
          </View>
          <View>
            <Text style={{ color: "#92400E", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 }}>FOOD PREPARATION</Text>
            <Text style={{ color: C.ink, fontSize: 15, fontWeight: "800" }}>{vendorName}</Text>
          </View>
        </View>
        <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
          <Text style={{ color: "#B45309", fontSize: 13, fontWeight: "900" }}>~{formatted} left</Text>
        </View>
      </View>

      <View style={{ height: 8, backgroundColor: "#FDE68A", borderRadius: 4, overflow: "hidden" }}>
        <View style={{ width: `${progressPercent}%`, height: "100%", backgroundColor: "#F59E0B", borderRadius: 4 }} />
      </View>

      <Text style={{ color: "#78350F", fontSize: 12, lineHeight: 17 }}>
        Food is being prepared according to the vendor's wait time (~{etaMin} min). Once ready, the order automatically skips to "On The Way"!
      </Text>
    </View>
  );
}

export default function OrderDetailsScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { user } = useCampOrderUser();
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = trpc.orders.byId.useQuery(
    { id: Number(id) },
    {
      enabled: Number.isInteger(Number(id)),
      refetchInterval: (query) => {
        const s = query.state.data?.status;
        return s === "placed" || s === "accepted" || s === "preparing" || s === "on_the_way" ? 3500 : false;
      },
    }
  );
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

    {data.status === "preparing" ? (
      <PrepWaitCard
        updatedAt={data.updatedAt}
        etaMin={data.vendor?.etaMin ?? 20}
        vendorName={data.vendor?.name ?? "Campus Kitchen"}
      />
    ) : null}

    {/* Dedicated Banner for the Rider who accepted the order */}
    {user && (user.id === data.courierId || user.role === "courier") && (data.status === "on_the_way" || data.status === "preparing") && (
      <View style={{
        backgroundColor: data.status === "on_the_way" ? "#DCFCE7" : "#FEF3C7",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1.5,
        borderColor: data.status === "on_the_way" ? "#86EFAC" : "#FDE68A",
        gap: 10,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: data.status === "on_the_way" ? "#BBF7D0" : "#FDE68A",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Ionicons
              name={data.status === "on_the_way" ? "checkmark-done" : "timer-outline"}
              size={20}
              color={data.status === "on_the_way" ? "#15803D" : "#B45309"}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{
              color: data.status === "on_the_way" ? "#15803D" : "#B45309",
              fontSize: 12,
              fontWeight: "900",
              letterSpacing: 0.5,
            }}>
              {data.status === "on_the_way" ? "🍳 FOOD HAS BEEN PREPARED!" : "⏳ KITCHEN IS PREPARING"}
            </Text>
            <Text style={{ color: C.ink, fontSize: 15, fontWeight: "800" }}>
              {data.status === "on_the_way"
                ? "Ready for Rider Pickup & Delivery"
                : "Awaiting Kitchen To Finish Preparation"}
            </Text>
          </View>
        </View>

        <Text style={{
          color: data.status === "on_the_way" ? "#166534" : "#92400E",
          fontSize: 13,
          lineHeight: 18,
        }}>
          {data.status === "on_the_way"
            ? `The vendor finished cooking! Pick up the order from ${data.vendor?.name ?? "the kitchen"} and drop off at ${data.deliveryAddress}.`
            : `The vendor is currently preparing the dishes (~${data.vendor?.etaMin ?? 20} min wait). Once completed, this screen will notify you immediately.`}
        </Text>
      </View>
    )}

    {data.status === "on_the_way" ? (
      <RiderLiveMap
        vendorName={data.vendor?.name ?? "Campus Kitchen"}
        deliveryAddress={data.deliveryAddress}
        orderCode={data.orderCode}
        riderName={data.courier?.name ?? "Campus Courier"}
        riderPhone={data.courier?.phoneNumber ?? undefined}
        updatedAt={typeof data.updatedAt === "string" ? data.updatedAt : data.updatedAt ? new Date(data.updatedAt).toISOString() : undefined}
        etaMin={data.vendor?.etaMin ?? 15}
      />
    ) : null}

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

    {/* Courier Action: Complete Delivery */}
    {user && (user.id === data.courierId || user.role === "courier") && data.status === "on_the_way" && (
      <Button
        title="Mark as Delivered to Student ✅"
        variant="primary"
        style={{ backgroundColor: "#15803D" }}
        onPress={async () => {
          try {
            await utils.client.rider.updateStatus.mutate({ orderId: data.id, status: "completed" });
            await utils.orders.byId.invalidate({ id: data.id });
          } catch (e) {
            setActionError(friendlyError(e, "Could not complete delivery"));
          }
        }}
      />
    )}

    <Button title="Back to orders" variant="outline" onPress={() => router.replace(user?.role === "courier" ? "/(commerce)/rider/dashboard" : "/(tabs)/orders")} />
  </Page>;
}
