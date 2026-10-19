import { trpc } from "@/lib/trpc";

export function useCampOrderUser() {
  const utils = trpc.useUtils();
  const query = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 30_000 });
  return {
    user: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    refresh: () => utils.auth.me.invalidate(),
  };
}
