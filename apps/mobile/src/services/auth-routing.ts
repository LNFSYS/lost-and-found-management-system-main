import type { MobileUser } from "@/services/api";

export function homeRouteFor(user: MobileUser): "/admin" | "/home" {
  return user.roles.includes("ADMIN") ? "/admin" : "/home";
}
