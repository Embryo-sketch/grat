"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, signUp, type ActionState } from "@/app/auth-actions";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const signup = mode === "signup";
  return (
    <form action={formAction} className="grat-form" aria-label={signup ? "Create Grat profile" : "Sign in to Grat"}>
      {signup && <label>Full name<input name="fullName" autoComplete="name" maxLength={100} required /></label>}
      <label>Email<input type="email" name="email" autoComplete="email" required /></label>
      <label>Password<input type="password" name="password" autoComplete={signup ? "new-password" : "current-password"} minLength={8} required /></label>
      {state?.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state?.notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{state.notice}</p>}
      <button className="btn primary" type="submit" disabled={pending}>{pending ? "Please wait…" : signup ? "Create account" : "Continue"}</button>
      <p className="sub text-sm">{signup ? "Already have an account? " : "New to Grat? "}<Link className="link" href={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Create an account"}</Link></p>
    </form>
  );
}
