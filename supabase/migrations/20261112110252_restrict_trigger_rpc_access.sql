-- Trigger-only SECURITY DEFINER functions are not intended as API RPCs.
revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
revoke all on function public.record_transfer_request_history() from public, anon, authenticated;
