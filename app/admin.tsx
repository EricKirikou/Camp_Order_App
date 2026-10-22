import { useState } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { Button, C, Field, Header, Notice, Page } from "@/components/camporder/ui";
import { friendlyError } from "@/lib/camporder/format";
import { trpc } from "@/lib/trpc";

type Section = "campuses" | "vendors" | "products" | "services";
type Draft = Record<string, string>;

const SECTIONS: Array<{ key: Section; label: string }> = [
  { key: "campuses", label: "Campuses" },
  { key: "vendors", label: "Vendors" },
  { key: "products", label: "Products" },
  { key: "services", label: "Services" },
];

const FIELDS: Record<Section, Array<{ key: string; label: string; placeholder: string }>> = {
  campuses: [
    { key: "slug", label: "Slug", placeholder: "campus-slug" },
    { key: "name", label: "Name", placeholder: "Institution name" },
    { key: "city", label: "City", placeholder: "City or campus locations" },
    { key: "region", label: "Region", placeholder: "Region" },
    { key: "description", label: "Description", placeholder: "Optional notes" },
  ],
  vendors: [
    { key: "slug", label: "Slug", placeholder: "vendor-slug" },
    { key: "campusId", label: "Campus ID", placeholder: "Campus numeric ID" },
    { key: "name", label: "Name", placeholder: "Vendor name" },
    { key: "category", label: "Category", placeholder: "food, groceries, etc." },
    { key: "description", label: "Description", placeholder: "Optional notes" },
    { key: "etaMin", label: "ETA minutes", placeholder: "25" },
    { key: "deliveryFeePesewas", label: "Delivery fee (pesewas)", placeholder: "0" },
  ],
  products: [
    { key: "slug", label: "Slug", placeholder: "product-slug" },
    { key: "vendorId", label: "Vendor ID (optional)", placeholder: "Leave blank for none" },
    { key: "category", label: "Category", placeholder: "food, drinks, groceries..." },
    { key: "name", label: "Name", placeholder: "Product name" },
    { key: "description", label: "Description", placeholder: "Product description" },
    { key: "pricePesewas", label: "Price (pesewas)", placeholder: "2500" },
    { key: "imageUrl", label: "Image URL or path", placeholder: "Optional image path" },
    { key: "badge", label: "Badge", placeholder: "Optional badge" },
  ],
  services: [
    { key: "slug", label: "Slug", placeholder: "service-slug" },
    { key: "name", label: "Name", placeholder: "Service name" },
    { key: "category", label: "Category", placeholder: "Study support, errands..." },
    { key: "description", label: "Description", placeholder: "Service description" },
    { key: "startingPricePesewas", label: "Starting price (pesewas)", placeholder: "0" },
  ],
};

function toDraft(row: Record<string, unknown>): Draft {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? "" : String(value)]));
}

export default function AdminScreen() {
  const [section, setSection] = useState<Section>("campuses");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const utils = trpc.useUtils();
  const campuses = trpc.admin.campuses.useQuery(undefined, { retry: false });
  const vendors = trpc.admin.vendors.useQuery(undefined, { retry: false, enabled: section === "vendors" });
  const products = trpc.admin.products.useQuery(undefined, { retry: false, enabled: section === "products" });
  const services = trpc.admin.services.useQuery(undefined, { retry: false, enabled: section === "services" });

  const createCampus = trpc.admin.createCampus.useMutation();
  const updateCampus = trpc.admin.updateCampus.useMutation();
  const deleteCampus = trpc.admin.deleteCampus.useMutation();
  const createVendor = trpc.admin.createVendor.useMutation();
  const updateVendor = trpc.admin.updateVendor.useMutation();
  const deleteVendor = trpc.admin.deleteVendor.useMutation();
  const createProduct = trpc.admin.createProduct.useMutation();
  const updateProduct = trpc.admin.updateProduct.useMutation();
  const deleteProduct = trpc.admin.deleteProduct.useMutation();
  const clearProductImage = trpc.admin.clearProductImage.useMutation();
  const createService = trpc.admin.createService.useMutation();
  const updateService = trpc.admin.updateService.useMutation();
  const deleteService = trpc.admin.deleteService.useMutation();

  const rows = section === "campuses" ? campuses.data : section === "vendors" ? vendors.data : section === "products" ? products.data : services.data;
  const loading = section === "campuses" ? campuses.isLoading : section === "vendors" ? vendors.isLoading : section === "products" ? products.isLoading : services.isLoading;
  const failed = section === "campuses" ? campuses.isError : section === "vendors" ? vendors.isError : section === "products" ? products.isError : services.isError;

  const invalidate = async () => {
    await Promise.all([
      utils.admin.campuses.invalidate(),
      utils.admin.vendors.invalidate(),
      utils.admin.products.invalidate(),
      utils.admin.services.invalidate(),
      utils.catalog.campuses.invalidate(),
      utils.catalog.home.invalidate(),
      utils.catalog.listProducts.invalidate(),
    ]);
  };

  const confirmDelete = (row: Record<string, unknown>) => {
    const id = Number(row.id);
    const label = String(row.name ?? row.slug ?? "this item");
    const run = async () => {
      setError("");
      try {
        if (section === "campuses") await deleteCampus.mutateAsync({ id });
        if (section === "vendors") await deleteVendor.mutateAsync({ id });
        if (section === "products") await deleteProduct.mutateAsync({ id });
        if (section === "services") await deleteService.mutateAsync({ id });
        await invalidate();
      } catch (err) { setError(friendlyError(err, "Could not delete this record.")); }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Delete ${label}? This cannot be undone.`)) void run();
    } else {
      Alert.alert("Delete record?", `This will delete ${label}.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void run() },
      ]);
    }
  };

  const save = async () => {
    if (!editing) return;
    setError("");
    try {
      const data: Record<string, unknown> = { ...editing };
      delete data.id;
      delete data.createdAt;
      delete data.updatedAt;
      for (const key of ["campusId", "vendorId", "etaMin", "deliveryFeePesewas", "pricePesewas", "startingPricePesewas", "isActive", "isOpen"]) {
        if (key in data) data[key] = data[key] === "" && ["vendorId"].includes(key) ? null : Number(data[key]);
      }
      for (const key of ["description", "imageUrl", "badge"]) if (data[key] === "") data[key] = null;
      const id = Number(editing.id);
      if (section === "campuses") {
        if (id) await updateCampus.mutateAsync({ id, data: data as never });
        else await createCampus.mutateAsync(data as never);
      }
      if (section === "vendors") {
        if (id) await updateVendor.mutateAsync({ id, data: data as never });
        else await createVendor.mutateAsync(data as never);
      }
      if (section === "products") {
        if (id) await updateProduct.mutateAsync({ id, data: data as never });
        else await createProduct.mutateAsync(data as never);
      }
      if (section === "services") {
        if (id) await updateService.mutateAsync({ id, data: data as never });
        else await createService.mutateAsync(data as never);
      }
      setEditing(null);
      await invalidate();
    } catch (err) { setError(friendlyError(err, "Could not save this record.")); }
  };

  return <Page>
    <Header title="Admin console" subtitle="Catalog management" back />
    {error ? <Notice tone="error">{error}</Notice> : null}
    <View style={{ flexDirection: "row", gap: 5, backgroundColor: "#EEF3EF", padding: 4, borderRadius: 13 }}>
      {SECTIONS.map((item) => <Pressable key={item.key} onPress={() => { setSection(item.key); setEditing(null); setError(""); }} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, backgroundColor: section === item.key ? C.white : "transparent" }}><Text style={{ color: section === item.key ? C.green : C.muted, fontSize: 11, fontWeight: "800" }}>{item.label}</Text></Pressable>)}
    </View>
    {editing ? <View style={{ gap: 14, padding: 16, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16 }}>
      <Text style={{ color: C.ink, fontSize: 18, fontWeight: "900" }}>{editing.id ? "Edit record" : "New record"}</Text>
      {FIELDS[section].map((field) => <Field key={field.key} label={field.label} value={editing[field.key] ?? ""} onChangeText={(value: string) => setEditing((current) => current ? { ...current, [field.key]: value } : current)} placeholder={field.placeholder} keyboardType={field.key.toLowerCase().includes("id") || field.key.toLowerCase().includes("pesewas") || field.key === "etaMin" ? "numeric" : "default"} multiline={field.key === "description"} />)}
      {section === "products" && editing.id && editing.imageUrl ? <Button title="Remove image reference" variant="outline" icon="image-outline" onPress={async () => { await clearProductImage.mutateAsync({ id: Number(editing.id) }); setEditing({ ...editing, imageUrl: "" }); await invalidate(); }} loading={clearProductImage.isPending} /> : null}
      <View style={{ flexDirection: "row", gap: 8 }}><Button title="Cancel" variant="outline" onPress={() => setEditing(null)} style={{ flex: 1 }} /><Button title="Save" onPress={() => void save()} loading={createCampus.isPending || createVendor.isPending || createProduct.isPending || createService.isPending || updateCampus.isPending || updateVendor.isPending || updateProduct.isPending || updateService.isPending} style={{ flex: 1 }} /></View>
    </View> : <>
      <Button title={`Add ${section.slice(0, -1)}`} icon="add" onPress={() => setEditing({})} />
      {loading ? <Text style={{ color: C.muted }}>Loading {section}…</Text> : failed ? <Notice tone="error">Admin records could not be loaded. Check your administrator access.</Notice> : null}
      <View style={{ gap: 9 }}>{(rows as Array<Record<string, unknown>> | undefined)?.map((row) => <View key={String(row.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 13, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 14 }}>
        <View style={{ flex: 1, gap: 3 }}><Text style={{ color: C.ink, fontWeight: "800", fontSize: 13 }}>{String(row.name ?? row.slug)}</Text><Text style={{ color: C.muted, fontSize: 11 }} numberOfLines={2}>{String(row.city ?? row.category ?? row.slug ?? "")}{row.pricePesewas != null ? ` · ${row.pricePesewas} pesewas` : ""}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${String(row.name ?? row.slug)}`} onPress={() => setEditing(toDraft(row))} hitSlop={8} style={{ padding: 8 }}><Text style={{ color: C.green, fontWeight: "800" }}>Edit</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${String(row.name ?? row.slug)}`} onPress={() => confirmDelete(row)} hitSlop={8} style={{ padding: 8 }}><Text style={{ color: C.coral, fontWeight: "800" }}>Delete</Text></Pressable>
      </View>)}</View>
      {section === "products" ? <Notice tone="mango">Deleting a product is blocked when orders reference it. “Remove image reference” clears the database URL; the current storage provider has no file-delete API.</Notice> : null}
    </>}
  </Page>;
}
