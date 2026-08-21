REVOKE EXECUTE ON FUNCTION public.is_owner() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated, service_role;