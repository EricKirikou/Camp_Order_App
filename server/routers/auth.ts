import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { completeOtp, emailPasswordLogin, publicUser, resendOtp, setSession, startLogin, startSignup } from "../services/authentication";
import { sessionCookieName, SESSION_MAX_AGE_MS } from "../services/security";
import { getSessionCookieName, getSessionCookieOptions } from "../_core/cookies";

export const authRouter = router({
  startSignup: publicProcedure.input(z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().min(8).max(32),
    email: z.string().trim().email().max(320).optional().or(z.literal("")),
    password: z.string().min(8).max(128),
  })).mutation(({ input }) => startSignup(input)),

  startLogin: publicProcedure.input(z.object({
    phone: z.string().min(8).max(32),
    password: z.string().min(1).max(128),
  })).mutation(({ input }) => startLogin(input)),

  emailLogin: publicProcedure.input(z.object({
    email: z.string().trim().email().max(320),
    password: z.string().min(1).max(128),
  })).mutation(async ({ input, ctx }) => {
    const result = await emailPasswordLogin(input);
    const nativeToken = await setSession(ctx.req, ctx.res, result.sessionToken);
    return { user: publicUser(result.user), sessionToken: nativeToken };
  }),

  resendOtp: publicProcedure.input(z.object({
    challengeId: z.number().int().positive(),
    resendToken: z.string().min(32).max(128),
  })).mutation(({ input }) => resendOtp(input.challengeId, input.resendToken)),

  verifyOtp: publicProcedure.input(z.object({
    challengeId: z.number().int().positive(),
    code: z.string().regex(/^\d{6}$/),
  })).mutation(async ({ input, ctx }) => {
    const result = await completeOtp(input.challengeId, input.code);
    const nativeToken = await setSession(ctx.req, ctx.res, result.sessionToken);
    return { user: publicUser(result.user), sessionToken: nativeToken };
  }),

  me: protectedProcedure.query(({ ctx }) => publicUser(ctx.user)),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(sessionCookieName(), { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});
