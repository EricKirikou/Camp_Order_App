import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { trpc } from "@/lib/trpc";

export type SelectedCampus = { id: number; slug?: string; name: string; city?: string; region?: string; isSample?: number };
const KEY = "camporder.selectedCampus";

export function useSelectedCampus() {
  const [campus, setCampus] = useState<SelectedCampus | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const utils = trpc.useUtils();
  const setRemoteCampus = trpc.catalog.setCampus.useMutation();
  const campuses = trpc.catalog.campuses.useQuery();

  const refresh = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) setCampus(JSON.parse(raw) as SelectedCampus);
      else setCampus(null);
    } catch {
      setCampus(null);
    } finally {
      setStorageLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  useEffect(() => {
    if (!storageLoaded || campus || !campuses.data) return;
    const defaultCampus = campuses.data.find((item) => item.slug === "knust");
    if (!defaultCampus) return;
    setCampus(defaultCampus);
    void AsyncStorage.setItem(KEY, JSON.stringify(defaultCampus));
  }, [campus, campuses.data, storageLoaded]);

  const selectCampus = useCallback(async (next: SelectedCampus, authenticated: boolean) => {
    setCampus(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    if (authenticated) {
      await setRemoteCampus.mutateAsync({ campusId: next.id });
      await utils.auth.me.invalidate();
    }
  }, [setRemoteCampus, utils]);

  return { campus, selectCampus, refresh };
}
