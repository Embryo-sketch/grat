"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth-actions";
import type { Profile } from "@/lib/supabase";

const nav = [
  ["/dashboard", "⌂", "Home"],
  ["/dashboard/accounts", "▣", "Accounts"],
  ["/dashboard/requests", "⇄", "Requests"],
  ["/dashboard/profile", "♙", "Profile"],
] as const;

export function DashboardSidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const isStaff = ["staff", "admin"].includes(profile.role);
  return <aside className="side" aria-label="Main navigation">
    <Link className="brand" href="/dashboard"><span className="grat-brand-mark"/>Grat</Link>
    <Link className="trade-btn" href={isStaff ? "/dashboard/requests" : "/dashboard/requests#new-request"}>{isStaff ? "Review requests" : "Move money"}</Link>
    <nav className="grid gap-1">
      {nav.map(([href, icon, label])=><Link key={href} href={href} className="nav-btn" aria-current={(pathname===href || (href!=="/dashboard" && pathname.startsWith(`${href}/`)))?"page":undefined}><span className="ic" aria-hidden="true">{icon}</span>{label}</Link>)}
    </nav>
    <div className="side-foot"><div className="side-status"><strong>Manual review</strong>Grat records requests and staff ledger entries. It does not hold or move funds.</div><form action={signOut}><button className="nav-btn w-full" type="submit">⇥ Sign out</button></form></div>
  </aside>;
}
