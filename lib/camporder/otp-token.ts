import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const key = (challengeId: number) => `camporder.otp-resend.${challengeId}`;

export async function saveOtpResendToken(challengeId: number, token: string) {
  if (Platform.OS === "web") {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key(challengeId), token);
    return;
  }
  await SecureStore.setItemAsync(key(challengeId), token);
}

export async function getOtpResendToken(challengeId: number): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key(challengeId)) : null;
  }
  return SecureStore.getItemAsync(key(challengeId));
}

export async function removeOtpResendToken(challengeId: number) {
  if (Platform.OS === "web") {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key(challengeId));
    return;
  }
  await SecureStore.deleteItemAsync(key(challengeId));
}
