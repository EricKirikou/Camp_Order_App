import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Button, C, CartIconButton, Notice, Page, ProductCard } from "@/components/camporder/ui";
import { useCampOrderUser } from "@/hooks/use-camporder-user";
import { trpc } from "@/lib/trpc";

import VendorPortalScreen from "./portal";

export default function VendorScreen() {
  const router = useRouter();
  const { user } = useCampOrderUser();
  const { id } = useLocalSearchParams<{ id: string }>();

  // If the logged in user is a vendor or accessing their portal, show the Vendor Management Portal
  if (user?.role === "vendor" || id === "portal" || id === "me") {
    return <VendorPortalScreen />;
  }

  const cart = trpc.cart.get.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const vendor = trpc.catalog.vendor.useQuery({ id: Number(id) }, { enabled: Number.isInteger(Number(id)) && Number(id) > 0 });
  if (vendor.isLoading) return <Page><Text style={{ color: C.muted }}>Loading campus shop…</Text></Page>;
  if (!vendor.data) return <Page><Text style={{ color: C.ink, fontSize: 20, fontWeight: "800" }}>Shop unavailable</Text><Button title="Explore campus" variant="outline" onPress={() => router.back()} /></Page>;
  const shop = vendor.data;

  // If the vendor owner is viewing their own shop
  if (user && shop.userId && user.id === shop.userId) {
    return <VendorPortalScreen />;
  }
  return <Page>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border }}><Ionicons name="arrow-back" size={20} color={C.ink} /></Pressable>
        <Text style={{ color: C.ink, fontWeight: "800", fontSize: 18 }}>Campus seller</Text>
      </View>
      <CartIconButton count={cart.data?.itemCount ?? 0} />
    </View>
    <View style={{ padding: 19, backgroundColor: C.green, borderRadius: 22, gap: 12 }}><View style={{ width: 53, height: 53, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}><Ionicons name="storefront" size={25} color={C.white} /></View><Text style={{ color: C.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 }}>{shop.name}</Text><Text style={{ color: "#DAEDE1", fontSize: 13, lineHeight: 19 }}>{shop.description}</Text><View style={{ flexDirection: "row", gap: 15 }}><Text style={{ color: C.white, fontSize: 12, fontWeight: "800" }}>★ {(shop.ratingHundredths / 100).toFixed(1)}</Text><Text style={{ color: C.white, fontSize: 12, fontWeight: "800" }}>~{shop.etaMin} min</Text><Text style={{ color: C.white, fontSize: 12, fontWeight: "800" }}>{shop.isOpen ? "Open now" : "Closed"}</Text></View></View>
    <Text style={{ color: C.ink, fontSize: 19, fontWeight: "900" }}>Menu & Items</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{shop.products.map((product) => <ProductCard key={product.id} product={product} onPress={() => router.push({ pathname: "/(commerce)/product/[id]", params: { id: String(product.id) } })} />)}</View>
    <Button title="Browse all campus needs" variant="outline" onPress={() => router.push("/(tabs)/explore")} />
  </Page>;
}
