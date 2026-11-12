"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, signInAdmin, signUp, type ActionState } from "@/app/auth-actions";

export function AuthForm({ mode }: { mode: "signin" | "signup" | "admin" }) {
  const action = mode === "admin" ? signInAdmin : mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const signup = mode === "signup";
  const admin = mode === "admin";
  return (
    <form action={formAction} className="grat-form" aria-label={signup ? "Create Grat profile" : admin ? "Administrator sign in" : "Sign in to Grat"}>
      {signup && <label>Full name<input name="fullName" autoComplete="name" maxLength={100} required /></label>}
      <label>Email<input type="email" name="email" autoComplete="email" required /></label>
      <label>Password<input type="password" name="password" autoComplete={signup ? "new-password" : "current-password"} minLength={8} required /></label>
      {state?.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state?.notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{state.notice}</p>}
      <button className="btn primary" type="submit" disabled={pending}>{pending ? "Please wait…" : signup ? "Create account" : "Continue"}</button>
      <p className="sub text-sm">{signup ? "Already have an account? " : admin ? "Need customer access? " : "New to Grat? "}<Link className="link" href={signup ? "/login" : admin ? "/login" : "/signup"}>{signup ? "Sign in" : admin ? "Customer sign in" : "Create an account"}</Link></p>
    </form>
  );
}
