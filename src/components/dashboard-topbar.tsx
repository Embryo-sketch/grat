"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Profile } from "@/lib/supabase";

function titleForPath(pathname: string, role: Profile["role"]) {
  if (pathname === "/dashboard") return "Home";
  if (pathname.startsWith("/dashboard/accounts")) return role === "customer" ? "Accounts" : "Customer accounts";
  if (pathname.startsWith("/dashboard/requests")) return role === "customer" ? "Requests" : "Request review";
  if (pathname.startsWith("/dashboard/profile")) return "Profile";
  if (pathname.startsWith("/dashboard/admin")) return "Admin dashboard";
  return "Grat";
}

export function DashboardTopbar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const initial = profile.full_name.trim().charAt(0).toUpperCase() || "G";

  return <header className="top grat-topbar">
    <h1>{titleForPath(pathname, profile.role)}</h1>
    <Link className="avatar top-av" href="/dashboard/profile" aria-label={`Open profile for ${profile.full_name || "your account"}`}>{initial}</Link>
  </header>;
}
