-- Migration to create public.logos table for logo management
CREATE TABLE IF NOT EXISTS public.logos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS and public full access
ALTER TABLE public.logos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public full access to logos" ON public.logos FOR ALL USING (true) WITH CHECK (true);
