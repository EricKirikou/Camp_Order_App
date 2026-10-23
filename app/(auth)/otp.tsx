import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Keyboard, Text, View } from "react-native";
import { Button, C, Field, Header, Notice, Page } from "@/components/camporder/ui";
import { friendlyError } from "@/lib/camporder/format";
import * as Auth from "@/lib/_core/auth";
import { getOtpResendToken, removeOtpResendToken, saveOtpResendToken } from "@/lib/camporder/otp-token";
import { trpc } from "@/lib/trpc";

export default function OtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ challengeId: string; phone: string; purpose: string }>();
  const challengeId = Number(params.challengeId);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendNote, setResendNote] = useState("");
  const [countdown, setCountdown] = useState({ challengeId, secondsLeft: 60 });
  const secondsLeft = countdown.challengeId === challengeId ? countdown.secondsLeft : 60;
  const utils = trpc.useUtils();
  const verify = trpc.auth.verifyOtp.useMutation();
  const resend = trpc.auth.resendOtp.useMutation();

  useEffect(() => {
    const timer = setInterval(() => setCountdown((current) => ({
      challengeId,
      secondsLeft: current.challengeId === challengeId ? Math.max(0, current.secondsLeft - 1) : 59,
    })), 1000);
    return () => clearInterval(timer);
  }, [challengeId]);

  const submit = async () => {
    Keyboard.dismiss();
    setError("");
    try {
      const result = await verify.mutateAsync({ challengeId, code });
      if (result.sessionToken) await Auth.setSessionToken(result.sessionToken);
      if (result.user) await Auth.setUserInfo(result.user);
      await removeOtpResendToken(challengeId);
      await utils.auth.me.invalidate();
      router.replace("/(auth)/campus");
    } catch (err) {
      setError(friendlyError(err, "That code couldn't be verified."));
    }
  };

  const requestAnother = async () => {
    setError(""); setResendNote("");
    const resendToken = await getOtpResendToken(challengeId);
    if (!resendToken) { setError("This verification request can't be resumed. Start again from sign in."); return; }
    try {
      const next = await resend.mutateAsync({ challengeId, resendToken });
      await removeOtpResendToken(challengeId);
      await saveOtpResendToken(next.challengeId, next.resendToken);
      setCode("");
      setResendNote("A new code was requested. Check your SMS messages.");
      router.replace({ pathname: "/(auth)/otp", params: { challengeId: String(next.challengeId), phone: next.maskedPhone, purpose: params.purpose ?? "login" } });
    } catch (err) { setError(friendlyError(err, "We couldn't request a new code.")); }
  };

  return <Page>
    <Header title="Verify your phone" back />
    <View style={{ gap: 19, marginTop: 8 }}>
      <View style={{ width: 64, height: 64, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: C.sage }}><Text style={{ fontSize: 28 }}>✉</Text></View>
      <View style={{ gap: 8 }}><Text style={{ color: C.ink, fontWeight: "900", fontSize: 28, letterSpacing: -0.8 }}>One quick check</Text><Text style={{ color: C.muted, fontSize: 14, lineHeight: 21 }}>Enter the 6-digit code sent to {params.phone || "your phone"}. It expires after 5 minutes.</Text></View>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {resendNote ? <Notice>{resendNote}</Notice> : null}
      <Field label="Verification code" value={code} onChangeText={(value: string) => setCode(value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" keyboardType="number-pad" maxLength={6} autoCapitalize="none" />
      <Button title="Verify & continue" onPress={() => void submit()} loading={verify.isPending} disabled={code.length !== 6} />
      <Button title={secondsLeft > 0 ? `Send another code in ${secondsLeft}s` : "Resend SMS code"} variant="outline" icon="refresh-outline" onPress={() => void requestAnother()} loading={resend.isPending} disabled={secondsLeft > 0} />
      <Text style={{ color: C.muted, textAlign: "center", fontSize: 12, lineHeight: 18 }}>Codes are limited to five requests per phone per hour. SMS delivery depends on Africa&apos;s Talking coverage and Ghana sender approval.</Text>
    </View>
  </Page>;
}
