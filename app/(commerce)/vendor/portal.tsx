import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, C, Header, Notice, Page } from "@/components/camporder/ui";
import { useCampOrderUser } from "@/hooks/use-camporder-user";
import { formatGhs, friendlyError, ORDER_STATUS_LABEL } from "@/lib/camporder/format";
import * as Auth from "@/lib/_core/auth";
import { trpc } from "@/lib/trpc";

function KitchenOrderCard({
  order,
  etaMin = 20,
  onMarkPreparing,
  onMarkPrepared,
  isPreparingLoading,
  isPreparedLoading,
}: {
  order: any;
  etaMin: number;
  onMarkPreparing: (id: number) => void;
  onMarkPrepared: (id: number) => void;
  isPreparingLoading: boolean;
  isPreparedLoading: boolean;
}) {
  const isPreparing = order.status === "preparing";
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!order.updatedAt) return etaMin * 60;
    const startMs = new Date(order.updatedAt).getTime();
    const targetMs = startMs + etaMin * 60 * 1000;
    return Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!isPreparing || !order.updatedAt) return;
    const interval = setInterval(() => {
      const startMs = new Date(order.updatedAt).getTime();
      const targetMs = startMs + etaMin * 60 * 1000;
      const left = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
      setSecondsLeft(left);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPreparing, order.updatedAt, etaMin]);

  const totalSecs = Math.max(60, etaMin * 60);
  const elapsed = totalSecs - secondsLeft;
  const progressPercent = Math.min(100, Math.max(5, Math.floor((elapsed / totalSecs) * 100)));
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formattedTime = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.orderCode}>{order.orderCode}</Text>
            <View
              style={[
                styles.statusBadge,
                order.status === "preparing"
                  ? { backgroundColor: "#FEF3C7" }
                  : order.status === "on_the_way"
                  ? { backgroundColor: "#DCFCE7" }
                  : { backgroundColor: C.sage },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  order.status === "preparing"
                    ? { color: "#B45309" }
                    : order.status === "on_the_way"
                    ? { color: "#15803D" }
                    : { color: C.green },
                ]}
              >
                {ORDER_STATUS_LABEL[order.status] ?? order.status}
              </Text>
            </View>
          </View>
          <Text style={styles.orderAddress} numberOfLines={1}>
            📍 {order.deliveryAddress}
          </Text>
        </View>
      </View>

      <View style={styles.itemsList}>
        {order.items?.map((item: any) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemQty}>{item.quantity}×</Text>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.productName}
            </Text>
            <Text style={styles.itemPrice}>{formatGhs(item.unitPricePesewas * item.quantity)}</Text>
          </View>
        ))}
      </View>

      {isPreparing && (
        <View style={styles.prepTimerContainer}>
          <View style={styles.prepTimerHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="timer-outline" size={16} color="#B45309" />
              <Text style={styles.prepTimerTitle}>Food is being prepared</Text>
            </View>
            <Text style={styles.prepCountdownText}>~{formattedTime} remaining</Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.prepNotice}>
            Prepared wait time set to {etaMin} min. When done, tap below to notify rider!
          </Text>
        </View>
      )}

      <View style={styles.actionRow}>
        {order.status === "placed" || order.status === "accepted" ? (
          <Button
            title="Mark as Preparing 🍳"
            onPress={() => onMarkPreparing(order.id)}
            loading={isPreparingLoading}
            style={{ flex: 1 }}
          />
        ) : null}

        {order.status === "preparing" ? (
          <Button
            title="Mark as Prepared (Rider On The Way) 🚀"
            variant="primary"
            onPress={() => onMarkPrepared(order.id)}
            loading={isPreparedLoading}
            style={{ flex: 1, backgroundColor: "#0D7048" }}
          />
        ) : null}

        {order.status === "on_the_way" ? (
          <View style={styles.onWayBanner}>
            <Ionicons name="bicycle" size={18} color="#15803D" />
            <Text style={styles.onWayBannerText}>Order is on the way to student 🛵</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function VendorPortalScreen() {
  const router = useRouter();
  const { user } = useCampOrderUser();
  const utils = trpc.useUtils();

  const isAdminOrMod = user?.role === "admin" || user?.role === "moderator";
  const isVendorRole = user?.role === "vendor";

  type Tab = "orders" | "products" | "revenue" | "settings";
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Admin/moderator vendor picker
  const [selectedVendorId, setSelectedVendorId] = useState<number | undefined>(undefined);
  const [showVendorPicker, setShowVendorPicker] = useState(false);

  // All vendors list (admin/moderator only)
  const allVendorsQuery = trpc.vendor.listAll.useQuery(undefined, {
    enabled: Boolean(user) && isAdminOrMod,
  });

  const selectedVendor = isAdminOrMod
    ? allVendorsQuery.data?.find((v) => v.id === selectedVendorId) ?? allVendorsQuery.data?.[0]
    : undefined;

  const effectiveVendorId = isAdminOrMod ? (selectedVendorId ?? allVendorsQuery.data?.[0]?.id) : undefined;

  // Data queries
  const profileQuery = trpc.vendor.getProfile.useQuery(
    { vendorId: effectiveVendorId },
    { enabled: Boolean(user) && (isAdminOrMod || isVendorRole) }
  );
  const ordersQuery = trpc.vendor.getKitchenOrders.useQuery(
    { vendorId: effectiveVendorId },
    {
      enabled: Boolean(user) && (isAdminOrMod || isVendorRole),
      refetchInterval: 3500,
    }
  );
  const revenueQuery = trpc.vendor.getRevenue.useQuery(
    { vendorId: effectiveVendorId },
    { enabled: Boolean(user) && (isAdminOrMod || isVendorRole) }
  );

  // Mutations
  const updateProfileMutation = trpc.vendor.updateProfile.useMutation();
  const registerProfileMutation = trpc.vendor.registerProfile.useMutation();
  const createProductMutation = trpc.vendor.createProduct.useMutation();
  const toggleProductMutation = trpc.vendor.toggleProductAvailability.useMutation();
  const deleteProductMutation = trpc.vendor.deleteProduct.useMutation();
  const deleteVendorMutation = trpc.vendor.deleteVendor.useMutation();
  const markPreparingMutation = trpc.vendor.markPreparing.useMutation();
  const markPreparedMutation = trpc.vendor.markPrepared.useMutation();

  // New Vendor Registration / Setup State
  const [setupName, setSetupName] = useState(user?.name ? `${user.name}'s Kitchen` : "");
  const [setupCategory, setSetupCategory] = useState("Food & Drinks");
  const [setupEta, setSetupEta] = useState("20");
  const [setupFee, setSetupFee] = useState("5.00");
  const [setupDesc, setSetupDesc] = useState("");
  const [setupError, setSetupError] = useState("");

  const handleLogout = async () => {
    await Auth.removeSessionToken();
    await Auth.clearUserInfo();
    await utils.auth.me.invalidate();
    router.replace("/(auth)/login");
  };

  // Settings State
  const [shopName, setShopName] = useState("");
  const [category, setCategory] = useState("Food & Drinks");
  const [description, setDescription] = useState("");
  const [etaMin, setEtaMin] = useState("20");
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (profileQuery.data?.shop) {
      const s = profileQuery.data.shop;
      setShopName(s.name);
      setCategory(s.category);
      setDescription(s.description ?? "");
      setEtaMin(String(s.etaMin));
      setIsOpen(Boolean(s.isOpen));
    }
  }, [profileQuery.data?.shop]);

  // Product upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("Meals");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdDesc, setNewProdDesc] = useState("");
  const [newProdBadge, setNewProdBadge] = useState("");
  const [newProdImg, setNewProdImg] = useState("");

  const invalidateAll = async () => {
    await Promise.all([
      utils.vendor.getProfile.invalidate(),
      utils.vendor.getKitchenOrders.invalidate(),
      utils.vendor.getRevenue.invalidate(),
      utils.vendor.listAll.invalidate(),
    ]);
  };

  const handleRegisterProfile = async () => {
    setSetupError("");
    if (!setupName.trim()) {
      setSetupError("Please enter your kitchen or shop name.");
      return;
    }
    const etaNum = parseInt(setupEta, 10);
    if (isNaN(etaNum) || etaNum < 1 || etaNum > 180) {
      setSetupError("Please enter a valid preparation wait time (1-180 minutes).");
      return;
    }
    const feeNum = parseFloat(setupFee);
    const feePesewas = isNaN(feeNum) ? 500 : Math.round(feeNum * 100);

    try {
      await registerProfileMutation.mutateAsync({
        name: setupName.trim(),
        category: setupCategory.trim() || "Food & Drinks",
        description: setupDesc.trim() || undefined,
        etaMin: etaNum,
        deliveryFeePesewas: feePesewas,
      });
      setFeedback("Kitchen profile saved! You can now start uploading your menu items.");
      await invalidateAll();
    } catch (err) {
      setSetupError(friendlyError(err, "Could not save kitchen profile."));
    }
  };

  const handleSaveProfile = async () => {
    setErrorMsg("");
    setFeedback("");
    if (!shopName.trim()) { setErrorMsg("Please enter your vendor/kitchen name."); return; }
    const parsedEta = parseInt(etaMin, 10);
    if (isNaN(parsedEta) || parsedEta < 1 || parsedEta > 180) {
      setErrorMsg("Please enter a valid preparation wait time (1-180 minutes).");
      return;
    }
    try {
      await updateProfileMutation.mutateAsync({
        vendorId: effectiveVendorId,
        name: shopName.trim(),
        category: category.trim(),
        description: description.trim(),
        etaMin: parsedEta,
        isOpen: isOpen ? 1 : 0,
      });
      setFeedback("Kitchen profile updated successfully!");
      await invalidateAll();
    } catch (err) {
      setErrorMsg(friendlyError(err, "Could not update kitchen profile."));
    }
  };

  const handleUploadProduct = async () => {
    setErrorMsg("");
    setFeedback("");
    if (!newProdName.trim()) { setErrorMsg("Please enter a product name."); return; }
    const priceFloat = parseFloat(newProdPrice);
    if (isNaN(priceFloat) || priceFloat <= 0) {
      setErrorMsg("Please enter a valid price in GHS (e.g. 35.00).");
      return;
    }
    const pricePesewas = Math.round(priceFloat * 100);
    try {
      await createProductMutation.mutateAsync({
        vendorId: effectiveVendorId,
        name: newProdName.trim(),
        category: newProdCategory.trim(),
        pricePesewas,
        description: newProdDesc.trim() || undefined,
        badge: newProdBadge.trim() || undefined,
        imageUrl: newProdImg.trim() || undefined,
        isAvailable: 1,
      });
      setShowUploadModal(false);
      setNewProdName(""); setNewProdPrice(""); setNewProdDesc(""); setNewProdBadge(""); setNewProdImg("");
      setFeedback("Product uploaded successfully to your menu!");
      await invalidateAll();
    } catch (err) {
      setErrorMsg(friendlyError(err, "Could not upload product."));
    }
  };

  const handleToggleProduct = async (productId: number, currentAvailable: number) => {
    try {
      const next = currentAvailable === 1 ? 0 : 1;
      await toggleProductMutation.mutateAsync({ productId, isAvailable: next, vendorId: effectiveVendorId });
      await invalidateAll();
    } catch (err) {
      setErrorMsg(friendlyError(err, "Could not update availability."));
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    try {
      await deleteProductMutation.mutateAsync({ productId, vendorId: effectiveVendorId });
      await invalidateAll();
    } catch (err) {
      setErrorMsg(friendlyError(err, "Could not remove product."));
    }
  };

  const handleMarkPreparing = async (orderId: number) => {
    setErrorMsg("");
    try {
      await markPreparingMutation.mutateAsync({ orderId });
      await utils.vendor.getKitchenOrders.invalidate();
    } catch (err) {
      setErrorMsg(friendlyError(err, "Could not start preparation."));
    }
  };

  const handleMarkPrepared = async (orderId: number) => {
    setErrorMsg("");
    try {
      await markPreparedMutation.mutateAsync({ orderId });
      await utils.vendor.getKitchenOrders.invalidate();
      setFeedback("Order marked prepared! Auto-switched to On The Way for rider delivery.");
    } catch (err) {
      setErrorMsg(friendlyError(err, "Could not mark order prepared."));
    }
  };

  const handleDeleteVendor = async () => {
    if (!effectiveVendorId) return;
    try {
      await deleteVendorMutation.mutateAsync({ vendorId: effectiveVendorId });
      setSelectedVendorId(undefined);
      await invalidateAll();
      setFeedback("Vendor deleted successfully.");
    } catch (err) {
      setErrorMsg(friendlyError(err, "Could not delete vendor."));
    }
  };

  // Access guard
  if (!user) {
    return (
      <Page>
        <Header title="Vendor Kitchen" back />
        <Notice tone="mango">Please sign in to manage your vendor kitchen.</Notice>
        <Button title="Sign in" onPress={() => router.push("/(auth)/login")} />
      </Page>
    );
  }

  if (user.role === "user" || user.role === "courier") {
    return (
      <Page>
        <Header title="Vendor Kitchen" back />
        <Notice tone="error">This area is for vendors, admins, and moderators only.</Notice>
      </Page>
    );
  }

  if (profileQuery.isLoading || (isAdminOrMod && allVendorsQuery.isLoading)) {
    return (
      <Page>
        <Header title="Vendor Kitchen" back />
        <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />
        <Text style={{ color: C.muted, textAlign: "center", marginTop: 10 }}>Loading kitchen portal…</Text>
      </Page>
    );
  }

  const shop = profileQuery.data?.shop ?? (isAdminOrMod ? selectedVendor : undefined);

  // If vendor hasn't inserted their kitchen/vendor profile yet, show setup view so they save before uploading
  if (!shop && !isAdminOrMod) {
    return (
      <Page>
        <Header
          title="Set Up Your Kitchen"
          subtitle="Vendor Profile Setup"
          right={
            <Pressable
              onPress={() => void handleLogout()}
              style={styles.signOutBtn}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Text style={styles.signOutBtnText}>Sign out</Text>
            </Pressable>
          }
        />
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 16, marginTop: 8 }}>
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 24, fontWeight: "900", color: C.ink, letterSpacing: -0.6 }}>
                Welcome, {user.name ?? "Vendor"}! 🍽️
              </Text>
              <Text style={{ fontSize: 14, color: C.muted, lineHeight: 21 }}>
                Please insert and save your kitchen or store details below before you can start uploading products and receiving orders.
              </Text>
            </View>

            {setupError ? <Notice tone="error">{setupError}</Notice> : null}

            <View style={styles.settingsCard}>
              <Text style={styles.inputLabel}>Kitchen / Store Name *</Text>
              <TextInput
                style={styles.textInput}
                value={setupName}
                onChangeText={setSetupName}
                placeholder="e.g. Asanka Kitchen or Auntie Muni's"
                placeholderTextColor={C.muted}
              />

              <Text style={styles.inputLabel}>Category</Text>
              <TextInput
                style={styles.textInput}
                value={setupCategory}
                onChangeText={setSetupCategory}
                placeholder="e.g. Food & Drinks, Fast Food, Local Dishes"
                placeholderTextColor={C.muted}
              />

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Prep Wait Time (mins)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={setupEta}
                    onChangeText={setSetupEta}
                    keyboardType="numeric"
                    placeholder="20"
                    placeholderTextColor={C.muted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Delivery Fee (GH₵)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={setupFee}
                    onChangeText={setSetupFee}
                    keyboardType="decimal-pad"
                    placeholder="5.00"
                    placeholderTextColor={C.muted}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 75, textAlignVertical: "top" }]}
                value={setupDesc}
                onChangeText={setSetupDesc}
                placeholder="Tell students about your meals, ingredients, and specialties…"
                placeholderTextColor={C.muted}
                multiline
              />
            </View>

            <Button
              title="Save Kitchen & Start Uploading 🚀"
              icon="checkmark-circle-outline"
              loading={registerProfileMutation.isPending}
              disabled={!setupName.trim() || registerProfileMutation.isPending}
              onPress={() => void handleRegisterProfile()}
            />
          </View>
        </ScrollView>
      </Page>
    );
  }

  const products = profileQuery.data?.products ?? [];
  const kitchenOrders = ordersQuery.data?.orders ?? [];
  const activeOrdersCount = kitchenOrders.filter(
    (o) => o.status === "placed" || o.status === "accepted" || o.status === "preparing"
  ).length;
  const revenue = revenueQuery.data;

  return (
    <Page>
      <Header
        title={isAdminOrMod ? "Vendor Manager" : "Vendor Kitchen"}
        subtitle={shop?.name ?? (isAdminOrMod ? "Select a vendor" : "Kitchen Portal")}
        back={isAdminOrMod}
        right={
          <Pressable
            onPress={() => void handleLogout()}
            style={styles.signOutBtn}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text style={styles.signOutBtnText}>Sign out</Text>
          </Pressable>
        }
      />

      {/* Admin/Moderator Vendor Picker */}
      {isAdminOrMod && (
        <View style={styles.adminPickerBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.adminPickerLabel}>Viewing Vendor:</Text>
            <Pressable onPress={() => setShowVendorPicker(true)} style={styles.vendorPickerButton}>
              <Ionicons name="storefront-outline" size={16} color={C.green} />
              <Text style={styles.vendorPickerText} numberOfLines={1}>
                {shop?.name ?? "Select a vendor…"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={C.muted} />
            </Pressable>
          </View>
          {isAdminOrMod && effectiveVendorId && (
            <Pressable onPress={handleDeleteVendor} style={styles.deleteVendorBtn}>
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
            </Pressable>
          )}
        </View>
      )}

      {/* Shop Hero Banner */}
      {shop && (
        <View style={styles.shopHero}>
          <View style={styles.shopHeroIcon}>
            <Ionicons name="storefront" size={26} color={C.white} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.shopHeroName}>{shop.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>⏱️ ~{shop.etaMin} min wait</Text>
              </View>
              <View
                style={[
                  styles.badgePill,
                  { backgroundColor: shop.isOpen ? "rgba(255,255,255,0.22)" : "rgba(220,38,38,0.25)" },
                ]}
              >
                <Text style={styles.badgePillText}>{shop.isOpen ? "● Open Now" : "○ Closed"}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(["orders", "products", "revenue", "settings"] as Tab[]).map((tab) => {
          const icons: Record<Tab, any> = {
            orders: "receipt-outline",
            products: "cube-outline",
            revenue: "stats-chart-outline",
            settings: "options-outline",
          };
          const labels: Record<Tab, string> = {
            orders: `Orders (${activeOrdersCount})`,
            products: `Products (${products.length})`,
            revenue: "Revenue",
            settings: "Kitchen Info",
          };
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            >
              <Ionicons name={icons[tab]} size={15} color={activeTab === tab ? C.white : C.ink} />
              <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
                {labels[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {feedback ? <Notice tone="mango">{feedback}</Notice> : null}
      {errorMsg ? <Notice tone="error">{errorMsg}</Notice> : null}

      {/* TAB: ORDERS */}
      {activeTab === "orders" && (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.sectionTitle}>Live Kitchen Orders</Text>
            <Pressable onPress={() => ordersQuery.refetch()} style={styles.refreshPill}>
              <Ionicons name="refresh" size={14} color={C.green} />
              <Text style={styles.refreshPillText}>Auto-refreshing</Text>
            </Pressable>
          </View>

          {kitchenOrders.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="restaurant-outline" size={38} color={C.muted} />
              <Text style={styles.emptyTitle}>No incoming orders right now</Text>
              <Text style={styles.emptySub}>
                When students place orders from your kitchen, they will appear here instantly!
              </Text>
            </View>
          ) : (
            kitchenOrders.map((ord: any) => (
              <KitchenOrderCard
                key={ord.id}
                order={ord}
                etaMin={shop?.etaMin ?? 20}
                onMarkPreparing={handleMarkPreparing}
                onMarkPrepared={handleMarkPrepared}
                isPreparingLoading={markPreparingMutation.isPending}
                isPreparedLoading={markPreparedMutation.isPending}
              />
            ))
          )}
        </View>
      )}

      {/* TAB: PRODUCTS */}
      {activeTab === "products" && (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.sectionTitle}>Uploaded Products</Text>
            <Button
              title="+ Upload Product"
              onPress={() => setShowUploadModal(true)}
              style={{ paddingVertical: 10, paddingHorizontal: 16 }}
            />
          </View>

          {products.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="fast-food-outline" size={38} color={C.muted} />
              <Text style={styles.emptyTitle}>No products uploaded yet</Text>
              <Text style={styles.emptySub}>
                Add food items, drinks, or combos so students can order from this kitchen!
              </Text>
              <Button
                title="Upload Your First Product"
                onPress={() => setShowUploadModal(true)}
                style={{ marginTop: 8 }}
              />
            </View>
          ) : (
            products.map((prod) => (
              <View key={prod.id} style={styles.productCard}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={styles.prodName}>{prod.name}</Text>
                    {prod.badge ? (
                      <View style={styles.prodBadgePill}>
                        <Text style={styles.prodBadgeText}>{prod.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.prodCategory}>{prod.category}</Text>
                  {prod.description ? (
                    <Text style={styles.prodDesc} numberOfLines={2}>{prod.description}</Text>
                  ) : null}
                  <Text style={styles.prodPrice}>{formatGhs(prod.pricePesewas)}</Text>
                </View>

                <View style={{ alignItems: "flex-end", gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 12, color: prod.isAvailable ? C.green : C.muted, fontWeight: "700" }}>
                      {prod.isAvailable ? "In Stock" : "Sold Out"}
                    </Text>
                    <Switch
                      value={Boolean(prod.isAvailable)}
                      onValueChange={() => handleToggleProduct(prod.id, prod.isAvailable)}
                      trackColor={{ false: "#CBD5E1", true: "#86EFAC" }}
                      thumbColor={prod.isAvailable ? C.green : "#94A3B8"}
                    />
                  </View>
                  <Pressable onPress={() => handleDeleteProduct(prod.id)} style={styles.deleteButton}>
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* TAB: REVENUE */}
      {activeTab === "revenue" && (
        <View style={{ gap: 14 }}>
          <Text style={styles.sectionTitle}>Revenue & Stats</Text>
          {revenueQuery.isLoading ? (
            <ActivityIndicator color={C.green} />
          ) : (
            <>
              <View style={styles.revenueGrid}>
                <View style={[styles.revenueCard, { backgroundColor: "#DCFCE7" }]}>
                  <Ionicons name="cash-outline" size={24} color="#15803D" />
                  <Text style={[styles.revenueValue, { color: "#15803D" }]}>
                    {formatGhs(revenue?.totalRevenuePesewas ?? 0)}
                  </Text>
                  <Text style={styles.revenueLabel}>Total Revenue</Text>
                </View>
                <View style={[styles.revenueCard, { backgroundColor: "#DBEAFE" }]}>
                  <Ionicons name="receipt-outline" size={24} color="#1D4ED8" />
                  <Text style={[styles.revenueValue, { color: "#1D4ED8" }]}>
                    {revenue?.totalOrders ?? 0}
                  </Text>
                  <Text style={styles.revenueLabel}>Total Orders</Text>
                </View>
                <View style={[styles.revenueCard, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="time-outline" size={24} color="#B45309" />
                  <Text style={[styles.revenueValue, { color: "#B45309" }]}>
                    {revenue?.pendingOrders ?? 0}
                  </Text>
                  <Text style={styles.revenueLabel}>Pending Orders</Text>
                </View>
                <View style={[styles.revenueCard, { backgroundColor: "#F3E8FF" }]}>
                  <Ionicons name="checkmark-circle-outline" size={24} color="#7C3AED" />
                  <Text style={[styles.revenueValue, { color: "#7C3AED" }]}>
                    {revenue?.completedOrders ?? 0}
                  </Text>
                  <Text style={styles.revenueLabel}>Completed</Text>
                </View>
              </View>

              {/* Show all vendors summary for admin/moderator */}
              {isAdminOrMod && allVendorsQuery.data && (
                <View style={{ gap: 10, marginTop: 8 }}>
                  <Text style={[styles.sectionTitle, { fontSize: 15 }]}>All Vendors Overview</Text>
                  {allVendorsQuery.data.map((v) => (
                    <View key={v.id} style={styles.vendorSummaryCard}>
                      <View style={styles.vendorSummaryIcon}>
                        <Ionicons name="storefront-outline" size={18} color={C.green} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.vendorSummaryName}>{v.name}</Text>
                        <Text style={styles.vendorSummaryMeta}>{v.category} · {v.isOpen ? "Open" : "Closed"}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.vendorRevText}>{formatGhs(v.totalRevenuePesewas)}</Text>
                        <Text style={styles.vendorOrdersText}>{v.totalOrders} orders</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* TAB: SETTINGS */}
      {activeTab === "settings" && (
        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Kitchen Profile & Wait Time</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Kitchen / Vendor Name</Text>
            <TextInput
              style={styles.textInput}
              value={shopName}
              onChangeText={setShopName}
              placeholder="e.g. Grandma's Kitchen, Campus Grill"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Category</Text>
            <TextInput
              style={styles.textInput}
              value={category}
              onChangeText={setCategory}
              placeholder="e.g. Food & Drinks, Fast Food, Bakery"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Preparation Wait Time (Minutes)</Text>
            <TextInput
              style={styles.textInput}
              value={etaMin}
              onChangeText={setEtaMin}
              keyboardType="number-pad"
              placeholder="e.g. 20"
            />
            <Text style={styles.inputHelper}>
              This powers the realtime wait timer shown to customers while you prepare their meal.
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Kitchen Description</Text>
            <TextInput
              style={[styles.textInput, { height: 70, textAlignVertical: "top" }]}
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Tell students about your specialty dishes and fresh ingredients."
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Store Open for Orders</Text>
              <Text style={styles.switchSub}>
                {isOpen ? "Currently taking orders from students" : "Store is paused / closed"}
              </Text>
            </View>
            <Switch
              value={isOpen}
              onValueChange={setIsOpen}
              trackColor={{ false: "#CBD5E1", true: "#86EFAC" }}
              thumbColor={isOpen ? C.green : "#94A3B8"}
            />
          </View>

          <Button
            title="Save Kitchen Profile"
            onPress={handleSaveProfile}
            loading={updateProfileMutation.isPending}
            style={{ marginTop: 8 }}
          />
        </View>
      )}

      {/* MODAL: UPLOAD PRODUCT */}
      <Modal visible={showUploadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload New Product</Text>
              <Pressable onPress={() => setShowUploadModal(false)}>
                <Ionicons name="close" size={24} color={C.ink} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newProdName}
                  onChangeText={setNewProdName}
                  placeholder="e.g. Fried Rice with Spicy Chicken"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <TextInput
                  style={styles.textInput}
                  value={newProdCategory}
                  onChangeText={setNewProdCategory}
                  placeholder="e.g. Main Dishes, Snacks, Drinks"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Price in GHS *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newProdPrice}
                  onChangeText={setNewProdPrice}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 45.00"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Badge (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={newProdBadge}
                  onChangeText={setNewProdBadge}
                  placeholder="e.g. Chef Special, Popular, Spicy"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { height: 60, textAlignVertical: "top" }]}
                  value={newProdDesc}
                  onChangeText={setNewProdDesc}
                  multiline
                  placeholder="Portion size, ingredients or sides included."
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Image URL (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={newProdImg}
                  onChangeText={setNewProdImg}
                  placeholder="https://images.unsplash.com/..."
                />
              </View>

              <Button
                title="Upload Product to Menu"
                onPress={handleUploadProduct}
                loading={createProductMutation.isPending}
                style={{ marginTop: 8 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: Vendor Picker (admin/mod only) */}
      <Modal visible={showVendorPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "70%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Vendor</Text>
              <Pressable onPress={() => setShowVendorPicker(false)}>
                <Ionicons name="close" size={24} color={C.ink} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {allVendorsQuery.isLoading ? (
                <ActivityIndicator color={C.green} style={{ marginTop: 20 }} />
              ) : (
                allVendorsQuery.data?.map((v) => (
                  <Pressable
                    key={v.id}
                    style={[
                      styles.vendorPickerItem,
                      v.id === effectiveVendorId && styles.vendorPickerItemActive,
                    ]}
                    onPress={() => {
                      setSelectedVendorId(v.id);
                      setShowVendorPicker(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vendorPickerItemName}>{v.name}</Text>
                      <Text style={styles.vendorPickerItemMeta}>
                        {v.category} · {v.isOpen ? "🟢 Open" : "🔴 Closed"} · {v.totalOrders} orders · {formatGhs(v.totalRevenuePesewas)} revenue
                      </Text>
                    </View>
                    {v.id === effectiveVendorId && (
                      <Ionicons name="checkmark-circle" size={20} color={C.green} />
                    )}
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Page>
  );
}

const styles = StyleSheet.create({
  adminPickerBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  adminPickerLabel: {
    fontSize: 11,
    color: C.muted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  vendorPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  vendorPickerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: C.ink,
  },
  deleteVendorBtn: {
    padding: 10,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
  },
  shopHero: {
    backgroundColor: C.green,
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  shopHeroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  shopHeroName: {
    color: C.white,
    fontSize: 20,
    fontWeight: "900",
  },
  badgePill: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgePillText: {
    color: C.white,
    fontSize: 11,
    fontWeight: "800",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: C.sage,
    padding: 4,
    borderRadius: 16,
    gap: 4,
    flexWrap: "wrap",
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 12,
    gap: 4,
    minWidth: 70,
  },
  tabButtonActive: { backgroundColor: C.green },
  tabButtonText: { color: C.ink, fontSize: 11, fontWeight: "700" },
  tabButtonTextActive: { color: C.white, fontWeight: "900" },
  sectionTitle: { color: C.ink, fontSize: 18, fontWeight: "900" },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.sage,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  refreshPillText: { color: C.green, fontSize: 11, fontWeight: "700" },
  emptyCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  emptyTitle: { color: C.ink, fontSize: 16, fontWeight: "800" },
  emptySub: { color: C.muted, fontSize: 13, textAlign: "center", lineHeight: 18 },
  orderCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  orderHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  orderCode: { fontSize: 15, fontWeight: "900", color: C.ink },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: "800" },
  orderAddress: { fontSize: 12, color: C.muted },
  itemsList: { gap: 4 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemQty: { fontSize: 13, fontWeight: "700", color: C.muted, width: 26 },
  itemName: { flex: 1, fontSize: 13, color: C.ink },
  itemPrice: { fontSize: 13, fontWeight: "700", color: C.ink },
  prepTimerContainer: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  prepTimerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  prepTimerTitle: { fontSize: 13, fontWeight: "800", color: "#B45309" },
  prepCountdownText: { fontSize: 14, fontWeight: "900", color: "#B45309" },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#FDE68A",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", backgroundColor: "#D97706", borderRadius: 4 },
  prepNotice: { fontSize: 11, color: "#92400E" },
  actionRow: { flexDirection: "row", gap: 10 },
  onWayBanner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#DCFCE7",
    borderRadius: 12,
    padding: 12,
  },
  onWayBannerText: { color: "#15803D", fontWeight: "700", fontSize: 13 },
  productCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  prodName: { fontSize: 15, fontWeight: "800", color: C.ink },
  prodCategory: { fontSize: 12, color: C.muted, fontWeight: "600" },
  prodDesc: { fontSize: 12, color: C.muted, lineHeight: 16 },
  prodPrice: { fontSize: 15, fontWeight: "900", color: C.green },
  prodBadgePill: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  prodBadgeText: { fontSize: 10, fontWeight: "800", color: "#B45309" },
  deleteButton: {
    padding: 8,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
  },
  revenueGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  revenueCard: {
    flex: 1,
    minWidth: "44%",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    gap: 6,
  },
  revenueValue: { fontSize: 20, fontWeight: "900" },
  revenueLabel: { fontSize: 12, color: C.muted, fontWeight: "700", textAlign: "center" },
  vendorSummaryCard: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  vendorSummaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  vendorSummaryName: { fontSize: 14, fontWeight: "800", color: C.ink },
  vendorSummaryMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  vendorRevText: { fontSize: 14, fontWeight: "900", color: "#15803D" },
  vendorOrdersText: { fontSize: 11, color: C.muted, fontWeight: "600" },
  settingsCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: "700", color: C.ink },
  inputHelper: { fontSize: 11, color: C.muted, lineHeight: 15 },
  textInput: {
    backgroundColor: C.sage,
    borderRadius: 12,
    padding: 13,
    fontSize: 14,
    color: C.ink,
    borderWidth: 1,
    borderColor: C.border,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.sage,
    borderRadius: 14,
    padding: 14,
  },
  switchTitle: { fontSize: 14, fontWeight: "800", color: C.ink },
  switchSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 16,
    maxHeight: "90%",
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 20, fontWeight: "900", color: C.ink },
  vendorPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: C.sage,
  },
  vendorPickerItemActive: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1.5,
    borderColor: C.green,
  },
  vendorPickerItemName: { fontSize: 14, fontWeight: "800", color: C.ink },
  vendorPickerItemMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  signOutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  signOutBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#DC2626",
  },
});
