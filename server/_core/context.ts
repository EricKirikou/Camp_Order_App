import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authenticateCampOrderRequest } from "../services/authentication";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  try {
    user = await authenticateCampOrderRequest(opts.req);
  } catch {
    // Public procedures remain available; protected procedures reject absent sessions.
    user = null;
  }
  return { req: opts.req, res: opts.res, user };
}
