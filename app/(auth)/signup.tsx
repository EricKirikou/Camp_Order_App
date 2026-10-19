import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Button, C, Field, Header, Notice, Page } from "@/components/camporder/ui";
import { friendlyError } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";
import { saveOtpResendToken } from "@/lib/camporder/otp-token";

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const signup = trpc.auth.startSignup.useMutation();

  const submit = async () => {
    setError("");
    try {
      const result = await signup.mutateAsync({ name, phone, email, password });
      await saveOtpResendToken(result.challengeId, result.resendToken);
      router.push({ pathname: "/(auth)/otp", params: { challengeId: String(result.challengeId), phone: result.maskedPhone, purpose: "signup" } });
    } catch (err) {
      setError(friendlyError(err, "We couldn't create your account."));
    }
  };

  return <Page>
    <Header title="Create account" back />
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ gap: 18 }}>
      <View style={{ gap: 8, marginTop: 6 }}><Text style={{ fontSize: 28, fontWeight: "900", color: C.ink, letterSpacing: -0.8 }}>Join your campus</Text><Text style={{ color: C.muted, fontSize: 14, lineHeight: 20 }}>One account for food, everyday essentials and campus services.</Text></View>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <View style={{ gap: 14 }}>
        <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Ama Mensah" autoCapitalize="words" />
        <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="024 123 4567" keyboardType="phone-pad" hint="We'll send a one-time verification code." />
        <Field label="Email (for checkout)" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry hint="Use at least 8 characters." />
      </View>
      <Button title="Create account & verify" onPress={() => void submit()} loading={signup.isPending} disabled={name.trim().length < 2 || phone.trim().length < 8 || password.length < 8} />
      <Text style={{ color: C.muted, fontSize: 12, textAlign: "center", lineHeight: 18 }}>Your phone number is verified with a one-time code. SMS may take a moment to arrive.</Text>
    </KeyboardAvoidingView>
  </Page>;
}
