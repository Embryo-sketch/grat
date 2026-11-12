import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { requireIdentity } from "@/lib/supabase";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const identity = await requireIdentity();
  if (!identity) redirect("/login");
  return <div className="grat-shell"><DashboardSidebar profile={identity.profile}/><main className="grat-main"><header className="grat-topbar"><h1>Good {new Date().getHours()<12?"morning":new Date().getHours()<18?"afternoon":"evening"}, {identity.profile.full_name.split(" ")[0] || "there"}</h1><span className="avatar" aria-label="Signed in profile">{identity.profile.full_name.slice(0,1).toUpperCase() || "G"}</span></header>{children}</main></div>;
}
