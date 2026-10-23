import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform, Text, View } from "react-native";
import { Button, C, Notice, Page } from "@/components/camporder/ui";
import { friendlyError } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

export default function PaymentScreen() {
  const params = useLocalSearchParams<{ reference?: string; trxref?: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const verify = trpc.payments.verify.useMutation();
  const verifiedRef = useRef<string | null>(null);

  // Paystack redirects with both ?reference=xxx&trxref=xxx
  // Also fall back to reading window.location.search on web if expo-router didn't capture the params
  let reference = typeof params.reference === "string" ? params.reference : typeof params.trxref === "string" ? params.trxref : "";
  if (!reference && Platform.OS === "web" && typeof window !== "undefined") {
    try {
      const url = new URL(window.location.href);
      reference = url.searchParams.get("reference") || url.searchParams.get("trxref") || "";
    } catch {}
  }

  const result = verify.data;

  useEffect(() => {
    if (reference && verifiedRef.current !== reference) {
      verifiedRef.current = reference;
      verify.mutate({ reference });
    }
  }, [reference]);

  // Invalidate cart and orders when payment succeeds, then auto-navigate to tracking
  useEffect(() => {
    if (result?.status === "success" && result.orderId) {
      utils.cart.get.invalidate();
      utils.orders.mine.invalidate();
      const timer = setTimeout(() => {
        router.replace({ pathname: "/(commerce)/order/[id]", params: { id: String(result.orderId) } });
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, [result?.status, result?.orderId, utils, router]);

  const error = !reference
    ? "Payment reference is missing. Open the order list to check current status."
    : verify.error
      ? friendlyError(verify.error, "We couldn't verify the payment yet. Your order will update only after Paystack confirms it.")
      : "";

  return <Page contentStyle={{ flexGrow: 1, justifyContent: "center" }}>
    <View style={{ alignItems: "center", gap: 12, padding: 12 }}>
      <View style={{ width: 80, height: 80, borderRadius: 28, backgroundColor: result?.status === "success" ? C.sage : C.paleMango, alignItems: "center", justifyContent: "center" }}><Ionicons name={verify.isPending ? "time-outline" : result?.status === "success" ? "checkmark-circle-outline" : "shield-checkmark-outline"} size={38} color={result?.status === "success" ? C.green : "#9A661E"} /></View>
      <Text style={{ color: C.ink, fontSize: 24, fontWeight: "900", textAlign: "center" }}>{verify.isPending ? "Checking payment…" : result?.status === "success" ? "Payment confirmed!" : "Payment not confirmed yet"}</Text>
      <Text style={{ color: C.muted, fontSize: 14, lineHeight: 21, textAlign: "center" }}>{result?.status === "success" ? `Paystack verified ${result.orderCode}. Redirecting to order tracking…` : "Returning from the payment page does not by itself confirm a charge. The Paystack reference is checked securely."}</Text>
    </View>
    {error ? <Notice tone="error">{error}</Notice> : null}
    {result?.status === "pending" ? <Notice tone="mango">The provider has not confirmed this transaction as successful yet. Tap Check again to retry.</Notice> : null}
    <Button title={result?.status === "success" ? "Track this order" : "Check again"} onPress={() => result?.status === "success" ? router.replace({ pathname: "/(commerce)/order/[id]", params: { id: String(result.orderId) } }) : reference ? verify.mutate({ reference }) : undefined} loading={verify.isPending} disabled={!reference || verify.isPending} />
    <Button title="View my orders" variant="outline" onPress={() => router.replace("/(tabs)/orders")} />
  </Page>;
}
