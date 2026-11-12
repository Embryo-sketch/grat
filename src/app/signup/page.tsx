import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Create a profile" };
export default function SignupPage() {
  return <main className="grat-auth"><section className="login-art space"><div className="aurora"/><div className="grid-floor"/><Link className="brand" href="/"><span className="grat-brand-mark"/>Grat</Link><div><p className="kicker" style={{color:"#8fe3f5"}}>CUSTOMER ACCESS</p><h1>A profile that keeps things <span className="grad">clear.</span></h1><p className="lead">Create your profile to submit requests and follow their review status.</p></div><p className="sub">Secure connection · Supabase Auth</p></section><section className="grat-auth-form"><div className="grat-glass"><h2>Create an account</h2><p className="sub">Set up your Grat customer profile.</p><AuthForm mode="signup"/><p className="text-xs">Grat records requests for staff review and does not move money.</p></div></section></main>;
}
