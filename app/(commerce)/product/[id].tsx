import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, C, Header, Notice, Page } from "@/components/camporder/ui";
import { useCampOrderUser } from "@/hooks/use-camporder-user";
import { assetUrl } from "@/lib/camporder/assets";
import { formatGhs, friendlyError } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

export default function ProductScreen() {
  const { id, add: addParam } = useLocalSearchParams<{ id: string; add?: string }>();
  const productId = Number(id);
  const router = useRouter();
  const { user } = useCampOrderUser();
  const product = trpc.catalog.product.useQuery({ id: productId }, { enabled: Number.isInteger(productId) && productId > 0 });
  const add = trpc.cart.add.useMutation();
  const [notice, setNotice] = useState("");
  const addToCart = async () => {
    if (!user) { router.push("/(auth)/login"); return; }
    setNotice("");
    try {
      await add.mutateAsync({ productId });
      setNotice("Added to your campus cart.");
    } catch (err) { setNotice(friendlyError(err)); }
  };
  if (product.isLoading) return <Page><Header title="Product details" back /><Text style={{ color: C.muted }}>Loading item…</Text></Page>;
  if (!product.data) return <Page><Header title="Product details" back /><Notice tone="error">This campus item isn&apos;t available right now.</Notice></Page>;
  const item = product.data;
  return <Page contentStyle={{ gap: 17 }}>
    <Header title="Item details" back right={<Pressable onPress={() => router.push("/(commerce)/cart")} style={{ padding: 9 }}><Ionicons name="bag-handle-outline" size={22} color={C.green} /></Pressable>} />
    <View style={{ height: 252, borderRadius: 23, overflow: "hidden", backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}>
      {item.imageUrl ? <Image source={{ uri: assetUrl(item.imageUrl) }} contentFit="cover" style={{ width: "100%", height: "100%" }} /> : <Ionicons name="fast-food-outline" size={54} color={C.green} />}
      {item.isSample ? <View style={{ position: "absolute", left: 14, top: 14, backgroundColor: C.paleMango, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9 }}><Text style={{ color: "#87510B", fontSize: 10, fontWeight: "900" }}>SAMPLE LISTING</Text></View> : null}
    </View>
    <View style={{ gap: 8 }}><Text style={{ color: C.green, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 }}>{item.category}</Text><Text style={{ color: C.ink, fontWeight: "900", fontSize: 26, letterSpacing: -0.7 }}>{item.name}</Text><Text style={{ color: C.green, fontWeight: "900", fontSize: 22 }}>{formatGhs(item.pricePesewas)}</Text><Text style={{ color: C.muted, fontSize: 14, lineHeight: 21 }}>{item.description}</Text></View>
    {item.vendor ? <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, paddingVertical: 14 }}><View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}><Ionicons name="storefront-outline" size={19} color={C.green} /></View><View style={{ flex: 1 }}><Text style={{ color: C.ink, fontWeight: "800" }}>{item.vendor.name}</Text><Text style={{ color: C.muted, fontSize: 11 }}>Sample seller · not verified</Text></View><Text style={{ color: C.muted, fontSize: 11 }}>{item.vendor.etaMin} min</Text></View> : null}
    {notice ? <Notice>{notice}</Notice> : null}
    {addParam === "1" ? <Button title="Add to cart" icon="bag-add-outline" onPress={() => void addToCart()} loading={add.isPending} /> : <View style={{ flexDirection: "row", gap: 10 }}><Button title="Add to cart" icon="bag-add-outline" onPress={() => void addToCart()} loading={add.isPending} style={{ flex: 1 }} /><Button title="Cart" variant="outline" icon="bag-handle-outline" onPress={() => router.push("/(commerce)/cart")} /></View>}
    <Notice tone="mango">Sample content only. Seller operations, stock and delivery are not verified.</Notice>
  </Page>;
}
