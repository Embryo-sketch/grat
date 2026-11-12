import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { requireIdentity } from "@/lib/supabase";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const identity = await requireIdentity();
  if (!identity) redirect("/login");
  return <div className="grat-shell"><DashboardSidebar profile={identity.profile}/><main className="grat-main"><DashboardTopbar profile={identity.profile}/>{children}</main></div>;
}
