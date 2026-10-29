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
  // Realtime countdown for food being prepared
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

      {/* Items list */}
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

      {/* Realtime wait timer when food is being prepared */}
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

      {/* Action buttons */}
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

  const [activeTab, setActiveTab] = useState<"orders" | "products" | "settings">("orders");
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Data queries
  const profileQuery = trpc.vendor.getProfile.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const ordersQuery = trpc.vendor.getKitchenOrders.useQuery(undefined, {
    enabled: Boolean(user),
    refetchInterval: 3500, // Live poll every 3.5s
  });

  // Mutations
  const updateProfileMutation = trpc.vendor.updateProfile.useMutation();
  const createProductMutation = trpc.vendor.createProduct.useMutation();
  const toggleProductMutation = trpc.vendor.toggleProductAvailability.useMutation();
  const deleteProductMutation = trpc.vendor.deleteProduct.useMutation();
  const markPreparingMutation = trpc.vendor.markPreparing.useMutation();
  const markPreparedMutation = trpc.vendor.markPrepared.useMutation();

  // Settings State
  const [shopName, setShopName] = useState("");
  const [category, setCategory] = useState("Food & Drinks");
  const [description, setDescription] = useState("");
  const [etaMin, setEtaMin] = useState("20");
  const [isOpen, setIsOpen] = useState(true);

  // Sync shop state when loaded
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

  // Upload Product Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("Meals");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdDesc, setNewProdDesc] = useState("");
  const [newProdBadge, setNewProdBadge] = useState("");
  const [newProdImg, setNewProdImg] = useState("");

  const handleSaveProfile = async () => {
    setErrorMsg("");
    setFeedback("");
    if (!shopName.trim()) {
      setErrorMsg("Please enter your vendor/kitchen name.");
      return;
    }
    const parsedEta = parseInt(etaMin, 10);
    if (isNaN(parsedEta) || parsedEta < 1 || parsedEta > 180) {
      setErrorMsg("Please enter a valid preparation wait time (1-180 minutes).");
      return;
    }
    try {
      await updateProfileMutation.mutateAsync({
        name: shopName.trim(),
        category: category.trim(),
        description: description.trim(),
        etaMin: parsedEta,
        isOpen: isOpen ? 1 : 0,
      });
      setFeedback("Kitchen profile updated successfully!");
      await utils.vendor.getProfile.invalidate();
      await utils.vendor.getKitchenOrders.invalidate();
    } catch (err) {
      setErrorMsg(friendlyError(err, "Could not update kitchen profile."));
    }
  };

  const handleUploadProduct = async () => {
    setErrorMsg("");
    setFeedback("");
    if (!newProdName.trim()) {
      setErrorMsg("Please enter a product name.");
      return;
    }
    const priceFloat = parseFloat(newProdPrice);
    if (isNaN(priceFloat) || priceFloat <= 0) {
      setErrorMsg("Please enter a valid price in GHS (e.g. 35.00).");
      return;
    }
    const pricePesewas = Math.round(priceFloat * 100);

    try {
      await createProductMutation.mutateAsync({
        name: newProdName.trim(),
        category: newProdCategory.trim(),
        pricePesewas,
        description: newProdDesc.trim() || undefined,
        badge: newProdBadge.trim() || undefined,
        imageUrl: newProdImg.trim() || undefined,
        isAvailable: 1,
      });

      setShowUploadModal(false);
      setNewProdName("");
      setNewProdPrice("");
      setNewProdDesc("");
      setNewProdBadge("");
      setNewProdImg("");
      setFeedback("Product uploaded successfully to your menu!");
      await utils.vendor.getProfile.invalidate();
    } catch (err) {
      setErrorMsg(friendlyError(err, "Could not upload product."));
    }
  };

  const handleToggleProduct = async (productId: number, currentAvailable: number) => {
    try {
      const next = currentAvailable === 1 ? 0 : 1;
      await toggleProductMutation.mutateAsync({ productId, isAvailable: next });
      await utils.vendor.getProfile.invalidate();
    } catch (err) {
      setErrorMsg(friendlyError(err, "Could not update availability."));
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    try {
      await deleteProductMutation.mutateAsync({ productId });
      await utils.vendor.getProfile.invalidate();
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
      // Auto skips to 'on_the_way'
      await markPreparedMutation.mutateAsync({ orderId });
      await utils.vendor.getKitchenOrders.invalidate();
      setFeedback("Order marked prepared! Auto-switched to On The Way for rider delivery.");
    } catch (err) {
      setErrorMsg(friendlyError(err, "Could not mark order prepared."));
    }
  };

  if (!user) {
    return (
      <Page>
        <Header title="Vendor Kitchen" back />
        <Notice tone="mango">Please sign in to manage your vendor kitchen.</Notice>
        <Button title="Sign in" onPress={() => router.push("/(auth)/login")} />
      </Page>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <Page>
        <Header title="Vendor Kitchen" back />
        <Text style={{ color: C.muted }}>Loading your kitchen portal…</Text>
      </Page>
    );
  }

  const shop = profileQuery.data?.shop;
  const products = profileQuery.data?.products ?? [];
  const kitchenOrders = ordersQuery.data?.orders ?? [];
  const activeOrdersCount = kitchenOrders.filter((o) => o.status === "placed" || o.status === "accepted" || o.status === "preparing").length;

  return (
    <Page>
      <Header
        title="Vendor Kitchen"
        subtitle={shop?.name ?? "Kitchen Portal"}
        back
      />

      {/* Vendor Profile Summary Banner */}
      <View style={styles.shopHero}>
        <View style={styles.shopHeroIcon}>
          <Ionicons name="storefront" size={26} color={C.white} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.shopHeroName}>{shop?.name ?? "My Campus Kitchen"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>⏱️ ~{shop?.etaMin ?? 20} min wait</Text>
            </View>
            <View
              style={[
                styles.badgePill,
                { backgroundColor: shop?.isOpen ? "rgba(255,255,255,0.22)" : "rgba(220,38,38,0.25)" },
              ]}
            >
              <Text style={styles.badgePillText}>{shop?.isOpen ? "● Open Now" : "○ Closed"}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Top Nav Tabs */}
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setActiveTab("orders")}
          style={[styles.tabButton, activeTab === "orders" && styles.tabButtonActive]}
        >
          <Ionicons
            name="receipt-outline"
            size={18}
            color={activeTab === "orders" ? C.white : C.ink}
          />
          <Text
            style={[styles.tabButtonText, activeTab === "orders" && styles.tabButtonTextActive]}
          >
            Orders ({activeOrdersCount})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("products")}
          style={[styles.tabButton, activeTab === "products" && styles.tabButtonActive]}
        >
          <Ionicons
            name="cube-outline"
            size={18}
            color={activeTab === "products" ? C.white : C.ink}
          />
          <Text
            style={[styles.tabButtonText, activeTab === "products" && styles.tabButtonTextActive]}
          >
            Products ({products.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("settings")}
          style={[styles.tabButton, activeTab === "settings" && styles.tabButtonActive]}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={activeTab === "settings" ? C.white : C.ink}
          />
          <Text
            style={[styles.tabButtonText, activeTab === "settings" && styles.tabButtonTextActive]}
          >
            Kitchen Info
          </Text>
        </Pressable>
      </View>

      {feedback ? <Notice tone="mango">{feedback}</Notice> : null}
      {errorMsg ? <Notice tone="error">{errorMsg}</Notice> : null}

      {/* TAB 1: KITCHEN ORDERS */}
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

      {/* TAB 2: UPLOAD & MANAGE PRODUCTS */}
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
                Add food items, drinks, or combos so students on campus can order from you!
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
                    <Text style={styles.prodDesc} numberOfLines={2}>
                      {prod.description}
                    </Text>
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

                  <Pressable
                    onPress={() => handleDeleteProduct(prod.id)}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* TAB 3: KITCHEN PROFILE & PREP WAIT TIME */}
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
    </Page>
  );
}

const styles = StyleSheet.create({
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
    gap: 6,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: C.green,
  },
  tabButtonText: {
    color: C.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  tabButtonTextActive: {
    color: C.white,
    fontWeight: "900",
  },
  sectionTitle: {
    color: C.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.sage,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  refreshPillText: {
    color: C.green,
    fontSize: 11,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  emptyTitle: {
    color: C.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  emptySub: {
    color: C.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  orderCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  orderCode: {
    color: C.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  orderAddress: {
    color: C.muted,
    fontSize: 12,
  },
  itemsList: {
    borderTopWidth: 1,
    borderColor: C.border,
    paddingTop: 10,
    gap: 6,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemQty: {
    color: C.green,
    fontWeight: "900",
    fontSize: 13,
  },
  itemName: {
    color: C.ink,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  itemPrice: {
    color: C.ink,
    fontWeight: "800",
    fontSize: 13,
  },
  prepTimerContainer: {
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    gap: 8,
  },
  prepTimerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  prepTimerTitle: {
    color: "#B45309",
    fontSize: 12,
    fontWeight: "800",
  },
  prepCountdownText: {
    color: "#92400E",
    fontSize: 13,
    fontWeight: "900",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#FDE68A",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#F59E0B",
    borderRadius: 3,
  },
  prepNotice: {
    color: "#78350F",
    fontSize: 11,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  onWayBanner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#DCFCE7",
    paddingVertical: 10,
    borderRadius: 14,
  },
  onWayBannerText: {
    color: "#15803D",
    fontSize: 13,
    fontWeight: "800",
  },
  productCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  prodName: {
    color: C.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  prodBadgePill: {
    backgroundColor: C.paleMango,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  prodBadgeText: {
    color: "#9A661E",
    fontSize: 10,
    fontWeight: "800",
  },
  prodCategory: {
    color: C.muted,
    fontSize: 12,
  },
  prodDesc: {
    color: C.muted,
    fontSize: 12,
  },
  prodPrice: {
    color: C.green,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },
  deleteButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
  },
  settingsCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: C.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  inputHelper: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: C.ink,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  switchTitle: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  switchSub: {
    color: C.muted,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
    gap: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    color: C.ink,
    fontSize: 18,
    fontWeight: "900",
  },
});
