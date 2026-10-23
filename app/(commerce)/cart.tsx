import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, C, EmptyState, Header, Notice, Page } from "@/components/camporder/ui";
import { useCampOrderUser } from "@/hooks/use-camporder-user";
import { assetSource } from "@/lib/camporder/assets";
import { formatGhs, friendlyError } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

export default function CartScreen() {
  const router = useRouter();
  const { user, loading } = useCampOrderUser();
  const cart = trpc.cart.get.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const [error, setError] = useState("");
  const update = trpc.cart.setQuantity.useMutation({ onSuccess: () => { setError(""); void cart.refetch(); }, onError: (err) => setError(friendlyError(err)) });
  if (!user && !loading) return <Page><Header title="Your cart" back /><EmptyState icon="bag-handle-outline" title="Sign in to keep your cart" copy="Your cart is saved to your CampOrder account so you can finish checkout later." action="Sign in" onAction={() => router.push("/(auth)/login")} /></Page>;
  return <Page>
    <Header title="Your cart" subtitle={`${cart.data?.itemCount ?? 0} items`} back />
    {cart.isLoading ? <Text style={{ color: C.muted }}>Loading your cart…</Text> : null}
    {cart.isError ? <Notice tone="error">Your cart couldn&apos;t be loaded. Sign in again or try later.</Notice> : null}
    {error ? <Notice tone="error">{error}</Notice> : null}
    {cart.data?.items.length === 0 ? <EmptyState icon="basket-outline" title="Your cart is waiting" copy="Add items from campus shops or kitchens and they will show up here." action="Explore campus picks" onAction={() => router.replace("/(tabs)/explore")} /> : null}
    <View style={{ gap: 11 }}>{cart.data?.items.map(({ product, quantity }) => <View key={product.id} style={{ backgroundColor: C.white, borderRadius: 17, borderWidth: 1, borderColor: C.border, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 66, height: 66, backgroundColor: C.sage, borderRadius: 14, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>{product.imageUrl ? <Image source={assetSource(product.imageUrl)} contentFit="cover" style={{ width: "100%", height: "100%" }} /> : <Ionicons name="fast-food-outline" size={24} color={C.green} />}</View>
      <View style={{ flex: 1, gap: 4 }}><Text style={{ color: C.ink, fontWeight: "800", fontSize: 13 }} numberOfLines={1}>{product.name}</Text><Text style={{ color: C.green, fontWeight: "800", fontSize: 13 }}>{formatGhs(product.pricePesewas)}</Text></View>
      <View style={{ alignItems: "center", gap: 7 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Pressable onPress={() => update.mutate({ productId: product.id, quantity: Math.max(quantity - 1, 0) })} style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}><Ionicons name={quantity === 1 ? "trash-outline" : "remove"} size={14} color={C.green} /></Pressable><Text style={{ color: C.ink, fontWeight: "800", minWidth: 15, textAlign: "center" }}>{quantity}</Text><Pressable onPress={() => update.mutate({ productId: product.id, quantity: Math.min(quantity + 1, 20) })} style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: C.green, alignItems: "center", justifyContent: "center" }}><Ionicons name="add" size={16} color={C.white} /></Pressable></View><Text style={{ color: C.ink, fontSize: 10, fontWeight: "800" }}>{formatGhs(product.pricePesewas * quantity)}</Text></View>
    </View>)}</View>
    {cart.data && cart.data.items.length > 0 ? <>
      <View style={{ gap: 10, borderTopWidth: 1, borderColor: C.border, paddingTop: 14 }}><View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: C.muted }}>Subtotal</Text><Text style={{ color: C.ink, fontWeight: "700" }}>{formatGhs(cart.data.subtotalPesewas)}</Text></View><View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: C.muted }}>Campus delivery</Text><Text style={{ color: C.ink, fontWeight: "700" }}>{formatGhs(500)}</Text></View><View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 8 }}><Text style={{ color: C.ink, fontWeight: "900", fontSize: 17 }}>Total</Text><Text style={{ color: C.green, fontWeight: "900", fontSize: 17 }}>{formatGhs(cart.data.subtotalPesewas + 500)}</Text></View></View>
      <Button title="Continue to checkout" icon="arrow-forward" onPress={() => router.push("/(commerce)/checkout")} />
    </> : null}
  </Page>;
}
