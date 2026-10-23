import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { Button, C, EmptyState, Header, Notice, Page } from "@/components/camporder/ui";
import { useCampOrderUser } from "@/hooks/use-camporder-user";
import { SERVICE_STATUS_LABEL } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

export default function ServiceRequestsScreen() {
  const router = useRouter();
  const { user, loading } = useCampOrderUser();
  const requests = trpc.services.myRequests.useQuery(undefined, { enabled: Boolean(user), retry: false });
  return <Page>
    <Header title="My campus requests" back />
    {!user && !loading ? <EmptyState icon="clipboard-outline" title="Sign in to see your requests" copy="Your errands and service bookings are linked to your account." action="Sign in" onAction={() => router.push("/(auth)/login")} /> : null}
    {requests.isLoading ? <Text style={{ color: C.muted }}>Loading your campus requests…</Text> : null}
    {requests.isError ? <Notice tone="error">Your saved requests couldn&apos;t be loaded.</Notice> : null}
    {user && requests.data && !requests.data.errands.length && !requests.data.bookings.length ? <EmptyState icon="sparkles-outline" title="No campus requests yet" copy="Create an errand or book a service when you are ready." action="Explore services" onAction={() => router.push("/(services)")} /> : null}
    {requests.data?.errands.map((item) => <View key={`errand-${item.id}`} style={{ padding: 15, backgroundColor: C.white, borderRadius: 17, borderWidth: 1, borderColor: C.border, gap: 6 }}><Text style={{ color: C.ink, fontWeight: "800" }}>{item.title}</Text><Text style={{ color: C.green, fontSize: 12, fontWeight: "800" }}>{SERVICE_STATUS_LABEL[item.status] ?? item.status}</Text><Text style={{ color: C.muted, fontSize: 12 }}>{item.details}</Text><Button title="View request" variant="quiet" onPress={() => router.push({ pathname: "/(services)/errand/[id]", params: { id: String(item.id) } })} /></View>)}
    {requests.data?.bookings.map(({ booking, service }) => <View key={`booking-${booking.id}`} style={{ padding: 15, backgroundColor: C.white, borderRadius: 17, borderWidth: 1, borderColor: C.border, gap: 6 }}><Text style={{ color: C.ink, fontWeight: "800" }}>{service.name}</Text><Text style={{ color: C.green, fontSize: 12, fontWeight: "800" }}>{SERVICE_STATUS_LABEL[booking.status] ?? booking.status}</Text><Text style={{ color: C.muted, fontSize: 12 }}>{new Date(booking.requestedAt).toLocaleString("en-GH")}</Text><Button title="View request" variant="quiet" onPress={() => router.push({ pathname: "/(services)/confirmation", params: { id: String(booking.id), serviceName: service.name } })} /></View>)}
    <Button title="Create errand" variant="outline" onPress={() => router.push("/(services)/errand")} />
  </Page>;
}
