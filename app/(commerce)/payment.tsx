import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { Button, C, Notice, Page } from "@/components/camporder/ui";
import { friendlyError } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

export default function PaymentScreen() {
  const params = useLocalSearchParams<{ reference?: string }>();
  const router = useRouter();
  const verify = trpc.payments.verify.useMutation();
  const mutate = verify.mutate;
  const reference = typeof params.reference === "string" ? params.reference : "";
  const result = verify.data;
  useEffect(() => {
    if (reference) mutate({ reference });
  }, [reference, mutate]);

  const error = !reference
    ? "Payment reference is missing. Open the order list to check current status."
    : verify.error
      ? friendlyError(verify.error, "We couldn't verify the payment yet. Your order will update only after Paystack confirms it.")
      : "";

  return <Page contentStyle={{ flexGrow: 1, justifyContent: "center" }}>
    <View style={{ alignItems: "center", gap: 12, padding: 12 }}>
      <View style={{ width: 80, height: 80, borderRadius: 28, backgroundColor: result?.status === "success" ? C.sage : C.paleMango, alignItems: "center", justifyContent: "center" }}><Ionicons name={verify.isPending ? "time-outline" : result?.status === "success" ? "checkmark-circle-outline" : "shield-checkmark-outline"} size={38} color={result?.status === "success" ? C.green : "#9A661E"} /></View>
      <Text style={{ color: C.ink, fontSize: 24, fontWeight: "900", textAlign: "center" }}>{verify.isPending ? "Checking payment" : result?.status === "success" ? "Payment confirmed" : "Payment not confirmed yet"}</Text>
      <Text style={{ color: C.muted, fontSize: 14, lineHeight: 21, textAlign: "center" }}>{result?.status === "success" ? `Paystack verified ${result.orderCode}.` : "Returning from the payment page does not by itself confirm a charge. The Paystack reference is checked securely."}</Text>
    </View>
    {error ? <Notice tone="error">{error}</Notice> : null}
    {result?.status === "pending" ? <Notice tone="mango">The provider has not confirmed this transaction as successful. You have not been shown a false success state.</Notice> : null}
    <Button title={result?.status === "success" ? "Track this order" : "Check again"} onPress={() => result?.status === "success" ? router.replace({ pathname: "/(commerce)/order/[id]", params: { id: String(result.orderId) } }) : reference ? verify.mutate({ reference }) : undefined} loading={verify.isPending} disabled={!reference || verify.isPending} />
    <Button title="View my orders" variant="outline" onPress={() => router.replace("/(tabs)/orders")} />
  </Page>;
}
