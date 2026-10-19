import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { trpc } from "@/lib/trpc";

export type SelectedCampus = { id: number; slug?: string; name: string; city?: string; region?: string; isSample?: number };
const KEY = "camporder.selectedCampus";

export function useSelectedCampus() {
  const [campus, setCampus] = useState<SelectedCampus | null>(null);
  const utils = trpc.useUtils();
  const setRemoteCampus = trpc.catalog.setCampus.useMutation();

  const refresh = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) setCampus(JSON.parse(raw) as SelectedCampus);
    } catch {
      setCampus(null);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

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
