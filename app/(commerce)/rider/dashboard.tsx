import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, C, Header, Notice, Page } from '@/components/camporder/ui';
import { trpc } from '@/lib/trpc';

type PendingOrder = {
  id: number;
  orderCode?: string;
  restaurantName: string;
  dropoffAddress: string;
  payout: number; // amount in pesewas
  createdAt: string;
  status?: string;
};

export default function RiderDashboard() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [dismissedOrderIds, setDismissedOrderIds] = useState<number[]>([]);

  const [confirmModalOrder, setConfirmModalOrder] = useState<any | null>(null);
  const [inputCode, setInputCode] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);

  // Fetch rider earnings and completed delivery count in real-time
  const { data: earnings, refetch: refetchEarnings } = trpc.rider.getEarnings.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // Fetch pending orders and poll every 5 seconds so new orders pop up automatically
  const { data: pendingOrders, isLoading, error, refetch, isRefetching } = trpc.rider.pendingOrders.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const acceptOrder = trpc.rider.acceptOrder.useMutation({
    onSuccess: (order: { id: number; status: string }) => {
      utils.rider.pendingOrders.invalidate();
      router.push({ pathname: "/(commerce)/order/[id]", params: { id: String(order.id) } });
    },
    onError: (_e: unknown) => {
      alert('Could not accept order. It may have already been accepted by another courier.');
    },
  });

  const confirmDelivery = trpc.rider.confirmDelivery.useMutation({
    onSuccess: (res) => {
      utils.rider.pendingOrders.invalidate();
      utils.rider.getEarnings.invalidate();
      setPayoutSuccess(`Order delivered! ${formatCurrency(res.earnedPesewas)} delivery and service pay credited to your account.`);
      setConfirmModalOrder(null);
      setInputCode("");
      setConfirmError("");
    },
    onError: (err: any) => {
      setConfirmError(err?.message || "Incorrect 6-digit confirmation code. Please ask the receiver.");
    },
  });

  const handleAccept = async (orderId: number) => {
    setLoadingId(orderId);
    try {
      await acceptOrder.mutateAsync({ orderId });
    } finally {
      setLoadingId(null);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!confirmModalOrder) return;
    if (inputCode.trim().length !== 6) {
      setConfirmError("Please enter the complete 6-digit confirmation code.");
      return;
    }
    setConfirmError("");
    try {
      await confirmDelivery.mutateAsync({
        orderId: confirmModalOrder.id,
        confirmationCode: inputCode.trim(),
      });
    } catch {
      // Handled in onError
    }
  };

  // Identify orders in the system that haven't been accepted yet
  const unacceptedOrders = (pendingOrders ?? []).filter((o) => o.status === "placed");
  // Find the first unaccepted order that hasn't been dismissed by the rider
  const popupOrder = unacceptedOrders.find((o) => !dismissedOrderIds.includes(o.id)) ?? null;

  const handleDismissPopup = () => {
    if (popupOrder) {
      setDismissedOrderIds((prev) => [...prev, popupOrder.id]);
    }
  };

  if (isLoading) {
    return (
      <Page>
        <Header title="Rider Dashboard" back />
        <ActivityIndicator size="large" color={C.green} style={{ marginTop: 40 }} />
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <Header title="Rider Dashboard" back />
        <Notice tone="error">Failed to load orders. Please try again later.</Notice>
        <Button title="Retry" onPress={() => refetch()} style={{ marginTop: 14 }} />
      </Page>
    );
  }

  const totalPayout = earnings?.totalPayoutPesewas ?? 0;
  const completedCount = earnings?.completedCount ?? 0;

  return (
    <Page scroll={false}>
      <Header title="Rider Dashboard" subtitle="Campus courier dispatches & earnings" back />

      {/* Rider Earnings & Payment Summary Card */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <View style={styles.earningsCard}>
          <View style={styles.earningsTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.earningsLabel}>TOTAL COURIER PAY</Text>
              <Text style={styles.earningsAmount}>{formatCurrency(totalPayout)}</Text>
            </View>
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-done-circle" size={18} color="#15803D" />
              <Text style={styles.completedBadgeText}>
                {completedCount} {completedCount === 1 ? 'Delivery' : 'Deliveries'} Done
              </Text>
            </View>
          </View>

          <View style={styles.earningsRateRow}>
            <Ionicons name="flash" size={14} color="#D97706" />
            <Text style={styles.earningsRateText}>
              Automatic pay: GH₵5.00 delivery + GH₵3.00 service fee = GH₵8.00 per drop-off
            </Text>
          </View>
        </View>
      </View>

      {/* Delivery Confirmation 6-Digit PIN Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={Boolean(confirmModalOrder)}
        onRequestClose={() => setConfirmModalOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Pressable
              onPress={() => setConfirmModalOrder(null)}
              style={styles.modalCloseBtn}
              hitSlop={10}
            >
              <Ionicons name="close" size={20} color={C.muted} />
            </Pressable>

            <View style={[styles.modalIconBadge, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="key" size={32} color="#15803D" />
            </View>

            <Text style={styles.modalTitle}>Confirm Delivery 📦</Text>
            <Text style={styles.modalSubtitle}>
              Ask the receiver for their 6-digit code to confirm receipt and release your delivery payment automatically.
            </Text>

            {confirmModalOrder && (
              <View style={styles.orderDetailsBox}>
                <View style={styles.orderDetailRow}>
                  <Ionicons name="restaurant-outline" size={16} color={C.green} />
                  <Text style={styles.orderDetailTextBold} numberOfLines={1}>
                    {confirmModalOrder.restaurantName}
                  </Text>
                </View>
                <View style={styles.orderDetailRow}>
                  <Ionicons name="location-outline" size={16} color={C.coral} />
                  <Text style={styles.orderDetailText} numberOfLines={1}>
                    Drop-off: {confirmModalOrder.dropoffAddress}
                  </Text>
                </View>
                <View style={styles.payoutHighlightRow}>
                  <Text style={styles.payoutLabel}>Payment You Will Receive:</Text>
                  <View style={styles.payoutBadge}>
                    <Text style={styles.payoutBadgeText}>GH₵8.00 (Pay + Bonus)</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={{ width: '100%', marginVertical: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: C.ink, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Enter Receiver's 6-Digit Code:
              </Text>
              <TextInput
                style={styles.codeInput}
                placeholder="••••••"
                placeholderTextColor="#9CA3AF"
                value={inputCode}
                onChangeText={(val) => setInputCode(val.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>

            {confirmError ? (
              <View style={styles.modalErrorBox}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.modalErrorText}>{confirmError}</Text>
              </View>
            ) : null}

            <View style={{ gap: 10, width: '100%', marginTop: 8 }}>
              <Button
                title={confirmDelivery.isPending ? "Verifying..." : "Verify Code & Get Paid 💰"}
                loading={confirmDelivery.isPending}
                disabled={inputCode.trim().length !== 6 || confirmDelivery.isPending}
                style={{ backgroundColor: "#15803D" }}
                onPress={() => void handleConfirmDelivery()}
              />
              <Button
                title="Cancel"
                variant="quiet"
                onPress={() => setConfirmModalOrder(null)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {payoutSuccess ? (
        <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
          <View style={styles.payoutSuccessNotice}>
            <Ionicons name="checkmark-circle" size={20} color="#15803D" />
            <Text style={styles.payoutSuccessText}>{payoutSuccess}</Text>
            <Pressable onPress={() => setPayoutSuccess(null)} hitSlop={10}>
              <Ionicons name="close" size={18} color="#15803D" />
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Pop-up modal if only there is an order in the system that hasn't been accepted */}
      <Modal
        animationType="fade"
        transparent
        visible={Boolean(popupOrder)}
        onRequestClose={handleDismissPopup}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Pressable
              onPress={handleDismissPopup}
              style={styles.modalCloseBtn}
              hitSlop={10}
            >
              <Ionicons name="close" size={20} color={C.muted} />
            </Pressable>

            <View style={styles.modalIconBadge}>
              <Ionicons name="bicycle" size={32} color={C.green} />
            </View>

            <Text style={styles.modalTitle}>New Order Available! 🔔</Text>
            <Text style={styles.modalSubtitle}>
              An unaccepted delivery order is waiting for a courier.
            </Text>

            {popupOrder && (
              <View style={styles.orderDetailsBox}>
                <View style={styles.orderDetailRow}>
                  <Ionicons name="restaurant-outline" size={17} color={C.green} />
                  <Text style={styles.orderDetailTextBold} numberOfLines={1}>
                    {popupOrder.restaurantName}
                  </Text>
                </View>

                <View style={styles.orderDetailRow}>
                  <Ionicons name="location-outline" size={17} color={C.coral} />
                  <Text style={styles.orderDetailText} numberOfLines={2}>
                    {popupOrder.dropoffAddress}
                  </Text>
                </View>

                <View style={styles.payoutHighlightRow}>
                  <Text style={styles.payoutLabel}>Courier Payout:</Text>
                  <View style={styles.payoutBadge}>
                    <Text style={styles.payoutBadgeText}>
                      {formatCurrency(popupOrder.payout)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={{ gap: 10, width: '100%' }}>
              <Button
                title={loadingId === popupOrder?.id ? "Accepting..." : "Accept Delivery Now"}
                icon="checkmark-circle-outline"
                loading={loadingId === popupOrder?.id}
                onPress={() => popupOrder && handleAccept(popupOrder.id)}
              />
              <Button
                title="Review Later / Dismiss"
                variant="quiet"
                onPress={handleDismissPopup}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Main Dashboard Screen Content */}
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        {unacceptedOrders.length > 0 ? (
          <View style={{ marginBottom: 12 }}>
            <Notice tone="mango">
              ⚡ {unacceptedOrders.length} unaccepted order{unacceptedOrders.length > 1 ? "s" : ""} waiting for delivery pickup!
            </Notice>
          </View>
        ) : null}

        {!pendingOrders?.length ? (
          <View style={{ marginTop: 20 }}>
            <Notice tone="sage">No orders at the moment. Pull down to refresh or wait for new orders to arrive.</Notice>
          </View>
        ) : (
          <FlatList
            data={pendingOrders}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.green} />
            }
            renderItem={({ item }) => {
              const isUnaccepted = item.status === "placed" && !item.isMine;
              const isMine = Boolean(item.isMine);
              const isPrepared = Boolean(item.isFoodPrepared);
              const isPreparing = item.status === "preparing";

              return (
                <View style={[
                  styles.card,
                  isUnaccepted && styles.cardHighlight,
                  isMine && isPrepared && styles.cardPreparedHighlight,
                ]}>
                  {/* Top Bar with Restaurant and Status Badges */}
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.title} numberOfLines={1}>{item.restaurantName}</Text>
                      {item.orderCode ? (
                        <Text style={styles.orderCodeText}>#{item.orderCode}</Text>
                      ) : null}
                    </View>

                    {/* Status badge */}
                    {isUnaccepted ? (
                      <View style={[styles.statusTag, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[styles.statusTagText, { color: '#B45309' }]}>
                          UNACCEPTED
                        </Text>
                      </View>
                    ) : isMine ? (
                      <View style={[
                        styles.statusTag,
                        isPrepared
                          ? { backgroundColor: '#DCFCE7' }
                          : isPreparing
                          ? { backgroundColor: '#FEF3C7' }
                          : { backgroundColor: '#E0F2FE' }
                      ]}>
                        <Text style={[
                          styles.statusTagText,
                          isPrepared
                            ? { color: '#15803D' }
                            : isPreparing
                            ? { color: '#B45309' }
                            : { color: '#0369A1' }
                        ]}>
                          {isPrepared ? '🍳 FOOD PREPARED' : isPreparing ? '⏳ KITCHEN PREPARING' : 'MY ACCEPTED ORDER'}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.statusTag, { backgroundColor: '#F3F4F6' }]}>
                        <Text style={[styles.statusTagText, { color: '#6B7280' }]}>
                          {item.status?.toUpperCase() ?? 'ASSIGNED'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Prepared Food Alert Banner if accepted by this rider */}
                  {isMine && isPrepared && (
                    <View style={styles.foodPreparedBanner}>
                      <Ionicons name="checkmark-done-circle" size={20} color="#15803D" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.foodPreparedTitle}>Food is Prepared & Ready! 🎉</Text>
                        <Text style={styles.foodPreparedSub}>
                          The vendor has prepared this order. Head over to pick it up and deliver!
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Still preparing notice if accepted by rider */}
                  {isMine && isPreparing && (
                    <View style={styles.foodPreparingBanner}>
                      <Ionicons name="time-outline" size={18} color="#B45309" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.foodPreparingTitle}>Kitchen is preparing food...</Text>
                        <Text style={styles.foodPreparingSub}>
                          You accepted this delivery. You will see an update here as soon as it's prepared!
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Order Items Preview (so rider sees the exact food) */}
                  {item.items && item.items.length > 0 && (
                    <View style={styles.itemsPreviewBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Ionicons name="fast-food-outline" size={15} color={C.green} />
                        <Text style={styles.itemsPreviewTitle}>Items in this order:</Text>
                      </View>
                      {item.items.map((it: any) => (
                        <Text key={it.id} style={styles.itemBullet} numberOfLines={1}>
                          • {it.quantity}× {it.productName}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Drop-off address */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 4 }}>
                    <Ionicons name="location-outline" size={16} color={C.muted} />
                    <Text style={styles.sub} numberOfLines={2}>Drop‑off: {item.dropoffAddress}</Text>
                  </View>

                  {/* Card Footer with Payout and Actions */}
                  <View style={styles.cardFooter}>
                    <View>
                      <Text style={styles.payoutLabel}>Total Payout</Text>
                      <Text style={styles.payout}>GH₵8.00</Text>
                      <Text style={{ fontSize: 10, color: C.muted, fontWeight: '600' }}>GH₵5 fee + GH₵3 service</Text>
                    </View>

                    {isUnaccepted ? (
                      <TouchableOpacity
                        style={[styles.acceptButton, styles.acceptButtonPrimary]}
                        onPress={() => handleAccept(item.id)}
                        disabled={loadingId === item.id}
                      >
                        {loadingId === item.id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.buttonText}>Accept Delivery</Text>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        {/* Delivered button allows rider to directly tick and enter the 6-digit receiver code */}
                        {(isPrepared || item.status === "on_the_way") && (
                          <TouchableOpacity
                            style={[styles.acceptButton, { backgroundColor: '#15803D' }]}
                            onPress={() => {
                              setConfirmModalOrder(item);
                              setInputCode("");
                              setConfirmError("");
                            }}
                          >
                            <Ionicons name="checkmark-done" size={16} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.buttonText}>Delivered ✅</Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          style={[styles.acceptButton, styles.acceptButtonSecondary]}
                          onPress={() => router.push({ pathname: "/(commerce)/order/[id]", params: { id: String(item.id) } })}
                        >
                          <Ionicons name={isPrepared ? "navigate-outline" : "eye-outline"} size={16} color="#fff" style={{ marginRight: 4 }} />
                          <Text style={styles.buttonText}>
                            {isPrepared ? "Map" : "View"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
            contentContainerStyle={{ paddingBottom: 32, paddingTop: 4 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Page>
  );
}

// Helper to format pesewas into GHS with two decimals
function formatCurrency(pesewas: number) {
  const ghs = pesewas / 100;
  return `GH₵${ghs.toFixed(2)}`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHighlight: {
    borderColor: '#FDE68A',
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: C.ink,
    flex: 1,
    marginRight: 8,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  sub: {
    fontSize: 13,
    color: C.muted,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  payout: {
    fontSize: 15,
    fontWeight: '800',
    color: C.greenDark,
  },
  acceptButton: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonPrimary: {
    backgroundColor: C.green,
  },
  acceptButtonSecondary: {
    backgroundColor: '#3B82F6',
  },
  acceptButtonPrepared: {
    backgroundColor: '#15803D',
  },
  cardPreparedHighlight: {
    borderColor: '#86EFAC',
    borderWidth: 2,
    backgroundColor: '#FAFCFA',
  },
  orderCodeText: {
    fontSize: 12,
    color: C.muted,
    fontWeight: '600',
    marginTop: 2,
  },
  foodPreparedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#DCFCE7',
    padding: 12,
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  foodPreparedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
  },
  foodPreparedSub: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 16,
    marginTop: 2,
  },
  foodPreparingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  foodPreparingTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
  },
  foodPreparingSub: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
    marginTop: 2,
  },
  itemsPreviewBox: {
    backgroundColor: C.sage,
    padding: 10,
    borderRadius: 10,
    marginVertical: 6,
    gap: 3,
  },
  itemsPreviewTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemBullet: {
    fontSize: 13,
    color: C.ink,
    fontWeight: '600',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: C.white,
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: C.ink,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  orderDetailsBox: {
    backgroundColor: '#F9FAF9',
    borderRadius: 16,
    padding: 16,
    marginVertical: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  orderDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  orderDetailTextBold: {
    fontSize: 14,
    fontWeight: '800',
    color: C.ink,
    flex: 1,
  },
  orderDetailText: {
    fontSize: 13,
    color: C.ink,
    flex: 1,
  },
  payoutHighlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  payoutLabel: {
    fontSize: 13,
    color: C.muted,
    fontWeight: '700',
  },
  payoutBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  payoutBadgeText: {
    fontSize: 15,
    fontWeight: '900',
    color: C.greenDark,
  },

  // Earnings Card Styles
  earningsCard: {
    backgroundColor: '#052E16',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#15803D',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    gap: 12,
  },
  earningsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  earningsLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#86EFAC',
    letterSpacing: 0.8,
  },
  earningsAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  earningsRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  earningsRateText: {
    fontSize: 12,
    color: '#D1FAE5',
    fontWeight: '600',
    flex: 1,
  },

  // 6-Digit Code Input
  codeInput: {
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#15803D',
    borderRadius: 14,
    paddingVertical: 14,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 8,
    color: C.ink,
  },
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    width: '100%',
    marginTop: 4,
  },
  modalErrorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '700',
    flex: 1,
  },

  // Payout Success Notice
  payoutSuccessNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    padding: 14,
    borderRadius: 16,
  },
  payoutSuccessText: {
    fontSize: 13,
    color: '#15803D',
    fontWeight: '700',
    flex: 1,
    lineHeight: 18,
  },
});
