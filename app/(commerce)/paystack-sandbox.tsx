import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, C, Page } from "@/components/camporder/ui";
import { formatGhs } from "@/lib/camporder/format";

export default function PaystackSandboxScreen() {
  const params = useLocalSearchParams<{
    reference?: string;
    amount?: string;
    email?: string;
    callback_url?: string;
  }>();
  const router = useRouter();

  // Read params with web fallback
  let reference = typeof params.reference === "string" ? params.reference : "";
  let amountStr = typeof params.amount === "string" ? params.amount : "0";
  let email = typeof params.email === "string" ? params.email : "customer@campus.edu";
  let callbackUrl = typeof params.callback_url === "string" ? params.callback_url : "";

  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      const url = new URL(window.location.href);
      if (!reference) reference = url.searchParams.get("reference") || "";
      if (amountStr === "0") amountStr = url.searchParams.get("amount") || "0";
      if (email === "customer@campus.edu") email = url.searchParams.get("email") || email;
      if (!callbackUrl) callbackUrl = url.searchParams.get("callback_url") || "";
    } catch {}
  }

  const amountPesewas = parseInt(amountStr, 10) || 5000;
  const [tab, setTab] = useState<"momo" | "card">("momo");
  const [momoProvider, setMomoProvider] = useState<"mtn" | "vodafone" | "airteltigo">("mtn");
  const [phoneNumber, setPhoneNumber] = useState("055 123 4567");
  const [authCode, setAuthCode] = useState("123456");
  const [status, setStatus] = useState<"idle" | "authorizing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleAuthorize = () => {
    if (!authCode.trim()) {
      setErrorMessage("Please enter an authorization code or test OTP.");
      return;
    }
    setErrorMessage("");
    setStatus("authorizing");

    setTimeout(() => {
      setStatus("success");
      setTimeout(() => {
        // Complete the redirect to the callback URL or local payment screen
        let target = callbackUrl;
        if (!target) {
          target = Platform.OS === "web" && typeof window !== "undefined"
            ? `${window.location.origin}/payment`
            : "/(commerce)/payment";
        }
        const sep = target.includes("?") ? "&" : "?";
        const redirectUrl = `${target}${sep}reference=${encodeURIComponent(reference)}&trxref=${encodeURIComponent(reference)}`;

        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.location.assign(redirectUrl);
        } else {
          router.replace({ pathname: "/(commerce)/payment", params: { reference, trxref: reference } });
        }
      }, 1000);
    }, 1200);
  };

  const handleCancel = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      router.replace("/(tabs)/orders");
    } else {
      router.replace("/(tabs)/orders");
    }
  };

  return (
    <Page contentStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", paddingVertical: 24 }}>
      <View style={s.modalCard}>
        {/* Paystack Header */}
        <View style={s.header}>
          <View style={s.brandRow}>
            <View style={s.paystackLogo}>
              <Ionicons name="card" size={16} color="#0BA4DB" />
            </View>
            <View>
              <Text style={s.brandTitle}>paystack</Text>
              <Text style={s.testModeBadge}>TEST MODE</Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.amountLabel}>Pay</Text>
            <Text style={s.amountValue}>{formatGhs(amountPesewas)}</Text>
          </View>
        </View>

        {/* Merchant Info */}
        <View style={s.merchantBar}>
          <Ionicons name="shield-checkmark" size={14} color="#0D7048" />
          <Text style={s.merchantText}>CampOrder Ghana • {email}</Text>
        </View>

        {/* Tabs: MoMo / Card */}
        <View style={s.tabBar}>
          <Pressable
            onPress={() => setTab("momo")}
            style={[s.tabItem, tab === "momo" && s.tabItemActive]}
          >
            <Ionicons name="phone-portrait-outline" size={16} color={tab === "momo" ? "#0BA4DB" : "#6B7280"} />
            <Text style={[s.tabText, tab === "momo" && s.tabTextActive]}>Mobile Money</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("card")}
            style={[s.tabItem, tab === "card" && s.tabItemActive]}
          >
            <Ionicons name="card-outline" size={16} color={tab === "card" ? "#0BA4DB" : "#6B7280"} />
            <Text style={[s.tabText, tab === "card" && s.tabTextActive]}>Card</Text>
          </Pressable>
        </View>

        {/* Form Content */}
        {tab === "momo" ? (
          <View style={s.formSection}>
            {/* MoMo Provider Selector */}
            <Text style={s.fieldLabel}>Choose Network</Text>
            <View style={s.providerRow}>
              {(
                [
                  { id: "mtn", name: "MTN MoMo", color: "#EAB308" },
                  { id: "vodafone", name: "Telecel / Voda", color: "#EF4444" },
                  { id: "airteltigo", name: "AT Money", color: "#3B82F6" },
                ] as const
              ).map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setMomoProvider(p.id)}
                  style={[s.providerButton, momoProvider === p.id && { borderColor: p.color, backgroundColor: "#F8FAFC" }]}
                >
                  <View style={[s.providerDot, { backgroundColor: p.color }]} />
                  <Text style={[s.providerText, momoProvider === p.id && { fontWeight: "800", color: "#0F172A" }]}>
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.fieldLabel}>Mobile Number</Text>
            <View style={s.inputBox}>
              <Text style={s.prefix}>🇬🇭 +233</Text>
              <TextInput
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                style={s.input}
                placeholder="054 000 0000"
              />
            </View>

            <View style={s.promptBox}>
              <Ionicons name="information-circle-outline" size={18} color="#0284C7" />
              <Text style={s.promptText}>
                Paystack Prompt: Dial *170# or enter approval OTP / PIN code below to confirm payment.
              </Text>
            </View>

            <Text style={s.fieldLabel}>Authorization Code / OTP (Use 123456)</Text>
            <TextInput
              value={authCode}
              onChangeText={setAuthCode}
              keyboardType="number-pad"
              style={[s.inputBox, s.codeInput]}
              placeholder="123456"
              maxLength={8}
            />
          </View>
        ) : (
          <View style={s.formSection}>
            <Text style={s.fieldLabel}>Card Number (Paystack Test Card)</Text>
            <View style={s.inputBox}>
              <Ionicons name="card" size={18} color="#6B7280" />
              <TextInput
                value="4084 0840 8408 4084"
                editable={false}
                style={[s.input, { color: "#334155" }]}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Expiry</Text>
                <View style={s.inputBox}>
                  <TextInput value="12/28" editable={false} style={s.input} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>CVV</Text>
                <View style={s.inputBox}>
                  <TextInput value="408" editable={false} style={s.input} />
                </View>
              </View>
            </View>

            <Text style={s.fieldLabel}>Test 3D-Secure PIN / OTP (Use 123456)</Text>
            <TextInput
              value={authCode}
              onChangeText={setAuthCode}
              keyboardType="number-pad"
              style={[s.inputBox, s.codeInput]}
              placeholder="123456"
              maxLength={8}
            />
          </View>
        )}

        {errorMessage ? <Text style={s.errorText}>{errorMessage}</Text> : null}

        {/* State Indicator */}
        {status === "authorizing" ? (
          <View style={s.statusRow}>
            <ActivityIndicator color="#0BA4DB" size="small" />
            <Text style={s.statusText}>Connecting to Paystack & authorizing payment…</Text>
          </View>
        ) : status === "success" ? (
          <View style={[s.statusRow, { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" }]}>
            <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
            <Text style={[s.statusText, { color: "#15803D" }]}>Payment approved! Returning to CampOrder…</Text>
          </View>
        ) : null}

        {/* Action Buttons */}
        <Pressable
          onPress={handleAuthorize}
          disabled={status !== "idle"}
          style={[s.payButton, status !== "idle" && { opacity: 0.6 }]}
        >
          <Ionicons name="lock-closed" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={s.payButtonText}>Authorize {formatGhs(amountPesewas)}</Text>
        </Pressable>

        <Pressable onPress={handleCancel} disabled={status !== "idle"} style={s.cancelButton}>
          <Text style={s.cancelText}>Cancel and return to store</Text>
        </Pressable>

        {/* Footer */}
        <View style={s.footer}>
          <Ionicons name="lock-closed-outline" size={12} color="#94A3B8" />
          <Text style={s.footerText}>256-bit encryption • Secured by Paystack Payments</Text>
        </View>
      </View>
    </Page>
  );
}

const s = StyleSheet.create({
  modalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    padding: 22,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  paystackLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  testModeBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#D97706",
    letterSpacing: 0.5,
  },
  amountLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  amountValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  merchantBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  merchantText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  tabItemActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  tabTextActive: {
    color: "#0BA4DB",
  },
  formSection: {
    gap: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#334155",
  },
  providerRow: {
    flexDirection: "row",
    gap: 8,
  },
  providerButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  providerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  providerText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  prefix: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  codeInput: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 4,
    textAlign: "center",
    backgroundColor: "#F0F9FF",
    borderColor: "#BAE6FD",
  },
  promptBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0F9FF",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  promptText: {
    flex: 1,
    fontSize: 11,
    color: "#0369A1",
    lineHeight: 16,
    fontWeight: "600",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0F9FF",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0369A1",
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0BA4DB",
    height: 48,
    borderRadius: 12,
    marginTop: 4,
  },
  payButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
  },
  footerText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
  },
});
