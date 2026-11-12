import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in" };
export default function LoginPage() {
  return <main className="grat-auth"><section className="login-art space"><div className="aurora"/><div className="grid-floor"/><Link className="brand" href="/"><span className="grat-brand-mark"/>Grat</Link><div><p className="kicker" style={{color:"#8fe3f5"}}>CUSTOMER ACCESS</p><h1>Your requests, <span className="grad">clear and calm.</span></h1><p className="lead">Sign in to view your profile, recorded balance and request history.</p></div><p className="sub">Secure connection · Supabase Auth</p></section><section className="grat-auth-form"><div className="grat-glass"><h2>Sign in</h2><p className="sub">Welcome back to Grat.</p><AuthForm mode="signin"/><div className="secure-row"><span>◈ Secure connection</span><span>✓ Supabase Auth</span></div></div></section></main>;
}
