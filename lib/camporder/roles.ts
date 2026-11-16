export type UserRole = "user" | "vendor" | "courier" | "admin" | "moderator";

/**
 * Returns the designated dashboard route for a given user role.
 *
 * - vendor: Vendor Kitchen Portal (Vendor Dashboard)
 * - admin: Admin Dashboard
 * - moderator: Moderator Dashboard (Admin screen in Moderator view)
 * - courier: Courier / Rider Dashboard
 * - user: Customer Marketplace (Tabs)
 */
export function getRoleDashboardRoute(role?: string | null): string {
  switch (role) {
    case "vendor":
      return "/(commerce)/vendor/portal";
    case "admin":
    case "moderator":
      return "/admin";
    case "courier":
      return "/(commerce)/rider/dashboard";
    case "user":
    default:
      return "/(tabs)";
  }
}

