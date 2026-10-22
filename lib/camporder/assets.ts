import Constants from "expo-constants";
import { Platform, type ImageSourcePropType } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";

export const ASSET_PATHS = {
  appIcon: require("../../assets/images/icon.png"),
    favicon: require("../../assets/images/favicon-48.png"),
  campusDelivery: require("../../assets/images/campus-delivery.jpg"),
  campus: require("../../assets/images/campus.jpg"),
  campusCommunity: require("../../assets/images/campus-community.jpg"),
  jollof: require("../../assets/images/meal.jpg"),
  sobolo: require("../../assets/images/drink.jpg"),
  essentials: require("../../assets/images/essentials.jpg"),
} as const;

const legacyImageAssets: Record<string, ImageSourcePropType> = {
  "image-2.webp": ASSET_PATHS.campusDelivery,
  "image-3.webp": ASSET_PATHS.jollof,
  "image-4.webp": ASSET_PATHS.sobolo,
  "image-5.webp": ASSET_PATHS.essentials,
};

/** Load managed media from the API storage proxy, not the Metro origin. */
export function assetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const apiBaseUrl = getApiBaseUrl();
  if (apiBaseUrl) return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  if (Platform.OS === "web") return path;
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  const previewBase = extra.previewBaseUrl?.replace(/\/$/, "");
  return previewBase ? `${previewBase}${path}` : path;
}

export function assetSource(path: string | ImageSourcePropType | null | undefined): ImageSourcePropType | undefined {
  if (typeof path === "number" || (typeof path === "object" && path !== null)) return path;
  if (!path) return undefined;
  const legacyFilename = path.split("/").pop()?.split("?")[0];
  const bundledAsset = legacyFilename ? legacyImageAssets[legacyFilename] : undefined;
  return bundledAsset ?? { uri: assetUrl(path) };
}
