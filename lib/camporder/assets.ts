import Constants from "expo-constants";
import { Platform } from "react-native";

export const ASSET_PATHS = {
  appIcon: "/manus-storage/async-images/p1ku05FZk2C3CZ929wSiYe/image-1.webp",
  campusDelivery: "/manus-storage/async-images/p1ku05FZk2C3CZ929wSiYe/image-2.webp",
  jollof: "/manus-storage/async-images/p1ku05FZk2C3CZ929wSiYe/image-3.webp",
  sobolo: "/manus-storage/async-images/p1ku05FZk2C3CZ929wSiYe/image-4.webp",
  essentials: "/manus-storage/async-images/p1ku05FZk2C3CZ929wSiYe/image-5.webp",
} as const;

/** Keep generated media on the platform's stable asset route, not a temporary signed URL. */
export function assetUrl(path: string): string {
  if (Platform.OS === "web") return path;
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  const previewBase = extra.previewBaseUrl?.replace(/\/$/, "");
  return previewBase ? `${previewBase}${path}` : path;
}
