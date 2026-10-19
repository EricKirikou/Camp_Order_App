import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Button, C, Notice, Page, ProductCard } from "@/components/camporder/ui";
import { trpc } from "@/lib/trpc";

export default function VendorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const vendor = trpc.catalog.vendor.useQuery({ id: Number(id) }, { enabled: Number.isInteger(Number(id)) && Number(id) > 0 });
  if (vendor.isLoading) return <Page><Text style={{ color: C.muted }}>Loading campus shop…</Text></Page>;
  if (!vendor.data) return <Page><Text style={{ color: C.ink, fontSize: 20, fontWeight: "800" }}>Shop unavailable</Text><Button title="Explore campus" variant="outline" onPress={() => router.back()} /></Page>;
  const shop = vendor.data;
  return <Page>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}><Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border }}><Ionicons name="arrow-back" size={20} color={C.ink} /></Pressable><Text style={{ color: C.ink, fontWeight: "800", fontSize: 18 }}>Campus seller</Text></View>
    <View style={{ padding: 19, backgroundColor: C.green, borderRadius: 22, gap: 12 }}><View style={{ width: 53, height: 53, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}><Ionicons name="storefront" size={25} color={C.white} /></View><Text style={{ color: C.white, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 }}>{shop.name}</Text><Text style={{ color: "#DAEDE1", fontSize: 13, lineHeight: 19 }}>{shop.description}</Text><View style={{ flexDirection: "row", gap: 15 }}><Text style={{ color: C.white, fontSize: 12, fontWeight: "800" }}>★ {(shop.ratingHundredths / 100).toFixed(1)}</Text><Text style={{ color: C.white, fontSize: 12, fontWeight: "800" }}>~{shop.etaMin} min</Text><Text style={{ color: C.white, fontSize: 12, fontWeight: "800" }}>{shop.isOpen ? "Sample open" : "Closed"}</Text></View></View>
    {shop.isSample ? <Notice tone="mango">This is a demo seller profile, not a verified or operating merchant. Rating and delivery time are illustrative.</Notice> : null}
    <Text style={{ color: C.ink, fontSize: 19, fontWeight: "900" }}>Sample menu</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{shop.products.map((product) => <ProductCard key={product.id} product={product} onPress={() => router.push({ pathname: "/(commerce)/product/[id]", params: { id: String(product.id) } })} />)}</View>
    <Button title="Browse all campus needs" variant="outline" onPress={() => router.push("/(tabs)/explore")} />
  </Page>;
}
