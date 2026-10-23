import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, C, Field, Header, Notice, Page } from "@/components/camporder/ui";
import { friendlyError } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";
import { saveOtpResendToken } from "@/lib/camporder/otp-token";

type RoleOption = "user" | "vendor" | "courier";

const ROLES: Array<{
  id: RoleOption;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}> = [
  {
    id: "user",
    title: "Customer",
    subtitle: "Order food & campus essentials",
    icon: "person-outline",
    color: C.green,
  },
  {
    id: "vendor",
    title: "Store Vendor",
    subtitle: "List products & manage orders",
    icon: "storefront-outline",
    color: "#D97706",
  },
  {
    id: "courier",
    title: "Courier / Rider",
    subtitle: "Deliver orders & earn on campus",
    icon: "bicycle-outline",
    color: "#0284C7",
  },
];

export default function SignupScreen() {
  const router = useRouter();
  const [role, setRole] = useState<RoleOption>("user");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const signup = trpc.auth.startSignup.useMutation();

  const submit = async () => {
    setError("");
    try {
      const result = await signup.mutateAsync({ name, phone, email, password, role });
      await saveOtpResendToken(result.challengeId, result.resendToken);
      router.push({
        pathname: "/(auth)/otp",
        params: {
          challengeId: String(result.challengeId),
          phone: result.maskedPhone,
          purpose: "signup",
          ...(result.sandboxCode ? { sandboxCode: result.sandboxCode } : {}),
        },
      });
    } catch (err) {
      setError(friendlyError(err, "We couldn't create your account."));
    }
  };

  return <Page>
    <Header title="Create account" back />
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ gap: 18 }}>
      <View style={{ gap: 6, marginTop: 4 }}>
        <Text style={{ fontSize: 28, fontWeight: "900", color: C.ink, letterSpacing: -0.8 }}>Join your campus</Text>
        <Text style={{ color: C.muted, fontSize: 14, lineHeight: 20 }}>Select how you want to participate on CampOrder.</Text>
      </View>

      {/* Role Selection */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: C.ink, fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Sign up as
        </Text>
        <View style={s.rolesContainer}>
          {ROLES.map((r) => {
            const active = role === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => setRole(r.id)}
                style={[s.roleCard, active && { borderColor: r.color, backgroundColor: active ? "#F8FAFC" : "#FFFFFF" }]}
              >
                <View style={[s.roleIconWrap, { backgroundColor: active ? r.color : "#F1F5F9" }]}>
                  <Ionicons name={r.icon} size={18} color={active ? "#FFFFFF" : "#64748B"} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={[s.roleTitle, active && { color: C.ink, fontWeight: "900" }]}>{r.title}</Text>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={18} color={r.color} />
                    ) : (
                      <View style={s.unselectedDot} />
                    )}
                  </View>
                  <Text style={s.roleSubtitle}>{r.subtitle}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <View style={{ gap: 14 }}>
        <Field label={role === "vendor" ? "Store or Vendor name" : "Your full name"} value={name} onChangeText={setName} placeholder={role === "vendor" ? "e.g. Asanka Kitchen" : "e.g. Ama Mensah"} autoCapitalize="words" />
        <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="024 123 4567" keyboardType="phone-pad" hint="We'll send a one-time verification code." />
        <Field label="Email address" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry hint="Use at least 8 characters." />
      </View>

      <Button
        title={`Create ${role === "vendor" ? "Vendor" : role === "courier" ? "Courier" : "Customer"} Account`}
        onPress={() => void submit()}
        loading={signup.isPending}
        disabled={name.trim().length < 2 || phone.trim().length < 8 || password.length < 8}
      />
      <Text style={{ color: C.muted, fontSize: 12, textAlign: "center", lineHeight: 18 }}>Your phone number is verified with a one-time code. SMS may take a moment to arrive.</Text>
    </KeyboardAvoidingView>
  </Page>;
}

const s = StyleSheet.create({
  rolesContainer: {
    gap: 8,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    gap: 12,
  },
  roleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },
  roleSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  unselectedDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },
});
