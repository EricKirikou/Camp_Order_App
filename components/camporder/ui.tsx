import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { assetSource } from "@/lib/camporder/assets";
import { formatGhs } from "@/lib/camporder/format";

export const C = {
  green: "#0D7048",
  greenDark: "#075437",
  ivory: "#FFFDF8",
  ink: "#18231D",
  muted: "#738078",
  border: "#E4EBE5",
  sage: "#E9F1EB",
  mango: "#F4A34F",
  paleMango: "#FFF3E1",
  coral: "#D96C50",
  white: "#FFFFFF",
};

export function Page({ children, scroll = true, contentStyle, style }: { children: ReactNode; scroll?: boolean; contentStyle?: object; style?: object }) {
  if (!scroll) return <View style={[styles.page, style]}>{children}</View>;
  return <ScrollView style={[styles.page, style]} contentContainerStyle={[styles.pageContent, contentStyle]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}

export function BrandMark({ size = 42, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return <View style={styles.brandRow}>
    <View style={[styles.brandMark, { width: size, height: size, borderRadius: size * 0.32 }]}>
      <Ionicons name="storefront" size={size * 0.53} color={C.ivory} />
      <View style={[styles.brandDot, { width: size * 0.16, height: size * 0.16, borderRadius: size }]} />
    </View>
    {wordmark && <Text style={styles.brandName}>Camp<Text style={{ color: C.green }}>Order</Text></Text>}
  </View>;
}

export function Header({ title, subtitle, right, back, backFallback = "/(tabs)" }: { title: string; subtitle?: string; right?: ReactNode; back?: boolean; backFallback?: Href }) {
  const router = useRouter();
  return <View style={styles.header}>
    {back && <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace(backFallback)} style={styles.headerBack}><Ionicons name="arrow-back" size={22} color={C.ink} /></Pressable>}
    <View style={{ flex: 1 }}><Text style={styles.headerTitle}>{title}</Text>{subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}</View>
    {right}
  </View>;
}

export function CartIconButton({ count = 0, onPress, style }: { count?: number; onPress?: () => void; style?: object }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Cart with ${count} items`}
      onPress={onPress ?? (() => router.push("/(commerce)/cart"))}
      style={[styles.cartIconButton, style]}
    >
      <Ionicons name="bag-handle-outline" size={20} color={C.ink} />
      {count > 0 ? (
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Button({ title, onPress, variant = "primary", disabled = false, loading = false, icon, style }: {
  title: string; onPress: () => void; variant?: "primary" | "secondary" | "outline" | "quiet"; disabled?: boolean; loading?: boolean; icon?: keyof typeof Ionicons.glyphMap; style?: object;
}) {
  const color = variant === "primary" ? C.white : variant === "quiet" ? C.green : C.ink;
  const backgroundColor = variant === "primary" ? C.green : variant === "secondary" ? C.sage : "transparent";
  return <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor, borderColor: variant === "outline" ? C.border : "transparent", opacity: disabled ? 0.48 : pressed ? 0.86 : 1 }, style]}>
    {loading ? <ActivityIndicator color={variant === "primary" ? C.white : C.green} /> : <>
      {icon ? <Ionicons name={icon} size={18} color={color} style={{ marginRight: 8 }} /> : null}
      <Text style={[styles.buttonText, { color }]}>{title}</Text>
    </>}
  </Pressable>;
}

export function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize = "none", multiline, hint, ...props }: any) {
  return <View style={{ gap: 7 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#A0AAA3"
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
      style={[styles.input, multiline && { minHeight: 94, paddingTop: 13 }]}
      {...props}
    />
    {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
  </View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionTitle}>
    <Text style={styles.sectionText}>{title}</Text>
    {action ? <Pressable onPress={onAction} hitSlop={8}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}
  </View>;
}

export function Chip({ title, active, onPress, icon }: { title: string; active?: boolean; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    {icon ? <Ionicons name={icon} size={15} color={active ? C.white : C.green} style={{ marginRight: 5 }} /> : null}
    <Text style={[styles.chipText, active && { color: C.white }]}>{title}</Text>
  </Pressable>;
}

export function Notice({ children, tone = "sage" }: { children: ReactNode; tone?: "sage" | "mango" | "error" }) {
  const bg = tone === "mango" ? C.paleMango : tone === "error" ? "#FFF0EE" : C.sage;
  const fg = tone === "error" ? "#9F3B2E" : tone === "mango" ? "#87510B" : C.greenDark;
  return <View style={[styles.notice, { backgroundColor: bg }]}><Text style={[styles.noticeText, { color: fg }]}>{children}</Text></View>;
}

export function ProductCard({ product, onPress, onAdd }: { product: any; onPress?: () => void; onAdd?: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.productCard, { opacity: pressed ? 0.88 : 1 }]}>
    <View style={styles.productImageWrap}>
      {product.imageUrl ? <Image source={assetSource(product.imageUrl)} contentFit="cover" style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, styles.productFallback]}><Ionicons name={product.category === "drinks" ? "cafe-outline" : product.category === "stationery" ? "book-outline" : "fast-food-outline"} size={32} color={C.green} /></View>}
      {onAdd ? <Pressable onPress={(event) => { event.stopPropagation(); onAdd(); }} accessibilityRole="button" accessibilityLabel={`Add ${product.name}`} style={styles.addCircle}><Ionicons name="add" size={20} color={C.white} /></Pressable> : null}
    </View>
    <View style={styles.productInfo}>
      <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
      <Text style={styles.productDescription} numberOfLines={1}>{product.description || product.category}</Text>
      <Text style={styles.productPrice}>{formatGhs(product.pricePesewas)}</Text>
    </View>
  </Pressable>;
}

export function EmptyState({ icon = "basket-outline", title, copy, action, onAction }: { icon?: keyof typeof Ionicons.glyphMap; title: string; copy: string; action?: string; onAction?: () => void }) {
  return <View style={styles.emptyState}>
    <View style={styles.emptyIcon}><Ionicons name={icon} size={27} color={C.green} /></View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyCopy}>{copy}</Text>
    {action && onAction ? <Button title={action} variant="outline" onPress={onAction} style={{ marginTop: 14, alignSelf: "center" }} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.ivory },
  pageContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, gap: 20 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: { backgroundColor: C.green, justifyContent: "center", alignItems: "center", position: "relative" },
  brandDot: { position: "absolute", top: 8, right: 8, backgroundColor: C.mango, borderWidth: 1.5, borderColor: C.green },
  brandName: { fontSize: 22, fontWeight: "800", color: C.ink, letterSpacing: -0.8 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 47 },
  headerBack: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.white, alignItems: "center", justifyContent: "center", borderColor: C.border, borderWidth: 1 },
  headerTitle: { color: C.ink, fontWeight: "800", fontSize: 23, letterSpacing: -0.6 },
  headerSubtitle: { fontSize: 13, color: C.muted, marginTop: 4 },
  button: { minHeight: 52, borderRadius: 16, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1 },
  buttonText: { fontSize: 15, fontWeight: "700" },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: C.ink },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.white, color: C.ink, paddingHorizontal: 15, fontSize: 15 },
  fieldHint: { color: C.muted, fontSize: 12, lineHeight: 17 },
  sectionTitle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionText: { fontSize: 18, color: C.ink, fontWeight: "800", letterSpacing: -0.3 },
  sectionAction: { color: C.green, fontWeight: "700", fontSize: 13 },
  chip: { flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderWidth: 1, borderColor: C.border, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 100 },
  chipActive: { backgroundColor: C.green, borderColor: C.green },
  chipText: { color: C.ink, fontSize: 12, fontWeight: "700" },
  notice: { borderRadius: 13, padding: 12 },
  noticeText: { fontSize: 12, fontWeight: "600", lineHeight: 17 },
  productCard: { width: 174, backgroundColor: C.white, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  productImageWrap: { height: 132, backgroundColor: C.sage, position: "relative" },
  productFallback: { alignItems: "center", justifyContent: "center", backgroundColor: C.sage },
  addCircle: { position: "absolute", bottom: 9, right: 9, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: C.green },
  productInfo: { padding: 12, gap: 4 },
  productName: { color: C.ink, fontSize: 13, fontWeight: "800" },
  productDescription: { color: C.muted, fontSize: 11 },
  productPrice: { color: C.greenDark, fontSize: 14, fontWeight: "800", marginTop: 3 },
  emptyState: { padding: 28, alignItems: "center", backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  emptyIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: C.sage, alignItems: "center", justifyContent: "center", marginBottom: 11 },
  emptyTitle: { fontSize: 16, color: C.ink, fontWeight: "800", textAlign: "center" },
  emptyCopy: { fontSize: 13, lineHeight: 19, color: C.muted, textAlign: "center", marginTop: 6 },
  cartIconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    right: -4,
    top: -4,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.coral,
    borderWidth: 1.5,
    borderColor: C.white,
  },
  cartBadgeText: {
    color: C.white,
    fontSize: 9,
    fontWeight: "900",
  },
});
