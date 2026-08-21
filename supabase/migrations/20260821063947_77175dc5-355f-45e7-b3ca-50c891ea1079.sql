-- 1. owners
CREATE TABLE public.owners (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'owner',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owners TO authenticated;
GRANT ALL ON public.owners TO service_role;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.owners WHERE user_id = auth.uid())
$$;

CREATE POLICY "owners manage owners" ON public.owners FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

INSERT INTO public.owners (user_id, email, display_name)
SELECT id, email, coalesce(raw_user_meta_data->>'full_name', email)
FROM auth.users WHERE id = '510f306b-40b5-4d76-88f5-9b3e71055c3a'
ON CONFLICT (user_id) DO NOTHING;

-- 2. app_settings (single row)
CREATE TABLE public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  owner_first_name text NOT NULL DEFAULT 'Av',
  site_name text NOT NULL DEFAULT 'Starpoint RenoTracker',
  public_base_url text NOT NULL DEFAULT 'https://starpointreno.com',
  currency_code text NOT NULL DEFAULT 'BBD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- 3. rewrite owner policies
UPDATE public.vendors SET owner_id = '510f306b-40b5-4d76-88f5-9b3e71055c3a' WHERE owner_id IS NULL;

DROP POLICY IF EXISTS "owner manages vendors" ON public.vendors;
CREATE POLICY "owners manage vendors" ON public.vendors FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "owner manages jobs" ON public.jobs;
CREATE POLICY "owners manage jobs" ON public.jobs FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "owner manages job revisions" ON public.job_revisions;
CREATE POLICY "owners manage job revisions" ON public.job_revisions FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "owner manages payments" ON public.payments;
CREATE POLICY "owners manage payments" ON public.payments FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "owner manages allocations" ON public.payment_allocations;
CREATE POLICY "owners manage allocations" ON public.payment_allocations FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "owner manages attachments" ON public.attachments;
CREATE POLICY "owners manage attachments" ON public.attachments FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "owner manages items" ON public.items;
CREATE POLICY "owners manage items" ON public.items FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "owner manages vendor access" ON public.vendor_access;
CREATE POLICY "owners manage vendor access" ON public.vendor_access FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "owner reads vendor sessions" ON public.vendor_sessions;
DROP POLICY IF EXISTS "owner deletes vendor sessions" ON public.vendor_sessions;
CREATE POLICY "owners read vendor sessions" ON public.vendor_sessions FOR SELECT TO authenticated
  USING (public.is_owner());
CREATE POLICY "owners delete vendor sessions" ON public.vendor_sessions FOR DELETE TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS "owner reads vendor login events" ON public.vendor_login_events;
DROP POLICY IF EXISTS "owner deletes vendor login events" ON public.vendor_login_events;
CREATE POLICY "owners read vendor login events" ON public.vendor_login_events FOR SELECT TO authenticated
  USING (public.is_owner());
CREATE POLICY "owners delete vendor login events" ON public.vendor_login_events FOR DELETE TO authenticated
  USING (public.is_owner());

-- 4. storage policies
DROP POLICY IF EXISTS "owner reads proof" ON storage.objects;
DROP POLICY IF EXISTS "owner writes proof" ON storage.objects;
DROP POLICY IF EXISTS "owner updates proof" ON storage.objects;
DROP POLICY IF EXISTS "owner deletes proof" ON storage.objects;
CREATE POLICY "owners read proof" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'proof' AND public.is_owner());
CREATE POLICY "owners write proof" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proof' AND public.is_owner());
CREATE POLICY "owners update proof" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'proof' AND public.is_owner()) WITH CHECK (bucket_id = 'proof' AND public.is_owner());
CREATE POLICY "owners delete proof" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'proof' AND public.is_owner());