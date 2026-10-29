import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { authRouter } from "./routers/auth";
import { catalogRouter } from "./routers/catalog";
import { cartRouter } from "./routers/cart";
import { ordersRouter } from "./routers/orders";
import { servicesRouter } from "./routers/services";
import { paymentsRouter } from "./routers/payments";
import { adminRouter } from "./routers/admin";
import { riderRouter } from "./routers/rider";
import { vendorRouter } from "./routers/vendor";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  catalog: catalogRouter,
  cart: cartRouter,
  orders: ordersRouter,
  services: servicesRouter,
  payments: paymentsRouter,
  admin: adminRouter,
  rider: riderRouter,
  vendor: vendorRouter,
});

export type AppRouter = typeof appRouter;
