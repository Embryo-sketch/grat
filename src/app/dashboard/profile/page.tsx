import { requireIdentity } from "@/lib/supabase";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const identity = await requireIdentity();
  if (!identity) redirect("/login");
  return <section className="page-content">
    <div className="section-heading"><div><p className="eyebrow">YOUR PROFILE</p><h2>Profile</h2><p>Account details for your Grat customer profile.</p></div></div>
    <div className="panel profile-panel"><div><small>Full name</small><strong>{identity.profile.full_name || "—"}</strong></div><div><small>Email</small><strong>{identity.profile.email || identity.user.email}</strong></div><div><small>Profile type</small><strong>{identity.profile.role === "customer" ? "Customer" : identity.profile.role === "admin" ? "Administrator" : "Staff"}</strong></div></div>
    <p className="helper-copy">For account support or profile corrections, contact Grat support. Do not share your password or verification codes.</p>
  </section>;
}
