import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, C, Field, Header, Notice, Page } from "@/components/camporder/ui";
import { useCampOrderUser } from "@/hooks/use-camporder-user";
import { useSelectedCampus } from "@/hooks/use-selected-campus";
import { formatGhs, friendlyError, serviceDisplayName } from "@/lib/camporder/format";
import { createFutureBookingTime, isFutureBookingTime } from "@/lib/camporder/time";
import { trpc } from "@/lib/trpc";

export default function BookServiceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const serviceId = Number(id);
  const { user } = useCampOrderUser();
  const selected = useSelectedCampus();
  const service = trpc.services.list.useQuery();
  const campuses = trpc.catalog.campuses.useQuery();
  const book = trpc.services.book.useMutation();
  const current = service.data?.find((item) => item.id === serviceId);
  const [requestedAt, setRequestedAt] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const campusId = selected.campus?.id ?? campuses.data?.[0]?.id;
  const serviceName = current ? serviceDisplayName(current.slug, current.name) : "Campus service";

  const submit = async () => {
    if (!user) { router.push("/(auth)/login"); return; }
    if (!campusId) { setError("Choose a campus first."); return; }
    if (!requestedAt || !isFutureBookingTime(requestedAt)) {
      setError("Choose a valid date and time in the future."); return;
    }
    setError("");
    try {
      const result = await book.mutateAsync({ serviceId, campusId, requestedAt: new Date(requestedAt).toISOString(), details: details || undefined });
      router.push({ pathname: "/(services)/confirmation", params: { id: String(result.id), serviceName } });
    } catch (err) { setError(friendlyError(err, "Could not save your request.")); }
  };

  return <Page>
    <Header title={serviceName} subtitle="Campus service request" back />
    <View style={{ borderRadius: 21, backgroundColor: C.green, padding: 18, gap: 12 }}><View style={{ width: 45, height: 45, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}><Ionicons name="calendar-outline" size={22} color={C.white} /></View><Text style={{ color: C.white, fontSize: 22, fontWeight: "900" }}>{serviceName}</Text><Text style={{ color: "#D8EDE1", fontSize: 13, lineHeight: 19 }}>{current?.description ?? "Choose a time to request this service."}</Text>{current ? <Text style={{ color: C.white, fontWeight: "900" }}>Sample price from {formatGhs(current.startingPricePesewas)}</Text> : null}</View>
    {!user ? <Notice tone="mango">Sign in is required to save this service request.</Notice> : null}
    {error ? <Notice tone="error">{error}</Notice> : null}
    <Field label="Requested date & time (UTC)" value={requestedAt} onChangeText={setRequestedAt} placeholder="2026-10-20T14:30:00.000Z" autoCapitalize="none" hint="Choose a quick time below or enter a future ISO date-time." />
    <View style={{ flexDirection: "row", gap: 8 }}>{[1, 3, 24].map((hours) => <Pressable key={hours} onPress={() => setRequestedAt(createFutureBookingTime(hours))} style={{ flex: 1, paddingVertical: 11, backgroundColor: C.sage, borderRadius: 12, alignItems: "center" }}><Text style={{ color: C.green, fontWeight: "800", fontSize: 12 }}>{hours === 24 ? "Tomorrow" : `In ${hours} hour${hours > 1 ? "s" : ""}`}</Text></Pressable>)}</View>
    <Field label="Details for the provider (optional)" value={details} onChangeText={setDetails} placeholder="Location, service preference or notes" multiline autoCapitalize="sentences" />
    {campusId ? <Notice>Campus: {selected.campus?.name ?? campuses.data?.find((item) => item.id === campusId)?.name}</Notice> : <Button title="Choose campus" variant="outline" onPress={() => router.push("/(auth)/campus")} />}
    <Notice tone="mango">Your request will wait for a campus provider to confirm. Sample listings do not guarantee live availability.</Notice>
    <Button title="Send booking request" icon="calendar-outline" onPress={() => void submit()} loading={book.isPending} disabled={!current || !requestedAt || !Number.isFinite(new Date(requestedAt).getTime())} />
  </Page>;
}
