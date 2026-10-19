import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button, C, Field, Header, Notice, Page } from "@/components/camporder/ui";
import { useCampOrderUser } from "@/hooks/use-camporder-user";
import { useSelectedCampus } from "@/hooks/use-selected-campus";
import { friendlyError } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

export default function CreateErrandScreen() {
  const router = useRouter();
  const { user } = useCampOrderUser();
  const selected = useSelectedCampus();
  const campuses = trpc.catalog.campuses.useQuery();
  const create = trpc.services.createErrand.useMutation();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [error, setError] = useState("");
  const campusId = selected.campus?.id ?? campuses.data?.[0]?.id;

  const submit = async () => {
    if (!user) { router.push("/(auth)/login"); return; }
    if (!campusId) { setError("Choose an available campus first."); return; }
    setError("");
    try {
      const result = await create.mutateAsync({ campusId, title, details, pickupLocation: pickupLocation || undefined, dropoffLocation: dropoffLocation || undefined });
      router.push({ pathname: "/(services)/errand/[id]", params: { id: String(result.id) } });
    } catch (err) { setError(friendlyError(err)); }
  };

  return <Page>
    <Header title="Create an errand" subtitle="Tell us what you need" back />
    <View style={{ gap: 8 }}><Text style={{ color: C.ink, fontSize: 26, fontWeight: "900", letterSpacing: -0.7 }}>One less thing to do.</Text><Text style={{ color: C.muted, fontSize: 13, lineHeight: 19 }}>Describe the task clearly. Your request will be saved as awaiting a campus partner.</Text></View>
    {!user ? <Notice tone="mango">Sign in is required to save this errand request.</Notice> : null}
    {error ? <Notice tone="error">{error}</Notice> : null}
    <View style={{ gap: 14 }}>
      <Field label="What needs doing?" value={title} onChangeText={setTitle} placeholder="e.g. Pick up a parcel" autoCapitalize="sentences" />
      <Field label="A few more details" value={details} onChangeText={setDetails} placeholder="Include timing, instructions or anything useful." multiline autoCapitalize="sentences" />
      <Field label="Pickup point (optional)" value={pickupLocation} onChangeText={setPickupLocation} placeholder="Hall, office, or landmark" autoCapitalize="sentences" />
      <Field label="Drop-off point (optional)" value={dropoffLocation} onChangeText={setDropoffLocation} placeholder="Where should it go?" autoCapitalize="sentences" />
    </View>
    {campusId ? <Notice>Campus: {selected.campus?.name ?? campuses.data?.find((campus) => campus.id === campusId)?.name ?? "Selected campus"}</Notice> : <Button title="Choose a campus" variant="outline" onPress={() => router.push("/(auth)/campus")} />}
    <Notice tone="mango">The request is saved but not assigned. No runner is available until a real campus partner is connected.</Notice>
    <Button title="Review errand request" onPress={() => void submit()} loading={create.isPending} disabled={!title.trim() || details.trim().length < 8} />
  </Page>;
}
