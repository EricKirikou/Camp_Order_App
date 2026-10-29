import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

  const handleAccept = async (orderId: number) => {
    setLoadingId(orderId);
    try {
      await acceptOrder.mutateAsync({ orderId });
    } finally {
      setLoadingId(null);
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

  return (
    <Page scroll={false}>
      <Header title="Rider Dashboard" subtitle="Campus courier dispatches" back />

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
              const isUnaccepted = item.status === "placed";
              return (
                <View style={[styles.card, isUnaccepted && styles.cardHighlight]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.title} numberOfLines={1}>{item.restaurantName}</Text>
                    <View style={[styles.statusTag, { backgroundColor: isUnaccepted ? '#FEF3C7' : '#DCFCE7' }]}>
                      <Text style={[styles.statusTagText, { color: isUnaccepted ? '#B45309' : '#15803D' }]}>
                        {isUnaccepted ? 'UNACCEPTED' : 'ACCEPTED'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="location-outline" size={16} color={C.muted} />
                    <Text style={styles.sub} numberOfLines={2}>Drop‑off: {item.dropoffAddress}</Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.payout}>Payout: {formatCurrency(item.payout)}</Text>
                    <TouchableOpacity
                      style={[styles.acceptButton, isUnaccepted ? styles.acceptButtonPrimary : styles.acceptButtonSecondary]}
                      onPress={() => handleAccept(item.id)}
                      disabled={loadingId === item.id}
                    >
                      {loadingId === item.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.buttonText}>
                          {isUnaccepted ? "Accept Order" : "View Order"}
                        </Text>
                      )}
                    </TouchableOpacity>
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
});
