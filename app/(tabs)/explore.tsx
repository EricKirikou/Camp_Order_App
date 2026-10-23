import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Button, C, CartIconButton, Chip, Notice, ProductCard, SectionTitle } from "@/components/camporder/ui";
import { useCampOrderUser } from "@/hooks/use-camporder-user";
import { friendlyError, serviceDisplayName } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; query?: string }>();
  const [mode, setMode] = useState<"shop" | "services">("shop");
  const category = params.category || "all";
  const search = params.query || "";
  const { user } = useCampOrderUser();
  const categories = trpc.catalog.categories.useQuery();
  const products = trpc.catalog.listProducts.useQuery({ category, query: search || undefined });
  const services = trpc.services.list.useQuery(undefined, { enabled: mode === "services" });
  const utils = trpc.useUtils();
  const cart = trpc.cart.get.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const add = trpc.cart.add.useMutation();
  const [message, setMessage] = useState("");

  const addItem = async (productId: number) => {
    if (!user) { router.push("/(auth)/login"); return; }
    setMessage("");
    try {
      await add.mutateAsync({ productId });
      await utils.cart.get.invalidate();
      setMessage("✓ Added to your campus cart.");
    } catch (err) {
      const msg = friendlyError(err);
      if (msg.toLowerCase().includes("unauthenticated")) router.push("/(auth)/login");
      else setMessage(msg);
    }
  };

  const filteredServices = useMemo(() => services.data ?? [], [services.data]);
  return <ScrollView style={{ flex: 1, backgroundColor: C.ivory }} contentContainerStyle={{ paddingBottom: 24 }}>
    <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View><Text style={{ color: C.muted, fontSize: 12 }}>Your campus marketplace</Text><Text style={{ color: C.ink, fontSize: 28, fontWeight: "900", letterSpacing: -0.8 }}>Explore</Text></View>
        <CartIconButton count={cart.data?.itemCount ?? 0} />
      </View>
      <View style={{ height: 48, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13, backgroundColor: C.white, borderColor: C.border, borderWidth: 1, borderRadius: 14 }}><Ionicons name="search" color={C.muted} size={19} /><TextInput value={search} onChangeText={(value) => router.setParams({ query: value })} placeholder={mode === "shop" ? "Search campus essentials…" : "Search campus services…"} placeholderTextColor="#98A39B" style={{ flex: 1, fontSize: 14, color: C.ink }} returnKeyType="search" />{search ? <Pressable onPress={() => router.setParams({ query: "" })}><Ionicons name="close-circle" size={18} color={C.muted} /></Pressable> : null}</View>
      <View style={{ flexDirection: "row", backgroundColor: "#EEF3EF", padding: 4, borderRadius: 14 }}>
        {(["shop", "services"] as const).map((value) => <Pressable key={value} onPress={() => setMode(value)} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 11, backgroundColor: mode === value ? C.white : "transparent" }}><Text style={{ color: mode === value ? C.green : C.muted, fontSize: 13, fontWeight: "800" }}>{value === "shop" ? "Shop & essentials" : "Campus services"}</Text></Pressable>)}
      </View>
    </View>

    {mode === "shop" ? <View style={{ paddingHorizontal: 20, paddingTop: 13 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 15 }}>{(categories.data ?? []).map((item) => <Chip key={item.slug} title={item.name} active={category === item.slug} onPress={() => router.setParams({ category: item.slug })} />)}</View>
      {message ? <Notice>{message}</Notice> : null}
      {products.isError ? <Notice tone="error">Campus items are unavailable right now.</Notice> : products.isLoading ? <Text style={{ color: C.muted }}>Finding campus picks…</Text> : products.data?.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between", paddingBottom: 24 }}>{products.data.map((product) => <ProductCard key={product.id} product={product} onPress={() => router.push({ pathname: "/(commerce)/product/[id]", params: { id: String(product.id) } })} onAdd={() => void addItem(product.id)} />)}</View> : <View style={{ paddingTop: 20, alignItems: "center", gap: 10 }}><Ionicons name="search-outline" size={32} color={C.green} /><Text style={{ color: C.ink, fontWeight: "800" }}>No matches yet</Text><Text style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>Try a different search or category.</Text><Button title="Show all needs" variant="outline" onPress={() => { router.setParams({ category: "all", query: "" }); }} /></View>}
    </View> : <View style={{ padding: 20, gap: 15 }}>
      <View style={{ borderRadius: 20, backgroundColor: C.green, padding: 18, gap: 8 }}><Text style={{ color: "#D6EBDE", fontWeight: "800", fontSize: 11, letterSpacing: 1 }}>LIFE ON CAMPUS</Text><Text style={{ color: C.white, fontSize: 22, fontWeight: "900" }}>Little tasks, handled.</Text><Text style={{ color: "#E9F2EC", fontSize: 13, lineHeight: 19 }}>Request errands and appointments directly from your student hub.</Text></View>
      <SectionTitle title="Ways we can help" action="Create an errand" onAction={() => router.push("/(services)/errand")} />
      {services.isLoading ? <Text style={{ color: C.muted }}>Loading campus services…</Text> : services.isError ? <Notice tone="error">Campus services are unavailable.</Notice> : filteredServices.map((service) => <Pressable key={service.id} onPress={() => router.push({ pathname: "/(services)/book/[id]", params: { id: String(service.id) } })} style={{ padding: 15, borderRadius: 17, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ width: 45, height: 45, borderRadius: 15, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}><Ionicons name={service.category.toLowerCase().includes("study") ? "print-outline" : service.category.toLowerCase().includes("care") ? "cut-outline" : service.category.toLowerCase().includes("repair") ? "construct-outline" : "sparkles-outline"} size={20} color={C.green} /></View><View style={{ flex: 1, gap: 4 }}><Text style={{ color: C.ink, fontWeight: "800", fontSize: 14 }}>{serviceDisplayName(service.slug, service.name)}</Text><Text style={{ color: C.muted, fontSize: 11 }} numberOfLines={1}>{service.description}</Text></View><Ionicons name="chevron-forward" size={18} color={C.muted} /></Pressable>)}
      <Button title="Create a personal errand" icon="add" variant="outline" onPress={() => router.push("/(services)/errand")} />
    </View>}
  </ScrollView>;
}
