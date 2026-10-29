import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { Platform } from "react-native";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getApiBaseUrl()}/api/trpc`,
        transformer: superjson,
        async headers() {
  const token = await Auth.getSessionToken();

  console.log("[tRPC] Platform:", Platform.OS);
  console.log("[tRPC] Token exists:", Boolean(token));
  console.log("[tRPC] Token length:", token?.length ?? 0);

  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "x-camporder-client": Platform.OS === "web" ? "web" : "native",
  };
},


        fetch(url, options) {
          return fetch(url, { ...options, credentials: "include" });
        },
      }),
    ],
  });
}
