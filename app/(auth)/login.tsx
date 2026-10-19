import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { BrandMark, Button, C, Field, Header, Notice, Page } from "@/components/camporder/ui";
import { friendlyError } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";
import { saveOtpResendToken } from "@/lib/camporder/otp-token";

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const login = trpc.auth.startLogin.useMutation();

  const submit = async () => {
    setError("");
    try {
      const result = await login.mutateAsync({ phone, password });
      await saveOtpResendToken(result.challengeId, result.resendToken);
      router.push({ pathname: "/(auth)/otp", params: { challengeId: String(result.challengeId), phone: result.maskedPhone, purpose: "login" } });
    } catch (err) {
      setError(friendlyError(err, "We couldn't sign you in."));
    }
  };

  return <Page>
    <Header title="Sign in" back right={<BrandMark size={34} wordmark={false} />} />
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ gap: 20 }}>
      <View style={{ gap: 10, marginTop: 13 }}>
        <Text style={{ fontSize: 30, lineHeight: 36, fontWeight: "900", letterSpacing: -1.1, color: C.ink }}>Campus, sorted.</Text>
        <Text style={{ fontSize: 15, lineHeight: 22, color: C.muted }}>Sign in to shop, place orders and book helpful campus services.</Text>
      </View>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <View style={{ gap: 16 }}>
        <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="024 123 4567" keyboardType="phone-pad" autoCapitalize="none" hint="Use your Ghana number or include the country code." />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry autoCapitalize="none" />
      </View>
      <Pressable onPress={() => router.push("/(auth)/signup")} style={{ alignSelf: "flex-end" }}><Text style={{ color: C.green, fontWeight: "700", fontSize: 13 }}>Create an account</Text></Pressable>
      <Button title="Continue with SMS code" icon="chatbubble-ellipses-outline" onPress={() => void submit()} loading={login.isPending} disabled={!phone.trim() || !password} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: -5 }}><Ionicons name="shield-checkmark-outline" size={15} color={C.green} /><Text style={{ color: C.muted, fontSize: 12 }}>We verify your phone before signing you in.</Text></View>
      <Text style={{ color: C.muted, textAlign: "center", fontSize: 12, lineHeight: 18 }}>By continuing, you agree to use CampOrder responsibly. SMS delivery depends on provider coverage and sender approval.</Text>
    </KeyboardAvoidingView>
  </Page>;
}
