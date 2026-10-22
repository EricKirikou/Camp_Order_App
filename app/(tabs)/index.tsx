import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BrandMark, C, Chip, Notice, ProductCard, SectionTitle } from "@/components/camporder/ui";
import { useCampOrderUser } from "@/hooks/use-camporder-user";
import { useSelectedCampus } from "@/hooks/use-selected-campus";
import { assetSource, ASSET_PATHS } from "@/lib/camporder/assets";
import { trpc } from "@/lib/trpc";

const FALLBACK_CATEGORIES = [
  { slug: "food", name: "Food", icon: "fast-food-outline" },
  { slug: "drinks", name: "Drinks", icon: "cafe-outline" },
  { slug: "groceries", name: "Groceries", icon: "basket-outline" },
  { slug: "ingredients", name: "Food Ingredients", icon: "leaf-outline" },
  { slug: "health", name: "Health & Personal Care", icon: "medkit-outline" },
  { slug: "stationery", name: "Stationery", icon: "pencil-outline" },
  { slug: "fashion", name: "Fashion", icon: "shirt-outline" },
  { slug: "electronics", name: "Electronics", icon: "headset-outline" },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useCampOrderUser();
  const chosen = useSelectedCampus();
  const [search, setSearch] = useState("");
  const home = trpc.catalog.home.useQuery(chosen.campus ? { campusId: chosen.campus.id } : undefined);
  const cart = trpc.cart.get.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const categories = home.data?.categories ?? FALLBACK_CATEGORIES;
  const campus = home.data?.campus ?? chosen.campus;
  const products = home.data?.products ?? [];
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  }, []);

  const categoryPress = (slug: string) => router.push({ pathname: "/(tabs)/explore", params: { category: slug } });
  return <View style={{ flex: 1, backgroundColor: C.ivory }}>
    <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={() => router.push("/(tabs)/profile")}><BrandMark size={39} /></Pressable>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Pressable onPress={() => router.push("/(commerce)/cart")} style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}><Ionicons name="bag-handle-outline" size={20} color={C.ink} />{(cart.data?.itemCount ?? 0) > 0 ? <View style={{ position: "absolute", right: -3, top: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: C.coral }}><Text style={{ color: C.white, fontSize: 9, fontWeight: "900" }}>{cart.data?.itemCount}</Text></View> : null}</Pressable>
          <Pressable onPress={() => router.push("/(tabs)/profile")} style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.green, fontWeight: "800" }}>{user?.name?.slice(0, 1).toUpperCase() ?? "G"}</Text></Pressable>
        </View>
      </View>
      <Pressable onPress={() => router.push("/(auth)/campus")} style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: C.sage, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12 }}>
        <Ionicons name="location" size={14} color={C.green} /><View><Text style={{ color: C.muted, fontSize: 9, fontWeight: "700" }}>DELIVERING AROUND</Text><Text style={{ color: C.greenDark, fontSize: 12, fontWeight: "800" }} numberOfLines={1}>{campus?.name ? `${campus.name} · ${campus.city}` : "Choose your campus"}</Text></View><Ionicons name="chevron-down" size={14} color={C.green} />
      </Pressable>
      <View style={{ gap: 4 }}><Text style={{ color: C.muted, fontSize: 13 }}>{greeting}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</Text><Text style={{ color: C.ink, fontSize: 28, lineHeight: 34, letterSpacing: -1, fontWeight: "900" }}>Your campus, sorted.</Text></View>
      <Pressable onPress={() => router.push({ pathname: "/(tabs)/explore", params: { query: search } })} style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: C.border, borderRadius: 15, backgroundColor: C.white }}>
        <Ionicons name="search" size={19} color={C.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Food, groceries, services…" placeholderTextColor="#98A39B" style={{ flex: 1, color: C.ink, fontSize: 14 }} onSubmitEditing={() => router.push({ pathname: "/(tabs)/explore", params: { category: "all", query: search } })} returnKeyType="search" /><Ionicons name="options-outline" size={18} color={C.green} />
      </Pressable>
    </View>

    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 17 }}>
        <Pressable onPress={() => router.push("/(services)")} style={{ height: 154, overflow: "hidden", borderRadius: 22, backgroundColor: C.green, padding: 18, justifyContent: "space-between" }}>
          <Image source={assetSource(ASSET_PATHS.campus)} contentFit="cover" style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "55%", opacity: 0.68 }} />
          <View style={{ position: "absolute", right: "30%", top: 0, bottom: 0, width: 56, backgroundColor: C.green, opacity: 0.92, transform: [{ skewX: "-18deg" }] }} />
          <View style={{ gap: 7, width: "65%" }}><Text style={{ color: "#D5EBDC", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 }}>CAMPUS NEEDS, ONE PLACE</Text><Text style={{ color: C.white, fontSize: 23, lineHeight: 27, fontWeight: "900", letterSpacing: -0.6 }}>From lunch to laundry.</Text><Text style={{ color: "#E8F2EB", fontSize: 12 }}>Let your campus day flow.</Text></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Text style={{ color: C.white, fontWeight: "800", fontSize: 12 }}>Explore services</Text><Ionicons name="arrow-forward" color={C.white} size={15} /></View>
        </Pressable>
      </View>

      <View style={{ paddingLeft: 20, marginBottom: 18 }}>
        <SectionTitle title="Browse by need" action="See all" onAction={() => router.push("/(tabs)/explore")} />
        <View style={{ height: 12 }} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, paddingRight: 20 }}>
          {categories.slice(0, 8).map((item: any) => <Chip key={item.slug} title={item.name} icon={item.icon as any} onPress={() => categoryPress(item.slug)} />)}
          <Chip title="More · All Campus Needs" icon="grid-outline" onPress={() => categoryPress("all")} />
        </View>
      </View>

      <View style={{ paddingLeft: 20, marginBottom: 18 }}>
        <SectionTitle title="Shops around campus" action="Explore" onAction={() => router.push("/(tabs)/explore")} />
        <Text style={{ color: C.muted, fontSize: 11, marginTop: 4, marginBottom: 10 }}>Sample sellers · not verified</Text>
        <View style={{ flexDirection: "row", gap: 9, paddingRight: 20 }}>
          {(home.data?.vendors ?? []).slice(0, 2).map((vendor) => <Pressable key={vendor.id} onPress={() => router.push({ pathname: "/(commerce)/vendor/[id]", params: { id: String(vendor.id) } })} style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, gap: 7 }}><View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}><Ionicons name="storefront-outline" size={17} color={C.green} /></View><Text style={{ color: C.ink, fontWeight: "800", fontSize: 12 }} numberOfLines={1}>{vendor.name}</Text><Text style={{ color: C.muted, fontSize: 10 }}>Sample · {vendor.etaMin} min estimate</Text></Pressable>)}
        </View>
      </View>

      <View style={{ paddingLeft: 20, flex: 1 }}>
        <SectionTitle title="Campus favourites" action="View all" onAction={() => categoryPress("all")} />
        <Text style={{ color: C.muted, fontSize: 11, marginTop: 4, marginBottom: 11 }}>Sample listings · availability not verified</Text>
        {home.isLoading ? <Text style={{ color: C.muted, fontSize: 13 }}>Loading campus picks…</Text> : home.isError ? <Notice tone="error">Marketplace is temporarily unavailable.</Notice> : products.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, paddingRight: 20, paddingBottom: 22 }}>{products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} onPress={() => router.push({ pathname: "/(commerce)/product/[id]", params: { id: String(product.id) } })} onAdd={() => user ? router.push({ pathname: "/(commerce)/product/[id]", params: { id: String(product.id), add: "1" } }) : router.push("/(auth)/login")} />)}</View> : <Notice tone="mango">No sample items yet. Run the CampOrder seed task to load preview listings.</Notice>}
      </View>
    </ScrollView>
  </View>;
}
