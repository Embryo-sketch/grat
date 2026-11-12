import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Admin sign in" };

export default function AdminLoginPage() {
  return <main className="grat-auth admin-auth">
    <section className="login-art space admin-login-art">
      <div className="aurora"/><div className="grid-floor"/>
      <Link className="brand" href="/"><span className="grat-brand-mark"/>Grat</Link>
      <div className="admin-login-copy">
        <div className="admin-access-mark" aria-hidden="true">◇</div>
        <p className="kicker admin-kicker">GRAT ADMIN CONSOLE</p>
        <h1>Administrator <span className="grad">access only.</span></h1>
        <p className="lead">A secure workspace for user access, transfer reviews, and account operations.</p>
        <div className="admin-access-note"><span className="admin-access-dot"/> Restricted to authorized administrators</div>
      </div>
      <p className="sub">Protected access · Supabase Auth</p>
    </section>
    <section className="grat-auth-form admin-login-form">
      <div className="grat-glass admin-login-card">
        <p className="eyebrow">SECURE ADMIN ACCESS</p>
        <h2>Admin sign in</h2>
        <p className="sub">Sign in with your Grat administrator account.</p>
        <AuthForm mode="admin"/>
        <div className="secure-row"><span>◈ Encrypted connection</span><span>✓ Admin role verified</span></div>
      </div>
    </section>
  </main>;
}
