import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, C, Field, Notice } from "@/components/camporder/ui";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import { assetSource } from "@/lib/camporder/assets";
import { formatGhs, friendlyError } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

// ─── Types ────────────────────────────────────────────────────────────────────
type Section = "dashboard" | "orders" | "products" | "vendors" | "customers" | "campuses" | "services" | "promotions" | "moderators" | "settings";
type Draft = Record<string, string>;

const NAV_ITEMS: Array<{ key: Section; label: string; icon: keyof typeof Ionicons.glyphMap; group?: string }> = [
  { key: "dashboard", label: "Dashboard", icon: "grid-outline" },
  { key: "orders", label: "Orders", icon: "receipt-outline" },
  { key: "products", label: "Products", icon: "cube-outline" },
  { key: "vendors", label: "Vendors & Stores", icon: "storefront-outline" },
  { key: "customers", label: "Customers", icon: "people-outline" },
  { key: "campuses", label: "Campuses", icon: "school-outline" },
  { key: "promotions", label: "Promotions & Ads", icon: "megaphone-outline" },
  { key: "services", label: "Campus Services", icon: "sparkles-outline" },
  { key: "moderators", label: "Moderators", icon: "shield-checkmark-outline", group: "Admin" },
  { key: "settings", label: "Settings", icon: "settings-outline", group: "Admin" },
];

const PRESET_PHOTOS = [
  { label: "Jollof Bowl", url: "/manus-storage/async-images/p1ku05FZk2C3CZ929wSiYe/image-3.webp" },
  { label: "Chilled Sobolo", url: "/manus-storage/async-images/p1ku05FZk2C3CZ929wSiYe/image-4.webp" },
  { label: "Exam Essentials", url: "/manus-storage/async-images/p1ku05FZk2C3CZ929wSiYe/image-5.webp" },
  { label: "Campus Delivery", url: "/manus-storage/async-images/p1ku05FZk2C3CZ929wSiYe/image-2.webp" },
  { label: "Fried Rice & Chicken", url: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&auto=format&fit=crop&q=80" },
  { label: "Burger & Fries", url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=80" },
  { label: "Smoothie Drink", url: "https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&auto=format&fit=crop&q=80" },
  { label: "Groceries & Snacks", url: "https://images.unsplash.com/photo-1588964895597-cfccd6e2dbf9?w=400&auto=format&fit=crop&q=80" },
  { label: "Notebook & Pen", url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&auto=format&fit=crop&q=80" },
];

const ORDER_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  payment_pending: { label: "Payment Pending", color: "#B45309", bg: "#FEF3C7" },
  placed: { label: "Placed", color: "#6D28D9", bg: "#EDE9FE" },
  accepted: { label: "Accepted", color: "#1D4ED8", bg: "#DBEAFE" },
  preparing: { label: "Preparing", color: "#D97706", bg: "#FEF3C7" },
  on_the_way: { label: "On The Way", color: "#0284C7", bg: "#E0F2FE" },
  completed: { label: "Delivered", color: "#15803D", bg: "#DCFCE7" },
  cancelled: { label: "Cancelled", color: "#B91C1C", bg: "#FEE2E2" },
};

const PROMO_TYPE_LABELS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  banner_ad: { label: "Banner Ad", icon: "image-outline", color: "#7C3AED", bg: "#EDE9FE" },
  product_promo: { label: "Product Promo", icon: "pricetag-outline", color: "#D97706", bg: "#FEF3C7" },
  featured_vendor: { label: "Featured Vendor", icon: "star-outline", color: "#0284C7", bg: "#E0F2FE" },
};

function toDraft(row: Record<string, unknown>): Draft {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? "" : String(v)]));
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [section, setSection] = useState<Section>("dashboard");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [orderFilter, setOrderFilter] = useState("all");
  const [showPhotoPresetModal, setShowPhotoPresetModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedOrderToUpdate, setSelectedOrderToUpdate] = useState<any | null>(null);
  const [showSignoutModal, setShowSignoutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Moderator state
  const [showModeratorModal, setShowModeratorModal] = useState(false);
  const [newModName, setNewModName] = useState("");
  const [newModPhone, setNewModPhone] = useState("");
  const [newModEmail, setNewModEmail] = useState("");
  const [newModPassword, setNewModPassword] = useState("");
  const [modError, setModError] = useState("");

  // Paystack state
  const [paystackInputKey, setPaystackInputKey] = useState("");
  const [paystackSaved, setPaystackSaved] = useState(false);
  const [paystackError, setPaystackError] = useState("");

  // Promo modal state
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Draft | null>(null);
  const [promoError, setPromoError] = useState("");

  // ─── Queries ────────────────────────────────────────────────────────────────
  const analytics = trpc.admin.analytics.useQuery(undefined, { retry: false, refetchInterval: 15_000 });
  const campuses = trpc.admin.campuses.useQuery(undefined, { retry: false });
  const vendors = trpc.admin.vendors.useQuery(undefined, { retry: false });
  const products = trpc.admin.products.useQuery(undefined, { retry: false });
  const services = trpc.admin.services.useQuery(undefined, { retry: false });
  const moderators = trpc.admin.moderators.useQuery(undefined, { retry: false });
  const paystackConfig = trpc.admin.getPaystackConfig.useQuery(undefined, { retry: false });
  const promotionsList = trpc.admin.promotions.useQuery(undefined, { retry: false });

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const logout = trpc.auth.logout.useMutation();
  const uploadImage = trpc.admin.uploadImage.useMutation();
  const updateOrderStatus = trpc.admin.updateOrderStatus.useMutation();
  const toggleVendorStatus = trpc.admin.toggleVendorStatus.useMutation();
  const toggleProductAvailability = trpc.admin.toggleProductAvailability.useMutation();
  const clearProductImage = trpc.admin.clearProductImage.useMutation();
  const createCampus = trpc.admin.createCampus.useMutation();
  const updateCampus = trpc.admin.updateCampus.useMutation();
  const deleteCampus = trpc.admin.deleteCampus.useMutation();
  const createVendor = trpc.admin.createVendor.useMutation();
  const updateVendor = trpc.admin.updateVendor.useMutation();
  const deleteVendor = trpc.admin.deleteVendor.useMutation();
  const createProduct = trpc.admin.createProduct.useMutation();
  const updateProduct = trpc.admin.updateProduct.useMutation();
  const deleteProduct = trpc.admin.deleteProduct.useMutation();
  const createService = trpc.admin.createService.useMutation();
  const updateService = trpc.admin.updateService.useMutation();
  const deleteService = trpc.admin.deleteService.useMutation();
  const createModerator = trpc.admin.createModerator.useMutation();
  const deleteModerator = trpc.admin.deleteModerator.useMutation();
  const updatePaystackKey = trpc.admin.updatePaystackKey.useMutation();
  const createPromotion = trpc.admin.createPromotion.useMutation();
  const updatePromotion = trpc.admin.updatePromotion.useMutation();
  const deletePromotion = trpc.admin.deletePromotion.useMutation();
  const togglePromotion = trpc.admin.togglePromotion.useMutation();

  const invalidate = async () => {
    await Promise.all([
      utils.admin.analytics.invalidate(),
      utils.admin.campuses.invalidate(),
      utils.admin.vendors.invalidate(),
      utils.admin.products.invalidate(),
      utils.admin.services.invalidate(),
      utils.admin.moderators.invalidate(),
      utils.admin.getPaystackConfig.invalidate(),
      utils.admin.promotions.invalidate(),
      utils.catalog.campuses.invalidate(),
      utils.catalog.home.invalidate(),
      utils.catalog.listProducts.invalidate(),
    ]);
  };

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleConfirmLogout = async () => {
    setSigningOut(true);
    try {
      await logout.mutateAsync().catch(() => {});
      if (Platform.OS === "web") {
        try {
          const baseUrl = getApiBaseUrl();
          await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", credentials: "include" });
        } catch {}
      }
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      utils.auth.me.setData(undefined, null as never);
      utils.auth.me.reset();
      await utils.invalidate();
      setShowSignoutModal(false);
      setSigningOut(false);
      if (Platform.OS === "web") {
        window.location.href = "/login";
      } else {
        router.replace("/(auth)/login");
      }
    } catch {
      setSigningOut(false);
      setShowSignoutModal(false);
    }
  };

  const triggerImageUpload = () => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.display = "none";
      document.body.appendChild(input);
      input.onchange = async (event: any) => {
        const file = event.target?.files?.[0];
        if (!file) { document.body.removeChild(input); return; }
        setUploadingImage(true);
        setError("");
        try {
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const base64 = reader.result as string;
              const res = await uploadImage.mutateAsync({ filename: file.name, base64 });
              setEditing((curr) => (curr ? { ...curr, imageUrl: res.url } : curr));
            } catch (uploadErr) {
              setError(friendlyError(uploadErr, "Could not upload photo."));
            } finally {
              setUploadingImage(false);
              document.body.removeChild(input);
            }
          };
          reader.readAsDataURL(file);
        } catch {
          setUploadingImage(false);
          document.body.removeChild(input);
        }
      };
      input.click();
    } else {
      Alert.alert("Photo Upload", "Enter an image URL or choose a preset photo.");
    }
  };

  const confirmDelete = (row: Record<string, unknown>, type: string) => {
    const id = Number(row.id);
    const label = String(row.name ?? row.slug ?? "this record");
    const run = async () => {
      setError("");
      try {
        if (type === "campuses") await deleteCampus.mutateAsync({ id });
        if (type === "vendors") await deleteVendor.mutateAsync({ id });
        if (type === "products") await deleteProduct.mutateAsync({ id });
        if (type === "services") await deleteService.mutateAsync({ id });
        await invalidate();
      } catch (err) {
        setError(friendlyError(err, "Could not delete. May be linked to active orders."));
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Delete ${label}? This cannot be undone.`)) void run();
    } else {
      Alert.alert("Delete record?", `This will permanently remove ${label}.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void run() },
      ]);
    }
  };

  const saveRecord = async () => {
    if (!editing) return;
    setError("");
    try {
      const data: Record<string, unknown> = { ...editing };
      delete data.id;
      delete data.createdAt;
      delete data.updatedAt;
      for (const key of ["campusId", "vendorId", "etaMin", "deliveryFeePesewas", "pricePesewas", "startingPricePesewas", "isActive", "isOpen", "isAvailable"]) {
        if (key in data) data[key] = data[key] === "" && ["vendorId"].includes(key) ? null : Number(data[key]);
      }
      for (const key of ["description", "imageUrl", "badge"]) {
        if (data[key] === "") data[key] = null;
      }
      const id = Number(editing.id);
      if (section === "campuses") {
        if (id) await updateCampus.mutateAsync({ id, data: data as never });
        else await createCampus.mutateAsync(data as never);
      } else if (section === "vendors") {
        if (id) await updateVendor.mutateAsync({ id, data: data as never });
        else await createVendor.mutateAsync(data as never);
      } else if (section === "products") {
        if (id) await updateProduct.mutateAsync({ id, data: data as never });
        else await createProduct.mutateAsync(data as never);
      } else if (section === "services") {
        if (id) await updateService.mutateAsync({ id, data: data as never });
        else await createService.mutateAsync(data as never);
      }
      setEditing(null);
      await invalidate();
    } catch (err) {
      setError(friendlyError(err, "Could not save record. Verify all required fields."));
    }
  };

  const savePromotion = async () => {
    if (!editingPromo) return;
    setPromoError("");
    try {
      const id = Number(editingPromo.id);
      const payload = {
        type: (editingPromo.type || "banner_ad") as "product_promo" | "banner_ad" | "featured_vendor",
        title: editingPromo.title,
        subtitle: editingPromo.subtitle || undefined,
        ctaLabel: editingPromo.ctaLabel || undefined,
        ctaTarget: editingPromo.ctaTarget || undefined,
        imageUrl: editingPromo.imageUrl || undefined,
        badgeText: editingPromo.badgeText || undefined,
        productId: editingPromo.productId ? Number(editingPromo.productId) : undefined,
        vendorId: editingPromo.vendorId ? Number(editingPromo.vendorId) : undefined,
        priority: Number(editingPromo.priority || 0),
      };
      if (id) {
        await updatePromotion.mutateAsync({ id, data: payload });
      } else {
        await createPromotion.mutateAsync(payload);
      }
      setEditingPromo(null);
      setShowPromoModal(false);
      await invalidate();
    } catch (err) {
      setPromoError(friendlyError(err, "Could not save promotion."));
    }
  };

  // ─── Derived Data ────────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!products.data) return [];
    return products.data.filter((p) => {
      const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === "all" || p.category.toLowerCase() === selectedCategory.toLowerCase();
      return matchSearch && matchCat;
    });
  }, [products.data, searchQuery, selectedCategory]);

  const productCategories = useMemo(() => {
    if (!products.data) return ["all"];
    return ["all", ...Array.from(new Set(products.data.map((p) => p.category.toLowerCase())))];
  }, [products.data]);

  const filteredOrders = useMemo(() => {
    const list = analytics.data?.recentOrders ?? [];
    if (orderFilter === "all") return list;
    return list.filter((o) => o.status === orderFilter);
  }, [analytics.data?.recentOrders, orderFilter]);

  // ─── Sidebar Nav ─────────────────────────────────────────────────────────────
  const navGroups = [
    { label: null, items: NAV_ITEMS.filter((n) => !n.group) },
    { label: "Admin Tools", items: NAV_ITEMS.filter((n) => n.group === "Admin") },
  ];

  const sidebarContent = (
    <View style={s.sidebar}>
      {/* Logo */}
      <View style={s.sidebarLogo}>
        <View style={s.logoMark}>
          <Ionicons name="storefront" size={20} color="#fff" />
        </View>
        <View>
          <Text style={s.logoTitle}>CampOrder</Text>
          <View style={s.adminBadge}>
            <Text style={s.adminBadgeText}>Admin Panel</Text>
          </View>
        </View>
      </View>
      <Text style={s.logoSub}>Operations & Live Marketplace</Text>

      <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: 16 }} />

      {/* Nav */}
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {navGroups.map((group, gi) => (
          <View key={gi}>
            {group.label ? <Text style={s.navGroupLabel}>{group.label}</Text> : null}
            {group.items.map((item) => {
              const active = section === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => { setSection(item.key); setEditing(null); setError(""); }}
                  style={[s.navItem, active && s.navItemActive]}
                >
                  <Ionicons name={item.icon} size={18} color={active ? "#fff" : "rgba(255,255,255,0.65)"} />
                  <Text style={[s.navLabel, active && s.navLabelActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={s.sidebarFooter}>
        <View style={s.systemOnline}>
          <View style={s.onlineDot} />
          <Text style={s.onlineText}>System Online</Text>
        </View>
        <Text style={s.versionText}>v1.0.0</Text>
      </View>
    </View>
  );

  // ─── Top Header ───────────────────────────────────────────────────────────────
  const topHeader = (
    <View style={s.topHeader}>
      {/* Search */}
      <View style={s.searchBox}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" />
        <TextInput
          placeholder="Search orders, products, users..."
          placeholderTextColor="#9CA3AF"
          style={s.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Right side */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => void invalidate()} style={s.iconHeaderBtn}>
          <Ionicons name="refresh-outline" size={18} color="#6B7280" />
        </Pressable>
        <Pressable style={s.notifBtn}>
          <Ionicons name="notifications-outline" size={18} color="#6B7280" />
          {(analytics.data?.statusCounts?.placed ?? 0) > 0 ? (
            <View style={s.notifBadge}>
              <Text style={s.notifBadgeText}>{analytics.data?.statusCounts?.placed}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable onPress={() => setShowSignoutModal(true)} style={s.adminAvatar}>
          <Text style={s.adminAvatarText}>AD</Text>
        </Pressable>
        <Pressable onPress={() => setShowSignoutModal(true)} style={{ marginLeft: -6 }}>
          <Text style={s.adminNameText}>Admin</Text>
          <Text style={s.adminRoleText}>Administrator</Text>
        </Pressable>
        <Ionicons name="chevron-down" size={14} color="#9CA3AF" />
      </View>
    </View>
  );

  // ─── KPI Cards ────────────────────────────────────────────────────────────────
  const kpiCards = analytics.data ? (
    <View style={s.kpiRow}>
      {[
        { label: "Total GMV / Revenue", value: formatGhs(analytics.data.totalGmvPesewas), sub: "Paid & completed", icon: "card-outline", color: "#10B981", bg: "#ECFDF5", iconBg: "#D1FAE5" },
        { label: "Total Orders", value: String(analytics.data.totalOrders), sub: `${analytics.data.statusCounts.completed ?? 0} delivered`, icon: "bag-outline", color: "#3B82F6", bg: "#EFF6FF", iconBg: "#DBEAFE" },
        { label: "Stores & Vendors", value: `${analytics.data.openVendors} / ${analytics.data.totalVendors}`, sub: "Open for orders now", icon: "storefront-outline", color: "#F59E0B", bg: "#FFFBEB", iconBg: "#FEF3C7" },
        { label: "Live Products", value: `${analytics.data.availableProducts} / ${analytics.data.totalProducts}`, sub: "In stock right now", icon: "radio-outline", color: "#8B5CF6", bg: "#F5F3FF", iconBg: "#EDE9FE" },
      ].map((card) => (
        <View key={card.label} style={[s.kpiCard, { backgroundColor: card.bg }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <View style={[s.kpiIcon, { backgroundColor: card.iconBg }]}>
              <Ionicons name={card.icon as any} size={20} color={card.color} />
            </View>
            <Ionicons name="trending-up-outline" size={16} color={card.color} />
          </View>
          <Text style={s.kpiLabel}>{card.label}</Text>
          <Text style={[s.kpiValue, { color: card.color }]}>{card.value}</Text>
          <Text style={s.kpiSub}>{card.sub}</Text>
        </View>
      ))}
    </View>
  ) : (
    <View style={s.kpiRow}>
      {[0, 1, 2, 3].map((i) => <View key={i} style={[s.kpiCard, { backgroundColor: "#F3F4F6" }]}><ActivityIndicator color={C.green} /></View>)}
    </View>
  );

  // ─── Main content sections ───────────────────────────────────────────────────
  const renderSection = () => {
    // DASHBOARD
    if (section === "dashboard") {
      return (
        <View style={{ gap: 20 }}>
          <View>
            <Text style={s.pageTitle}>{getGreeting()}, Admin 👋</Text>
            <Text style={s.pageSubtitle}>Here's what's happening with your marketplace today.</Text>
          </View>
          {kpiCards}

          {/* Tab row for sub-sections */}
          <View style={{ gap: 14 }}>
            <View style={s.contentTabRow}>
              {[
                { key: "orders", label: "Live Orders & Status", icon: "analytics-outline" },
                { key: "products", label: "Products", icon: "cube-outline" },
                { key: "vendors", label: "Vendors & Stores", icon: "storefront-outline" },
                { key: "services", label: "Campus Services", icon: "sparkles-outline" },
                { key: "campuses", label: "Campuses", icon: "school-outline" },
              ].map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => setSection(tab.key as Section)}
                  style={s.contentTab}
                >
                  <Ionicons name={tab.icon as any} size={15} color={C.green} />
                  <Text style={s.contentTabText}>{tab.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Orders pipeline preview */}
            <View style={s.tableCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <View>
                  <Text style={s.sectionHeading}>Live Orders & Status Pipeline</Text>
                  <Text style={s.sectionSub}>Update customer orders in real time</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={() => void invalidate()} style={s.smallBtn}>
                    <Ionicons name="refresh-outline" size={14} color={C.green} />
                    <Text style={s.smallBtnText}>Refresh</Text>
                  </Pressable>
                </View>
              </View>

              {/* Status filter pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
                {["all", "placed", "preparing", "on_the_way", "completed", "cancelled"].map((st) => {
                  const active = orderFilter === st;
                  const count = st === "all" ? analytics.data?.totalOrders ?? 0 : analytics.data?.statusCounts[st] ?? 0;
                  return (
                    <Pressable key={st} onPress={() => setOrderFilter(st)} style={[s.filterPill, active && s.filterPillActive]}>
                      <Text style={[s.filterPillText, active && s.filterPillTextActive]}>
                        {st === "all" ? "All Orders" : ORDER_STATUS_LABELS[st]?.label ?? st} ({count})
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Table header */}
              <View style={s.tableHeaderRow}>
                <Text style={[s.tableTh, { width: 110 }]}>ORDER CODE</Text>
                <Text style={[s.tableTh, { flex: 1 }]}>CUSTOMER / DESTINATION</Text>
                <Text style={[s.tableTh, { width: 90 }]}>AMOUNT</Text>
                <Text style={[s.tableTh, { width: 110 }]}>STATUS</Text>
                <Text style={[s.tableTh, { width: 80, textAlign: "right" }]}>ACTION</Text>
              </View>

              {filteredOrders.length === 0 ? (
                <View style={{ paddingVertical: 48, alignItems: "center", gap: 10 }}>
                  <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="receipt-outline" size={32} color="#D1D5DB" />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#374151" }}>No orders found under this filter</Text>
                  <Text style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center" }}>When customers place orders, they'll appear here in real time.</Text>
                </View>
              ) : (
                filteredOrders.map((ord: any) => {
                  const statusMeta = ORDER_STATUS_LABELS[ord.status] ?? { label: ord.status, color: C.muted, bg: "#F3F4F6" };
                  return (
                    <View key={String(ord.id)} style={s.tableRow}>
                      <View style={{ width: 110 }}>
                        <Text style={s.orderCode}>{ord.orderCode}</Text>
                        <Text style={s.orderDate}>{new Date(ord.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</Text>
                      </View>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={s.orderCustomer} numberOfLines={1}>{ord.customerEmail}</Text>
                        <Text style={s.orderAddress} numberOfLines={1}>📍 {ord.deliveryAddress || "Campus address"}</Text>
                      </View>
                      <View style={{ width: 90 }}>
                        <Text style={s.orderAmount}>{formatGhs(ord.totalPesewas)}</Text>
                        <Text style={{ fontSize: 10, color: ord.paymentStatus === "paid" ? C.green : C.coral, fontWeight: "700" }}>
                          {ord.paymentStatus?.toUpperCase() ?? "PENDING"}
                        </Text>
                      </View>
                      <View style={{ width: 110 }}>
                        <View style={[s.statusPill, { backgroundColor: statusMeta.bg }]}>
                          <Text style={[s.statusPillText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                        </View>
                      </View>
                      <View style={{ width: 80, alignItems: "flex-end" }}>
                        <Pressable onPress={() => setSelectedOrderToUpdate(ord)} style={s.actionBtn}>
                          <Text style={s.actionBtnText}>Update</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </View>
      );
    }

    // ORDERS (same as dashboard orders section standalone)
    if (section === "orders") {
      return (
        <View style={{ gap: 16 }}>
          <View style={s.sectionHeaderRow}>
            <View>
              <Text style={s.pageTitle}>Orders</Text>
              <Text style={s.pageSubtitle}>Manage and update all customer orders in real time</Text>
            </View>
            <Pressable onPress={() => void invalidate()} style={s.smallBtn}>
              <Ionicons name="refresh-outline" size={14} color={C.green} />
              <Text style={s.smallBtnText}>Refresh</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {["all", "placed", "preparing", "on_the_way", "completed", "cancelled"].map((st) => {
              const active = orderFilter === st;
              const count = st === "all" ? analytics.data?.totalOrders ?? 0 : analytics.data?.statusCounts[st] ?? 0;
              return (
                <Pressable key={st} onPress={() => setOrderFilter(st)} style={[s.filterPill, active && s.filterPillActive]}>
                  <Text style={[s.filterPillText, active && s.filterPillTextActive]}>
                    {st === "all" ? "All Orders" : ORDER_STATUS_LABELS[st]?.label ?? st} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={s.tableCard}>
            <View style={s.tableHeaderRow}>
              <Text style={[s.tableTh, { width: 110 }]}>ORDER CODE</Text>
              <Text style={[s.tableTh, { flex: 1 }]}>CUSTOMER / DESTINATION</Text>
              <Text style={[s.tableTh, { width: 90 }]}>AMOUNT</Text>
              <Text style={[s.tableTh, { width: 110 }]}>STATUS</Text>
              <Text style={[s.tableTh, { width: 80, textAlign: "right" }]}>ACTION</Text>
            </View>
            {filteredOrders.length === 0 ? (
              <View style={{ padding: 48, alignItems: "center" }}>
                <Ionicons name="receipt-outline" size={36} color="#D1D5DB" />
                <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 12 }}>No orders found</Text>
              </View>
            ) : filteredOrders.map((ord: any) => {
              const statusMeta = ORDER_STATUS_LABELS[ord.status] ?? { label: ord.status, color: C.muted, bg: "#F3F4F6" };
              return (
                <View key={String(ord.id)} style={s.tableRow}>
                  <View style={{ width: 110 }}>
                    <Text style={s.orderCode}>{ord.orderCode}</Text>
                    <Text style={s.orderDate}>{new Date(ord.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</Text>
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={s.orderCustomer} numberOfLines={1}>{ord.customerEmail}</Text>
                    <Text style={s.orderAddress} numberOfLines={1}>📍 {ord.deliveryAddress || "Campus"}</Text>
                  </View>
                  <View style={{ width: 90 }}>
                    <Text style={s.orderAmount}>{formatGhs(ord.totalPesewas)}</Text>
                    <Text style={{ fontSize: 10, color: ord.paymentStatus === "paid" ? C.green : C.coral, fontWeight: "700" }}>{ord.paymentStatus?.toUpperCase()}</Text>
                  </View>
                  <View style={{ width: 110 }}>
                    <View style={[s.statusPill, { backgroundColor: statusMeta.bg }]}>
                      <Text style={[s.statusPillText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                    </View>
                  </View>
                  <View style={{ width: 80, alignItems: "flex-end" }}>
                    <Pressable onPress={() => setSelectedOrderToUpdate(ord)} style={s.actionBtn}>
                      <Text style={s.actionBtnText}>Update</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      );
    }

    // PRODUCTS
    if (section === "products" && !editing) {
      return (
        <View style={{ gap: 16 }}>
          <View style={s.sectionHeaderRow}>
            <View>
              <Text style={s.pageTitle}>Products</Text>
              <Text style={s.pageSubtitle}>Manage menu items, availability and photos</Text>
            </View>
            <Button title="Add Product" icon="add" onPress={() => setEditing({ slug: "", name: "", category: "food", description: "", pricePesewas: "", imageUrl: "", badge: "", vendorId: "" })} />
          </View>
          <View style={s.searchWrap}>
            <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ paddingLeft: 12 }} />
            <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search products..." placeholderTextColor="#9CA3AF" style={s.tableSearch} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {productCategories.map((cat) => (
              <Pressable key={cat} onPress={() => setSelectedCategory(cat)} style={[s.filterPill, selectedCategory === cat && s.filterPillActive]}>
                <Text style={[s.filterPillText, selectedCategory === cat && s.filterPillTextActive]}>{cat === "all" ? "All" : cat}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ gap: 10 }}>
            {filteredProducts.map((prod) => (
              <View key={String(prod.id)} style={s.productRowCard}>
                <View style={s.productThumbWrap}>
                  {prod.imageUrl ? <Image source={assetSource(prod.imageUrl)} contentFit="cover" style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6" }]}><Ionicons name="image-outline" size={22} color="#D1D5DB" /></View>}
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={s.productName}>{prod.name}</Text>
                    {prod.badge ? <View style={s.badgePill}><Text style={s.badgePillText}>{prod.badge}</Text></View> : null}
                  </View>
                  <Text style={s.productMeta}>{prod.category.toUpperCase()} · {formatGhs(prod.pricePesewas)}</Text>
                  {prod.description ? <Text style={s.productDesc} numberOfLines={1}>{prod.description}</Text> : null}
                  <Switch value={prod.isAvailable === 1} onValueChange={async (val) => { await toggleProductAvailability.mutateAsync({ id: prod.id, isAvailable: val ? 1 : 0 }); await invalidate(); }} trackColor={{ false: "#D1D5DB", true: "#A7F3D0" }} thumbColor={prod.isAvailable === 1 ? C.green : "#9CA3AF"} />
                </View>
                <View style={s.rowActions}>
                  <Pressable onPress={() => setEditing(toDraft(prod as any))} style={s.editBtn}><Ionicons name="create-outline" size={14} color={C.green} /><Text style={s.editBtnText}>Edit</Text></Pressable>
                  <Pressable onPress={() => confirmDelete(prod as any, "products")} style={s.deleteBtn}><Ionicons name="trash-outline" size={14} color={C.coral} /><Text style={s.deleteBtnText}>Delete</Text></Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }

    // VENDORS
    if (section === "vendors" && !editing) {
      return (
        <View style={{ gap: 16 }}>
          <View style={s.sectionHeaderRow}>
            <View>
              <Text style={s.pageTitle}>Vendors & Stores</Text>
              <Text style={s.pageSubtitle}>Manage kitchens, stores and delivery ETAs</Text>
            </View>
            <Button title="Add Vendor" icon="add" onPress={() => setEditing({ slug: "", campusId: campuses.data?.[0]?.id ? String(campuses.data[0].id) : "1", name: "", category: "food", description: "", etaMin: "25", deliveryFeePesewas: "500", isOpen: "1" })} />
          </View>
          <View style={{ gap: 12 }}>
            {vendors.data?.map((vendor) => {
              const isOpen = vendor.isOpen === 1;
              return (
                <View key={String(vendor.id)} style={s.vendorCard}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={s.productName}>{vendor.name}</Text>
                      <View style={[s.statusPill, { backgroundColor: isOpen ? "#DCFCE7" : "#FEE2E2" }]}>
                        <Text style={[s.statusPillText, { color: isOpen ? "#15803D" : "#B91C1C" }]}>{isOpen ? "OPEN NOW" : "CLOSED"}</Text>
                      </View>
                    </View>
                    <Text style={s.productMeta}>{vendor.category.toUpperCase()} · ETA ~{vendor.etaMin} min · Delivery {formatGhs(vendor.deliveryFeePesewas)}</Text>
                    {vendor.description ? <Text style={s.productDesc}>{vendor.description}</Text> : null}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <Switch value={isOpen} onValueChange={async (val) => { await toggleVendorStatus.mutateAsync({ id: vendor.id, isOpen: val ? 1 : 0 }); await invalidate(); }} trackColor={{ false: "#D1D5DB", true: "#A7F3D0" }} thumbColor={isOpen ? C.green : "#9CA3AF"} />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: isOpen ? C.green : C.coral }}>{isOpen ? "Accepting Orders" : "Closed to Customers"}</Text>
                    </View>
                  </View>
                  <View style={s.rowActions}>
                    <Pressable onPress={() => setEditing(toDraft(vendor as any))} style={s.editBtn}><Ionicons name="create-outline" size={14} color={C.green} /><Text style={s.editBtnText}>Edit</Text></Pressable>
                    <Pressable onPress={() => confirmDelete(vendor as any, "vendors")} style={s.deleteBtn}><Ionicons name="trash-outline" size={14} color={C.coral} /><Text style={s.deleteBtnText}>Delete</Text></Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      );
    }

    // CAMPUSES
    if (section === "campuses" && !editing) {
      return (
        <View style={{ gap: 16 }}>
          <View style={s.sectionHeaderRow}>
            <View>
              <Text style={s.pageTitle}>Campuses</Text>
              <Text style={s.pageSubtitle}>Institutions and delivery boundaries</Text>
            </View>
            <Button title="Add Campus" icon="add" onPress={() => setEditing({ slug: "", name: "", city: "", region: "", description: "", isActive: "1" })} />
          </View>
          <View style={{ gap: 12 }}>
            {campuses.data?.map((camp) => (
              <View key={String(camp.id)} style={s.vendorCard}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.productName}>{camp.name}</Text>
                  <Text style={s.productMeta}>{camp.city}, {camp.region}</Text>
                  {camp.description ? <Text style={s.productDesc}>{camp.description}</Text> : null}
                </View>
                <View style={s.rowActions}>
                  <Pressable onPress={() => setEditing(toDraft(camp as any))} style={s.editBtn}><Ionicons name="create-outline" size={14} color={C.green} /><Text style={s.editBtnText}>Edit</Text></Pressable>
                  <Pressable onPress={() => confirmDelete(camp as any, "campuses")} style={s.deleteBtn}><Ionicons name="trash-outline" size={14} color={C.coral} /><Text style={s.deleteBtnText}>Delete</Text></Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }

    // SERVICES
    if (section === "services" && !editing) {
      return (
        <View style={{ gap: 16 }}>
          <View style={s.sectionHeaderRow}>
            <View>
              <Text style={s.pageTitle}>Campus Services</Text>
              <Text style={s.pageSubtitle}>Errands, laundry, printing, cleaning & repairs</Text>
            </View>
            <Button title="Add Service" icon="add" onPress={() => setEditing({ slug: "", name: "", category: "Errands", description: "", startingPricePesewas: "1500", isActive: "1" })} />
          </View>
          <View style={{ gap: 12 }}>
            {services.data?.map((srv) => (
              <View key={String(srv.id)} style={s.vendorCard}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.productName}>{srv.name}</Text>
                  <Text style={s.productMeta}>{srv.category} · Starting {formatGhs(srv.startingPricePesewas)}</Text>
                  {srv.description ? <Text style={s.productDesc}>{srv.description}</Text> : null}
                </View>
                <View style={s.rowActions}>
                  <Pressable onPress={() => setEditing(toDraft(srv as any))} style={s.editBtn}><Ionicons name="create-outline" size={14} color={C.green} /><Text style={s.editBtnText}>Edit</Text></Pressable>
                  <Pressable onPress={() => confirmDelete(srv as any, "services")} style={s.deleteBtn}><Ionicons name="trash-outline" size={14} color={C.coral} /><Text style={s.deleteBtnText}>Delete</Text></Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }

    // CUSTOMERS
    if (section === "customers") {
      return (
        <View style={{ gap: 16 }}>
          <View>
            <Text style={s.pageTitle}>Customers</Text>
            <Text style={s.pageSubtitle}>Registered users and activity overview</Text>
          </View>
          <View style={s.tableCard}>
            {analytics.data ? (
              <View style={{ gap: 14 }}>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  {[
                    { label: "Total Users", value: analytics.data.totalOrders > 0 ? "Active" : "0", icon: "people-outline", color: "#3B82F6", bg: "#EFF6FF" },
                    { label: "Active Campus", value: String(analytics.data.totalVendors) + " vendor zones", icon: "location-outline", color: "#10B981", bg: "#ECFDF5" },
                  ].map((item) => (
                    <View key={item.label} style={[{ flex: 1, padding: 16, borderRadius: 14, gap: 8 }, { backgroundColor: item.bg }]}>
                      <Ionicons name={item.icon as any} size={22} color={item.color} />
                      <Text style={{ fontSize: 12, color: "#6B7280" }}>{item.label}</Text>
                      <Text style={{ fontSize: 18, fontWeight: "800", color: item.color }}>{item.value}</Text>
                    </View>
                  ))}
                </View>
                <Notice tone="sage">Customer list with individual order history will be available in the next update. Orders and delivery data is tracked per customer.</Notice>
              </View>
            ) : <ActivityIndicator color={C.green} />}
          </View>
        </View>
      );
    }

    // PROMOTIONS & ADS
    if (section === "promotions") {
      return (
        <View style={{ gap: 16 }}>
          <View style={s.sectionHeaderRow}>
            <View>
              <Text style={s.pageTitle}>Promotions & Ads</Text>
              <Text style={s.pageSubtitle}>Promote products, run banner ads, and feature vendors in the app</Text>
            </View>
            <Button
              title="Create Promotion"
              icon="add"
              onPress={() => {
                setEditingPromo({ type: "banner_ad", title: "", subtitle: "", ctaLabel: "", ctaTarget: "", imageUrl: "", badgeText: "", priority: "0" });
                setPromoError("");
                setShowPromoModal(true);
              }}
            />
          </View>

          {/* Promo type cards */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            {(["banner_ad", "product_promo", "featured_vendor"] as const).map((type) => {
              const meta = PROMO_TYPE_LABELS[type];
              const count = promotionsList.data?.filter((p) => p.type === type).length ?? 0;
              return (
                <View key={type} style={[{ flex: 1, padding: 14, borderRadius: 16, gap: 8, borderWidth: 1, borderColor: "#E5E7EB" }, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon} size={22} color={meta.color} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: meta.color }}>{meta.label}</Text>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: meta.color }}>{count}</Text>
                  <Text style={{ fontSize: 11, color: "#6B7280" }}>active campaigns</Text>
                </View>
              );
            })}
          </View>

          {/* Promotions table */}
          <View style={s.tableCard}>
            <View style={s.tableHeaderRow}>
              <Text style={[s.tableTh, { width: 110 }]}>TYPE</Text>
              <Text style={[s.tableTh, { flex: 1 }]}>TITLE / CONTENT</Text>
              <Text style={[s.tableTh, { width: 80 }]}>PRIORITY</Text>
              <Text style={[s.tableTh, { width: 90 }]}>STATUS</Text>
              <Text style={[s.tableTh, { width: 90, textAlign: "right" }]}>ACTIONS</Text>
            </View>

            {promotionsList.isLoading ? (
              <View style={{ padding: 32, alignItems: "center" }}><ActivityIndicator color={C.green} /></View>
            ) : !promotionsList.data?.length ? (
              <View style={{ padding: 48, alignItems: "center", gap: 10 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="megaphone-outline" size={30} color="#D1D5DB" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#374151" }}>No promotions yet</Text>
                <Text style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", maxWidth: 280 }}>Create banner ads, product spotlights, or feature your top vendors to boost sales.</Text>
              </View>
            ) : (
              promotionsList.data.map((promo) => {
                const meta = PROMO_TYPE_LABELS[promo.type];
                const isActive = promo.isActive === 1;
                return (
                  <View key={String(promo.id)} style={s.tableRow}>
                    <View style={{ width: 110 }}>
                      <View style={[s.statusPill, { backgroundColor: meta.bg }]}>
                        <Text style={[s.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.productName} numberOfLines={1}>{promo.title}</Text>
                      {promo.subtitle ? <Text style={s.productDesc} numberOfLines={1}>{promo.subtitle}</Text> : null}
                      {promo.ctaLabel ? <Text style={{ fontSize: 10, color: C.green, fontWeight: "700" }}>CTA: {promo.ctaLabel}</Text> : null}
                    </View>
                    <View style={{ width: 80, alignItems: "center" }}>
                      <Text style={{ fontSize: 16, fontWeight: "800", color: "#374151" }}>{promo.priority}</Text>
                    </View>
                    <View style={{ width: 90 }}>
                      <Switch
                        value={isActive}
                        onValueChange={async (val) => { await togglePromotion.mutateAsync({ id: promo.id, isActive: val ? 1 : 0 }); await invalidate(); }}
                        trackColor={{ false: "#D1D5DB", true: "#A7F3D0" }}
                        thumbColor={isActive ? C.green : "#9CA3AF"}
                      />
                    </View>
                    <View style={{ width: 90, flexDirection: "row", justifyContent: "flex-end", gap: 6 }}>
                      <Pressable
                        onPress={() => { setEditingPromo(toDraft(promo as any)); setPromoError(""); setShowPromoModal(true); }}
                        style={s.editBtn}
                      >
                        <Ionicons name="create-outline" size={13} color={C.green} />
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          const run = async () => { await deletePromotion.mutateAsync({ id: promo.id }); await invalidate(); };
                          if (Platform.OS === "web") {
                            if (window.confirm(`Delete "${promo.title}"?`)) void run();
                          } else {
                            Alert.alert("Delete Promotion", `Delete "${promo.title}"?`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void run() }]);
                          }
                        }}
                        style={s.deleteBtn}
                      >
                        <Ionicons name="trash-outline" size={13} color={C.coral} />
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      );
    }

    // MODERATORS
    if (section === "moderators") {
      return (
        <View style={{ gap: 16 }}>
          <View style={s.sectionHeaderRow}>
            <View>
              <Text style={s.pageTitle}>Moderators</Text>
              <Text style={s.pageSubtitle}>Operations staff with limited admin privileges</Text>
            </View>
            <Button title="Add Moderator" icon="add" onPress={() => { setNewModName(""); setNewModPhone(""); setNewModEmail(""); setNewModPassword(""); setModError(""); setShowModeratorModal(true); }} />
          </View>
          {moderators.isLoading ? <ActivityIndicator color={C.green} /> : !moderators.data?.length ? (
            <View style={{ padding: 48, alignItems: "center", backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB", gap: 10 }}>
              <Ionicons name="shield-outline" size={40} color="#D1D5DB" />
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#374151" }}>No moderators yet</Text>
              <Text style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", maxWidth: 300 }}>Moderators can manage orders and store status without full admin access.</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {moderators.data.map((mod) => (
                <View key={String(mod.id)} style={s.vendorCard}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="shield-checkmark" size={22} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={s.productName}>{mod.name || "Moderator"}</Text>
                      <View style={[s.statusPill, { backgroundColor: "#DBEAFE" }]}><Text style={[s.statusPillText, { color: "#1E40AF" }]}>MODERATOR</Text></View>
                    </View>
                    <Text style={s.productMeta}>📧 {mod.email || "No email"} · 📱 {mod.phoneNumber || "No phone"}</Text>
                    <Text style={s.productDesc}>Added {new Date(mod.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      const run = async () => { try { await deleteModerator.mutateAsync({ id: mod.id }); await invalidate(); } catch (err) { setError(friendlyError(err, "Could not remove moderator.")); } };
                      if (Platform.OS === "web") { if (window.confirm(`Remove ${mod.name || mod.email} as moderator?`)) void run(); }
                      else Alert.alert("Remove Moderator", `Remove ${mod.name || mod.email}?`, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => void run() }]);
                    }}
                    style={s.deleteBtn}
                  >
                    <Ionicons name="trash-outline" size={14} color={C.coral} />
                    <Text style={s.deleteBtnText}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      );
    }

    // SETTINGS / PAYSTACK
    if (section === "settings") {
      return (
        <View style={{ gap: 16 }}>
          <View>
            <Text style={s.pageTitle}>Settings</Text>
            <Text style={s.pageSubtitle}>Payment gateway configuration and system preferences</Text>
          </View>
          {paystackSaved ? <Notice tone="sage">✅ Paystack key updated successfully!</Notice> : null}
          {paystackError ? <Notice tone="error">{paystackError}</Notice> : null}
          <View style={[s.tableCard, { gap: 18 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="card-outline" size={24} color={C.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "900", color: "#111827" }}>Paystack Gateway</Text>
                <Text style={{ fontSize: 12, color: "#6B7280" }}>MoMo, Cards & Campus Checkout</Text>
              </View>
              <View style={[s.statusPill, { backgroundColor: paystackConfig.data?.configured ? "#DCFCE7" : "#FEF3C7" }]}>
                <Text style={[s.statusPillText, { color: paystackConfig.data?.configured ? "#15803D" : "#B45309" }]}>
                  {paystackConfig.data?.configured ? "CONFIGURED" : "SETUP NEEDED"}
                </Text>
              </View>
            </View>

            <View style={{ backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: "#E5E7EB" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 12, color: "#6B7280", fontWeight: "700" }}>Mode:</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: paystackConfig.data?.isLive ? "#10B981" : "#F59E0B" }} />
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#111827" }}>{paystackConfig.data?.isLive ? "Live Production" : "Test / Sandbox"}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 12, color: "#6B7280", fontWeight: "700" }}>Active Key:</Text>
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#111827", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>{paystackConfig.data?.maskedKey || "Not set"}</Text>
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#111827" }}>Update Secret Key</Text>
              <Text style={{ fontSize: 12, color: "#6B7280", lineHeight: 18 }}>Enter your Paystack key starting with <Text style={{ fontWeight: "700" }}>sk_test_</Text> or <Text style={{ fontWeight: "700" }}>sk_live_</Text></Text>
              <TextInput
                value={paystackInputKey}
                onChangeText={setPaystackInputKey}
                placeholder="sk_test_... or sk_live_..."
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                style={[s.tableSearch, { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, height: 48, flex: 0 }]}
              />
              <Button
                title="Save & Activate Key"
                loading={updatePaystackKey.isPending}
                onPress={async () => {
                  setPaystackError(""); setPaystackSaved(false);
                  if (!paystackInputKey.trim()) { setPaystackError("Please enter a valid key."); return; }
                  try {
                    await updatePaystackKey.mutateAsync({ secretKey: paystackInputKey.trim() });
                    setPaystackSaved(true);
                    setPaystackInputKey("");
                    await invalidate();
                  } catch (err) { setPaystackError(friendlyError(err, "Failed to update key.")); }
                }}
              />
            </View>
          </View>
        </View>
      );
    }

    // EDIT FORM
    if (editing) return null;

    return null;
  };

  // ─── Edit Form (used for products/vendors/services/campuses) ─────────────────
  const renderEditForm = () => {
    if (!editing || ["dashboard", "orders", "customers", "promotions", "moderators", "settings"].includes(section)) return null;
    return (
      <View style={[s.tableCard, { gap: 16 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "900", color: "#111827" }}>
            {editing.id ? `Edit ${section.slice(0, -1)}` : `New ${section.slice(0, -1)}`}
          </Text>
          <Pressable onPress={() => setEditing(null)}>
            <Ionicons name="close" size={22} color="#9CA3AF" />
          </Pressable>
        </View>

        {section === "products" && (
          <>
            {/* Photo upload */}
            <View style={{ backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: "#E5E7EB" }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#374151" }}>Product Photo</Text>
              <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
                <View style={{ width: 80, height: 80, borderRadius: 14, backgroundColor: "#F3F4F6", overflow: "hidden" }}>
                  {editing.imageUrl ? <Image source={assetSource(editing.imageUrl)} contentFit="cover" style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}><Ionicons name="image-outline" size={28} color="#D1D5DB" /></View>}
                  {uploadingImage && <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" }]}><ActivityIndicator color="#fff" /></View>}
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <Pressable onPress={triggerImageUpload} style={s.uploadBtn}><Ionicons name="cloud-upload-outline" size={15} color={C.green} /><Text style={s.uploadBtnText}>Upload Photo</Text></Pressable>
                  <Pressable onPress={() => setShowPhotoPresetModal(true)} style={s.presetBtn}><Ionicons name="images-outline" size={15} color="#374151" /><Text style={s.presetBtnText}>Choose Preset</Text></Pressable>
                </View>
              </View>
            </View>
            <Field label="Product Name" value={editing.name ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, name: v } : c)} placeholder="e.g. Special Jollof Bowl" />
            <Field label="Category" value={editing.category ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, category: v } : c)} placeholder="food, drinks, groceries..." />
            <Field label="Price in Pesewas (2500 = GHS 25.00)" value={editing.pricePesewas ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, pricePesewas: v } : c)} placeholder="2500" keyboardType="numeric" />
            <Field label="Badge (Optional)" value={editing.badge ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, badge: v } : c)} placeholder="Popular, Best Seller, New" />
            <Field label="Description" value={editing.description ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, description: v } : c)} placeholder="Delicious fresh meal..." multiline />
            <Field label="Slug (unique ID)" value={editing.slug ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, slug: v } : c)} placeholder="special-jollof-bowl" />
            <Field label="Vendor ID (Optional)" value={editing.vendorId ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, vendorId: v } : c)} placeholder="1" keyboardType="numeric" />
          </>
        )}
        {section === "vendors" && (
          <>
            <Field label="Vendor Name" value={editing.name ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, name: v } : c)} placeholder="e.g. Auntie Muni Kitchen" />
            <Field label="Campus ID" value={editing.campusId ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, campusId: v } : c)} placeholder="1" keyboardType="numeric" />
            <Field label="Category" value={editing.category ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, category: v } : c)} placeholder="food, groceries, drinks..." />
            <Field label="ETA (minutes)" value={editing.etaMin ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, etaMin: v } : c)} placeholder="25" keyboardType="numeric" />
            <Field label="Delivery Fee (pesewas)" value={editing.deliveryFeePesewas ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, deliveryFeePesewas: v } : c)} placeholder="500" keyboardType="numeric" />
            <Field label="Description" value={editing.description ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, description: v } : c)} placeholder="Authentic meals cooked fresh..." multiline />
            <Field label="Slug" value={editing.slug ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, slug: v } : c)} placeholder="auntie-muni-kitchen" />
          </>
        )}
        {section === "services" && (
          <>
            <Field label="Service Name" value={editing.name ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, name: v } : c)} placeholder="e.g. Laundry & Pressing" />
            <Field label="Category" value={editing.category ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, category: v } : c)} placeholder="Errands, Cleaning, Printing..." />
            <Field label="Starting Price (pesewas)" value={editing.startingPricePesewas ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, startingPricePesewas: v } : c)} placeholder="1500" keyboardType="numeric" />
            <Field label="Description" value={editing.description ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, description: v } : c)} placeholder="Fast campus delivery for your laundry..." multiline />
            <Field label="Slug" value={editing.slug ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, slug: v } : c)} placeholder="laundry-pressing" />
          </>
        )}
        {section === "campuses" && (
          <>
            <Field label="Campus Name" value={editing.name ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, name: v } : c)} placeholder="e.g. KNUST Campus" />
            <Field label="City" value={editing.city ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, city: v } : c)} placeholder="Kumasi" />
            <Field label="Region" value={editing.region ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, region: v } : c)} placeholder="Ashanti" />
            <Field label="Description" value={editing.description ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, description: v } : c)} placeholder="Main university campus marketplace..." multiline />
            <Field label="Slug" value={editing.slug ?? ""} onChangeText={(v: string) => setEditing((c) => c ? { ...c, slug: v } : c)} placeholder="knust" />
          </>
        )}

        <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
          <Button title="Cancel" variant="outline" onPress={() => setEditing(null)} style={{ flex: 1 }} />
          <Button
            title="Save Record"
            onPress={() => void saveRecord()}
            loading={createProduct.isPending || updateProduct.isPending || createVendor.isPending || updateVendor.isPending || createService.isPending || updateService.isPending || createCampus.isPending || updateCampus.isPending}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {/* Sidebar */}
      {sidebarContent}

      {/* Main area */}
      <View style={s.mainArea}>
        {topHeader}

        {error ? (
          <View style={{ paddingHorizontal: 24 }}>
            <Notice tone="error">{error}</Notice>
          </View>
        ) : null}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 20 }} showsVerticalScrollIndicator={false}>
          {renderSection()}
          {renderEditForm()}
        </ScrollView>
      </View>

      {/* ── MODALS ───────────────────────────────────────────────────────────── */}

      {/* Preset Photo Gallery */}
      <Modal visible={showPhotoPresetModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 17, fontWeight: "900", color: "#111827" }}>Select Photo</Text>
              <Pressable onPress={() => setShowPhotoPresetModal(false)}><Ionicons name="close" size={24} color="#9CA3AF" /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {PRESET_PHOTOS.map((item, idx) => (
                  <Pressable key={idx} onPress={() => { setEditing((curr) => curr ? { ...curr, imageUrl: item.url } : curr); setShowPhotoPresetModal(false); }} style={{ width: "30%", gap: 4, alignItems: "center" }}>
                    <Image source={assetSource(item.url)} contentFit="cover" style={{ width: "100%", height: 70, borderRadius: 10 }} />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#374151", textAlign: "center" }} numberOfLines={1}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Update Order Status */}
      {selectedOrderToUpdate && (
        <Modal visible transparent animationType="fade">
          <View style={s.overlay}>
            <View style={s.modalCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: "#111827" }}>Update Order Status</Text>
                  <Text style={{ fontSize: 13, color: "#9CA3AF" }}>{selectedOrderToUpdate.orderCode}</Text>
                </View>
                <Pressable onPress={() => setSelectedOrderToUpdate(null)}><Ionicons name="close" size={24} color="#9CA3AF" /></Pressable>
              </View>
              <View style={{ gap: 8, marginTop: 8 }}>
                {(["placed", "accepted", "preparing", "on_the_way", "completed", "cancelled"] as const).map((st) => {
                  const meta = ORDER_STATUS_LABELS[st];
                  const isCurrent = selectedOrderToUpdate.status === st;
                  return (
                    <Pressable
                      key={st}
                      onPress={async () => { await updateOrderStatus.mutateAsync({ id: selectedOrderToUpdate.id, status: st, paymentStatus: st === "completed" ? "paid" : undefined }); await invalidate(); setSelectedOrderToUpdate(null); }}
                      style={[s.statusSelectRow, isCurrent && { borderColor: C.green, backgroundColor: "#ECFDF5" }]}
                    >
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: meta.color }} />
                      <Text style={{ fontWeight: "800", color: "#111827", fontSize: 14, flex: 1 }}>{meta.label}</Text>
                      {isCurrent ? <Ionicons name="checkmark-circle" size={18} color={C.green} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Create/Edit Promotion Modal */}
      <Modal visible={showPromoModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.modalCard, { maxWidth: 500, width: "100%" }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: "900", color: "#111827" }}>{editingPromo?.id ? "Edit Promotion" : "Create Promotion"}</Text>
                <Text style={{ fontSize: 12, color: "#9CA3AF" }}>Promote a product, run a banner ad, or feature a vendor</Text>
              </View>
              <Pressable onPress={() => { setShowPromoModal(false); setEditingPromo(null); }}><Ionicons name="close" size={24} color="#9CA3AF" /></Pressable>
            </View>
            {promoError ? <Notice tone="error">{promoError}</Notice> : null}
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 12 }}>
                {/* Type selector */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#374151" }}>Promotion Type</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(["banner_ad", "product_promo", "featured_vendor"] as const).map((type) => {
                      const meta = PROMO_TYPE_LABELS[type];
                      const active = editingPromo?.type === type;
                      return (
                        <Pressable key={type} onPress={() => setEditingPromo((c) => c ? { ...c, type } : c)} style={[{ flex: 1, padding: 10, borderRadius: 12, borderWidth: 1.5, alignItems: "center", gap: 4 }, active ? { borderColor: meta.color, backgroundColor: meta.bg } : { borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" }]}>
                          <Ionicons name={meta.icon} size={18} color={active ? meta.color : "#9CA3AF"} />
                          <Text style={{ fontSize: 10, fontWeight: "800", color: active ? meta.color : "#9CA3AF", textAlign: "center" }}>{meta.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <Field label="Title *" value={editingPromo?.title ?? ""} onChangeText={(v: string) => setEditingPromo((c) => c ? { ...c, title: v } : c)} placeholder="e.g. 50% Off This Weekend!" />
                <Field label="Subtitle / Description" value={editingPromo?.subtitle ?? ""} onChangeText={(v: string) => setEditingPromo((c) => c ? { ...c, subtitle: v } : c)} placeholder="Limited time offer on all Jollof bowls" multiline />
                <Field label="Image URL (optional)" value={editingPromo?.imageUrl ?? ""} onChangeText={(v: string) => setEditingPromo((c) => c ? { ...c, imageUrl: v } : c)} placeholder="https://... or /uploads/..." />
                <Field label="Badge Text (e.g. HOT, NEW, 50% OFF)" value={editingPromo?.badgeText ?? ""} onChangeText={(v: string) => setEditingPromo((c) => c ? { ...c, badgeText: v } : c)} placeholder="HOT DEAL" />
                <Field label="CTA Button Label" value={editingPromo?.ctaLabel ?? ""} onChangeText={(v: string) => setEditingPromo((c) => c ? { ...c, ctaLabel: v } : c)} placeholder="Order Now" />
                <Field label="CTA Target (link or product slug)" value={editingPromo?.ctaTarget ?? ""} onChangeText={(v: string) => setEditingPromo((c) => c ? { ...c, ctaTarget: v } : c)} placeholder="/product/jollof-bowl or https://..." />
                <Field label="Product ID (for product_promo)" value={editingPromo?.productId ?? ""} onChangeText={(v: string) => setEditingPromo((c) => c ? { ...c, productId: v } : c)} placeholder="1" keyboardType="numeric" />
                <Field label="Vendor ID (for featured_vendor)" value={editingPromo?.vendorId ?? ""} onChangeText={(v: string) => setEditingPromo((c) => c ? { ...c, vendorId: v } : c)} placeholder="1" keyboardType="numeric" />
                <Field label="Priority (0 = low, 100 = top)" value={editingPromo?.priority ?? "0"} onChangeText={(v: string) => setEditingPromo((c) => c ? { ...c, priority: v } : c)} placeholder="0" keyboardType="numeric" />
              </View>
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <Button title="Cancel" variant="outline" onPress={() => { setShowPromoModal(false); setEditingPromo(null); }} style={{ flex: 1 }} />
              <Button title={editingPromo?.id ? "Save Changes" : "Create Promotion"} loading={createPromotion.isPending || updatePromotion.isPending} onPress={() => void savePromotion()} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Moderator Modal */}
      <Modal visible={showModeratorModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.modalCard, { maxWidth: 440, width: "100%" }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: "900", color: "#111827" }}>Create Moderator</Text>
                <Text style={{ fontSize: 12, color: "#9CA3AF" }}>Grants operations access</Text>
              </View>
              <Pressable onPress={() => setShowModeratorModal(false)}><Ionicons name="close" size={24} color="#9CA3AF" /></Pressable>
            </View>
            {modError ? <Notice tone="error">{modError}</Notice> : null}
            <View style={{ gap: 12 }}>
              <Field label="Full Name" value={newModName} onChangeText={setNewModName} placeholder="e.g. Samuel Mensah" />
              <Field label="Phone Number" value={newModPhone} onChangeText={setNewModPhone} placeholder="024XXXXXXX" keyboardType="phone-pad" />
              <Field label="Email (Optional)" value={newModEmail} onChangeText={setNewModEmail} placeholder="mod@campus.edu" keyboardType="email-address" autoCapitalize="none" />
              <Field label="Password" value={newModPassword} onChangeText={setNewModPassword} placeholder="Min 8 characters" secureTextEntry />
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              <Button title="Cancel" variant="outline" onPress={() => setShowModeratorModal(false)} style={{ flex: 1 }} />
              <Button
                title="Create Moderator"
                loading={createModerator.isPending}
                onPress={async () => {
                  setModError("");
                  if (!newModName.trim() || !newModPhone.trim() || !newModPassword.trim()) { setModError("Name, phone, and password are required."); return; }
                  try {
                    await createModerator.mutateAsync({ name: newModName.trim(), phone: newModPhone.trim(), email: newModEmail.trim() || undefined, password: newModPassword.trim() });
                    await invalidate();
                    setShowModeratorModal(false);
                  } catch (err) { setModError(friendlyError(err, "Could not create moderator.")); }
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Sign Out Modal */}
      <Modal visible={showSignoutModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.modalCard, { maxWidth: 340, alignItems: "center" }]}>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: "#FFF1F2", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="log-out-outline" size={28} color="#E11D48" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: "900", color: "#111827", textAlign: "center" }}>Sign out from Admin?</Text>
            <Text style={{ fontSize: 13, color: "#6B7280", textAlign: "center", lineHeight: 20 }}>You will be returned to the sign-in screen.</Text>
            <View style={{ flexDirection: "row", gap: 10, width: "100%", marginTop: 6 }}>
              <Pressable onPress={() => setShowSignoutModal(false)} disabled={signingOut} style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center" }}>
                <Text style={{ fontWeight: "700", color: "#374151" }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={() => void handleConfirmLogout()} disabled={signingOut} style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#E11D48", alignItems: "center", opacity: signingOut ? 0.7 : 1 }}>
                {signingOut ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontWeight: "800", color: "#fff" }}>Sign out</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: "#F9FAFB" },

  // Sidebar
  sidebar: { width: 210, backgroundColor: "#0D7048", paddingTop: Platform.OS === "ios" ? 50 : 16, paddingBottom: 20, paddingHorizontal: 14, gap: 0 },
  sidebarLogo: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  logoMark: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  logoTitle: { fontSize: 17, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  adminBadge: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: "flex-start", marginTop: 2 },
  adminBadgeText: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  logoSub: { fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 4 },
  navGroupLabel: { fontSize: 10, fontWeight: "800", color: "rgba(255,255,255,0.45)", letterSpacing: 1, marginTop: 16, marginBottom: 4, paddingLeft: 8 },
  navItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 11, borderRadius: 10, marginBottom: 2 },
  navItemActive: { backgroundColor: "rgba(255,255,255,0.18)" },
  navLabel: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.65)" },
  navLabelActive: { color: "#fff", fontWeight: "800" },
  sidebarFooter: { paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)", gap: 2 },
  systemOnline: { flexDirection: "row", alignItems: "center", gap: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ADE80" },
  onlineText: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.7)" },
  versionText: { fontSize: 10, color: "rgba(255,255,255,0.4)" },

  // Main area
  mainArea: { flex: 1, flexDirection: "column" },
  topHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB", gap: 16 },
  searchBox: { flex: 1, maxWidth: 380, flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: "#374151" },
  iconHeaderBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  notifBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center", position: "relative" },
  notifBadge: { position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: "#E11D48", alignItems: "center", justifyContent: "center" },
  notifBadgeText: { fontSize: 9, fontWeight: "900", color: "#fff" },
  adminAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#0D7048", alignItems: "center", justifyContent: "center" },
  adminAvatarText: { fontSize: 12, fontWeight: "900", color: "#fff" },
  adminNameText: { fontSize: 13, fontWeight: "800", color: "#111827" },
  adminRoleText: { fontSize: 11, color: "#9CA3AF" },

  // Page headings
  pageTitle: { fontSize: 22, fontWeight: "900", color: "#111827", letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionHeading: { fontSize: 16, fontWeight: "900", color: "#111827" },
  sectionSub: { fontSize: 12, color: "#6B7280" },

  // KPI
  kpiRow: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  kpiCard: { flex: 1, minWidth: 150, borderRadius: 16, padding: 16, gap: 2 },
  kpiIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  kpiLabel: { fontSize: 12, color: "#6B7280", fontWeight: "600" },
  kpiValue: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  kpiSub: { fontSize: 11, color: "#9CA3AF" },

  // Content tabs on dashboard
  contentTabRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  contentTab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  contentTabText: { fontSize: 13, fontWeight: "700", color: "#374151" },

  // Table
  tableCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "#E5E7EB" },
  tableHeaderRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", marginBottom: 4 },
  tableTh: { fontSize: 10, fontWeight: "800", color: "#9CA3AF", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  orderCode: { fontSize: 13, fontWeight: "800", color: "#111827" },
  orderDate: { fontSize: 10, color: "#9CA3AF" },
  orderCustomer: { fontSize: 12, fontWeight: "700", color: "#374151" },
  orderAddress: { fontSize: 11, color: "#9CA3AF" },
  orderAmount: { fontSize: 13, fontWeight: "800", color: "#111827" },

  // Filters
  filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  filterPillActive: { backgroundColor: "#0D7048", borderColor: "#0D7048" },
  filterPillText: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  filterPillTextActive: { color: "#fff" },

  // Status
  statusPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" },
  statusPillText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" },

  // Action btn
  actionBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  actionBtnText: { fontSize: 11, fontWeight: "800", color: "#374151" },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0" },
  smallBtnText: { fontSize: 12, fontWeight: "700", color: "#0D7048" },

  // Product row
  productRowCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB" },
  productThumbWrap: { width: 64, height: 64, borderRadius: 12, backgroundColor: "#F3F4F6", overflow: "hidden" },
  productName: { fontSize: 14, fontWeight: "800", color: "#111827" },
  productMeta: { fontSize: 11, fontWeight: "700", color: "#0D7048" },
  productDesc: { fontSize: 11, color: "#9CA3AF" },
  badgePill: { backgroundColor: "#FEF3C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgePillText: { fontSize: 9, fontWeight: "800", color: "#B45309" },
  rowActions: { alignItems: "flex-end", gap: 6 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#ECFDF5", borderRadius: 8 },
  editBtnText: { fontSize: 11, fontWeight: "800", color: "#0D7048" },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#FFF1F2", borderRadius: 8 },
  deleteBtnText: { fontSize: 11, fontWeight: "800", color: "#D96C50" },
  vendorCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB" },

  // Search
  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden" },
  tableSearch: { flex: 1, height: 42, paddingHorizontal: 10, fontSize: 13, color: "#374151" },

  // Upload buttons
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0" },
  uploadBtnText: { fontSize: 11, fontWeight: "800", color: "#0D7048" },
  presetBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB" },
  presetBtnText: { fontSize: 11, fontWeight: "700", color: "#374151" },

  // Modals
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 22, padding: 22, gap: 16 },
  statusSelectRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB" },
});
