import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, C, Header, Notice, Page } from '@/components/camporder/ui';
import { trpc } from '@/lib/trpc';

// Define the shape of a pending order for the rider
type PendingOrder = {
  id: number;
  restaurantName: string;
  dropoffAddress: string;
  payout: number; // amount in pesewas
  createdAt: string;
};

export default function RiderDashboard() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [loadingId, setLoadingId] = useState<number | null>(null);

  // Fetch pending orders that are available for a rider to accept.
  // This assumes a backend endpoint `rider.pendingOrders` exists.
  const { data: pendingOrders, isLoading, error } = trpc.rider.pendingOrders.useQuery();

  const acceptOrder = trpc.rider.acceptOrder.useMutation({
    onSuccess: (order) => {
      // Invalidate any cached order lists so the UI stays fresh.
      utils.rider.pendingOrders.invalidate();
      // Navigate directly to the order tracking screen.
      router.push(`/order/${order.id}`);
    },
    onError: (e) => {
      alert('Could not accept order. It may have been taken by someone else.');
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

  if (isLoading) {
    return (
      <Page>
        <Header title="Rider Dashboard" back={false} />
        <ActivityIndicator size="large" color={C.sage} style={{ marginTop: 30 }} />
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <Header title="Rider Dashboard" back={false} />
        <Notice tone="error">Failed to load orders. Please try again later.</Notice>
      </Page>
    );
  }

  if (!pendingOrders?.length) {
    return (
      <Page>
        <Header title="Rider Dashboard" back={false} />
        <Notice tone="mango">No new orders at the moment. Pull down to refresh.</Notice>
      </Page>
    );
  }

  return (
    <Page>
      <Header title="Rider Dashboard" back={false} />
      <FlatList
        data={pendingOrders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.restaurantName}</Text>
            <Text style={styles.sub}>Drop‑off: {item.dropoffAddress}</Text>
            <Text style={styles.payout}>Payout: {formatCurrency(item.payout)}</Text>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAccept(item.id)}
              disabled={loadingId === item.id}
            >
              {loadingId === item.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Accept Order</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={{ padding: 16 }}
      />
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
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 4, color: C.ink },
  sub: { fontSize: 14, color: C.muted, marginBottom: 6 },
  payout: { fontSize: 16, fontWeight: '700', color: C.sage, marginBottom: 10 },
  acceptButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
