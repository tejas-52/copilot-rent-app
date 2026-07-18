
CREATE TABLE public.agent_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host text NOT NULL,
  label text,
  username text NOT NULL,
  password_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, host)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_credentials TO authenticated;
GRANT ALL ON public.agent_credentials TO service_role;
ALTER TABLE public.agent_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own creds" ON public.agent_credentials FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER agent_credentials_updated_at BEFORE UPDATE ON public.agent_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_url text NOT NULL,
  credential_id uuid REFERENCES public.agent_credentials(id) ON DELETE SET NULL,
  bb_session_id text,
  live_view_url text,
  status text NOT NULL DEFAULT 'starting',
  log jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_runs TO authenticated;
GRANT ALL ON public.agent_runs TO service_role;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own runs" ON public.agent_runs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER agent_runs_updated_at BEFORE UPDATE ON public.agent_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
