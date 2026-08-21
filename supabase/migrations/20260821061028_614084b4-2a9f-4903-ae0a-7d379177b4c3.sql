ALTER TABLE public.vendor_access
  DROP COLUMN IF EXISTS token,
  DROP COLUMN IF EXISTS pin,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS setup_code_hash text,
  ADD COLUMN IF NOT EXISTS setup_code_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_device text;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_access_vendor_id_key ON public.vendor_access(vendor_id);

UPDATE public.vendors SET slug = lower(slug);
CREATE UNIQUE INDEX IF NOT EXISTS vendors_slug_key ON public.vendors(lower(slug));

CREATE TABLE IF NOT EXISTS public.vendor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

DO $$ BEGIN
  CREATE TYPE public.vendor_login_kind AS ENUM ('setup_code','set_pin','ok','fail','locked','reset','disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.vendor_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  kind public.vendor_login_kind NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  user_agent text
);

CREATE INDEX IF NOT EXISTS vendor_sessions_vendor_idx ON public.vendor_sessions(vendor_id);
CREATE INDEX IF NOT EXISTS vendor_login_events_vendor_idx ON public.vendor_login_events(vendor_id, at DESC);

GRANT SELECT, DELETE ON public.vendor_sessions TO authenticated;
GRANT ALL ON public.vendor_sessions TO service_role;
GRANT SELECT, DELETE ON public.vendor_login_events TO authenticated;
GRANT ALL ON public.vendor_login_events TO service_role;

ALTER TABLE public.vendor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_login_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner reads vendor sessions" ON public.vendor_sessions;
CREATE POLICY "owner reads vendor sessions" ON public.vendor_sessions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_sessions.vendor_id AND v.owner_id = auth.uid()));

DROP POLICY IF EXISTS "owner deletes vendor sessions" ON public.vendor_sessions;
CREATE POLICY "owner deletes vendor sessions" ON public.vendor_sessions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_sessions.vendor_id AND v.owner_id = auth.uid()));

DROP POLICY IF EXISTS "owner reads vendor login events" ON public.vendor_login_events;
CREATE POLICY "owner reads vendor login events" ON public.vendor_login_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_login_events.vendor_id AND v.owner_id = auth.uid()));

DROP POLICY IF EXISTS "owner deletes vendor login events" ON public.vendor_login_events;
CREATE POLICY "owner deletes vendor login events" ON public.vendor_login_events
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_login_events.vendor_id AND v.owner_id = auth.uid()));