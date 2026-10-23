import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Button, C, Field, Header, Notice, Page } from "@/components/camporder/ui";
import { useCampOrderUser } from "@/hooks/use-camporder-user";
import { formatGhs, friendlyError } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

export default function CheckoutScreen() {
  const router = useRouter();
  const { user, loading } = useCampOrderUser();
  const cart = trpc.cart.get.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const checkout = trpc.payments.startCheckout.useMutation();
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);

  const pay = async () => {
    setError("");
    try {
      const callbackUrl = Platform.OS === "web" && typeof window !== "undefined" ? `${window.location.origin}/payment` : undefined;
      const result = await checkout.mutateAsync({ deliveryAddress: address, email, note, callbackUrl });
      setStarted(true);
      if (Platform.OS === "web") {
        window.location.assign(result.authorizationUrl);
        return;
      }
      const browserResult = await WebBrowser.openBrowserAsync(result.authorizationUrl);
      if (browserResult.type === "cancel" || browserResult.type === "dismiss") {
        router.replace({ pathname: "/(commerce)/payment", params: { reference: result.reference } });
      }
    } catch (err) {
      setError(friendlyError(err, "We couldn't start checkout."));
    }
  };

  if (loading) return <Page><Header title="Checkout" back /><Text style={{ color: C.muted }}>Checking your account…</Text></Page>;
  if (!user) return <Page><Header title="Checkout" back /><Notice>Sign in to continue to secure checkout.</Notice><Button title="Sign in" onPress={() => router.push("/(auth)/login")} /></Page>;
  return <Page>
    <Header title="Checkout" subtitle="Pay securely with Paystack" back />
    <View style={{ gap: 7 }}><Text style={{ color: C.ink, fontSize: 25, fontWeight: "900", letterSpacing: -0.7 }}>Almost there.</Text><Text style={{ color: C.muted, fontSize: 13, lineHeight: 19 }}>Enter a campus delivery point and an email for Paystack receipts.</Text></View>
    {cart.data?.items.length ? <View style={{ backgroundColor: C.sage, padding: 15, borderRadius: 16, gap: 7 }}><Text style={{ color: C.ink, fontWeight: "800" }}>{cart.data.itemCount} item{cart.data.itemCount === 1 ? "" : "s"}</Text><View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: C.muted }}>Estimated total incl. delivery</Text><Text style={{ color: C.green, fontWeight: "900" }}>{formatGhs(cart.data.subtotalPesewas + 500)}</Text></View></View> : null}
    <View style={{ gap: 14 }}>
      <Field label="Campus / hostel delivery point" value={address} onChangeText={setAddress} placeholder="Hall, block and room number" autoCapitalize="sentences" />
      <Field label="Email for payment receipt" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" />
      <Field label="Note for the seller (optional)" value={note} onChangeText={setNote} placeholder="Any useful detail" multiline autoCapitalize="sentences" />
    </View>
    <Notice tone="mango">Payments are processed securely via Paystack.</Notice>
    {error ? <Notice tone="error">{error}</Notice> : null}
    {started ? <Notice>Your checkout was opened. Return here after the secure payment step to check the confirmed order status.</Notice> : null}
    <Button title="Continue to Paystack" icon="lock-closed-outline" onPress={() => void pay()} loading={checkout.isPending} disabled={address.trim().length < 4 || !/^\S+@\S+\.\S+$/.test(email)} />
  </Page>;
}
