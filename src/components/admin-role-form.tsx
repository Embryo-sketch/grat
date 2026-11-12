"use client";

import { useActionState } from "react";
import { updateUserRole, type ActionState } from "@/app/auth-actions";
import type { Profile } from "@/lib/supabase";

export function AdminRoleForm({ userId, role, isCurrentUser }: { userId: string; role: Profile["role"]; isCurrentUser: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateUserRole, undefined);
  return <form action={action} className="admin-role-form">
    <input type="hidden" name="userId" value={userId}/>
    <label className="sr-only" htmlFor={`role-${userId}`}>Role</label>
    <select id={`role-${userId}`} name="role" defaultValue={role} disabled={isCurrentUser || pending}>
      <option value="customer">Customer</option><option value="staff">Staff</option><option value="admin">Admin</option>
    </select>
    <button className="btn small" type="submit" disabled={isCurrentUser || pending}>{pending ? "Saving…" : "Save role"}</button>
    {isCurrentUser&&<small>Your own role is protected.</small>}
    {state?.error&&<small className="admin-form-error" role="alert">{state.error}</small>}
    {state?.notice&&<small className="admin-form-notice" role="status">{state.notice}</small>}
  </form>;
}
