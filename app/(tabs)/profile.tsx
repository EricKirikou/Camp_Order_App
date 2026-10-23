import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, C, Notice, Page } from "@/components/camporder/ui";
import { useCampOrderUser } from "@/hooks/use-camporder-user";
import { useSelectedCampus } from "@/hooks/use-selected-campus";
import * as Auth from "@/lib/_core/auth";
import { getApiBaseUrl } from "@/constants/oauth";
import { trpc } from "@/lib/trpc";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading, refresh } = useCampOrderUser();
  const selected = useSelectedCampus();
  const utils = trpc.useUtils();
  const [showSignoutModal, setShowSignoutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const logout = trpc.auth.logout.useMutation();

  const handleConfirmLogout = async () => {
    setSigningOut(true);
    try {
      // 1. Call tRPC server logout procedure
      await logout.mutateAsync().catch(() => {});
      // 2. Call backend logout route directly to clear cookies on web
      if (Platform.OS === "web") {
        try {
          const baseUrl = getApiBaseUrl();
          await fetch(`${baseUrl}/api/auth/logout`, {
            method: "POST",
            credentials: "include",
          });
        } catch {}
      }
      // 3. Clear client token & cached user info
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      // 4. Invalidate and reset cached query data
      utils.auth.me.setData(undefined, null as never);
      utils.auth.me.reset();
      await utils.invalidate();
      
      setShowSignoutModal(false);
      setSigningOut(false);

      // 5. Instantly navigate back to login without requiring manual page refresh
      if (Platform.OS === "web") {
        window.location.href = "/login";
      } else {
        router.replace("/(auth)/login");
      }
    } catch {
      setSigningOut(false);
      setShowSignoutModal(false);
    }
  };

  return (
    <Page>
      <Text style={{ color: C.ink, fontSize: 28, fontWeight: "900", letterSpacing: -0.8 }}>Profile</Text>
      {user ? (
        <>
          <View style={{ backgroundColor: C.green, borderRadius: 22, padding: 20, gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.white, fontSize: 22, fontWeight: "900" }}>{user.name?.slice(0, 1).toUpperCase() ?? "C"}</Text>
            </View>
            <View style={{ gap: 4 }}>
              <Text style={{ color: C.white, fontSize: 19, fontWeight: "900" }}>{user.name ?? "CampOrder student"}</Text>
              <Text style={{ color: "#D9EEE2", fontSize: 13 }}>{user.phoneNumber || user.email}</Text>
              {user.phoneVerified ? (
                <Text style={{ color: "#D9EEE2", fontSize: 11, fontWeight: "700" }}>
                  ✓ Verified{user.role === "admin" ? " · Administrator" : user.role === "vendor" ? " · Store Vendor" : user.role === "courier" ? " · Campus Courier" : user.role === "moderator" ? " · Moderator" : " · Student"}
                </Text>
              ) : null}
            </View>
          </View>
          <Pressable
            onPress={() => router.push("/(auth)/campus")}
            style={{ borderRadius: 17, padding: 15, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="location-outline" color={C.green} size={19} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: C.ink, fontWeight: "800" }}>My campus</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>{selected.campus?.name ?? "Choose your campus"}</Text>
            </View>
            <Ionicons name="chevron-forward" color={C.muted} size={18} />
          </Pressable>
          <Button title="My orders" variant="outline" icon="receipt-outline" onPress={() => router.push("/(tabs)/orders")} />
          <Button title="Campus errands & services" variant="outline" icon="sparkles-outline" onPress={() => router.push("/(services)")} />
          {user.role === "admin" || user.role === "moderator" ? <Button title="Admin console" variant="outline" icon="settings-outline" onPress={() => router.push("/admin")} /> : null}
          <Button title="Sign out" variant="quiet" onPress={() => setShowSignoutModal(true)} />
        </>
      ) : loading ? (
        <Text style={{ color: C.muted }}>Checking your account…</Text>
      ) : (
        <>
          <View style={{ alignItems: "center", gap: 9, paddingVertical: 16 }}>
            <View style={{ width: 76, height: 76, borderRadius: 27, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="person-outline" size={32} color={C.green} />
            </View>
            <Text style={{ color: C.ink, fontSize: 18, fontWeight: "900" }}>Make campus life easier</Text>
            <Text style={{ color: C.muted, fontSize: 13, textAlign: "center", lineHeight: 19 }}>Sign in with your phone or email to keep orders and bookings together.</Text>
          </View>
          <Button title="Sign in" onPress={() => router.push("/(auth)/login")} />
          <Button title="Create an account" variant="outline" onPress={() => router.push("/(auth)/signup")} />
          <Pressable
            onPress={() => router.push("/(auth)/campus")}
            style={{ padding: 14, backgroundColor: C.white, borderRadius: 15, borderWidth: 1, borderColor: C.border, flexDirection: "row", gap: 10, alignItems: "center" }}
          >
            <Ionicons name="school-outline" color={C.green} size={20} />
            <Text style={{ color: C.ink, fontWeight: "700" }}>Choose your campus</Text>
          </Pressable>
        </>
      )}

      {/* Sign Out Confirmation Modal Popup */}
      <Modal
        visible={showSignoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!signingOut) setShowSignoutModal(false);
        }}
      >
        <View style={modalStyles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!signingOut) setShowSignoutModal(false);
            }}
          />
          <View style={modalStyles.card}>
            <View style={modalStyles.iconWrap}>
              <Ionicons name="log-out-outline" size={26} color={C.coral} />
            </View>
            <Text style={modalStyles.title}>Sign out?</Text>
            <Text style={modalStyles.message}>
              Are you sure you want to sign out of CampOrder? You will need to sign back in to access your orders and account.
            </Text>
            <View style={modalStyles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={signingOut}
                onPress={() => setShowSignoutModal(false)}
                style={[modalStyles.cancelBtn, { opacity: signingOut ? 0.5 : 1 }]}
              >
                <Text style={modalStyles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={signingOut}
                onPress={() => void handleConfirmLogout()}
                style={[modalStyles.logoutBtn, { opacity: signingOut ? 0.7 : 1 }]}
              >
                {signingOut ? (
                  <ActivityIndicator color={C.white} size="small" />
                ) : (
                  <Text style={modalStyles.logoutText}>Sign out</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Page>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: C.white,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FDF2EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    color: C.ink,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  message: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: C.sage,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  logoutBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: C.coral,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: C.white,
    fontSize: 14,
    fontWeight: "800",
  },
});
