-- Migration to create public.ai_prompts table for AI image generation prompt templates
CREATE TABLE IF NOT EXISTS public.ai_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  prompt text NOT NULL,
  side text NOT NULL DEFAULT 'all', -- 'front' | 'back' | 'all'
  category text DEFAULT 'Studio Mockup', -- 'Studio', 'Lifestyle', 'Streetwear', 'Flatlay', 'Vintage', etc.
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS and full access
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access to ai_prompts" ON public.ai_prompts;
CREATE POLICY "Public full access to ai_prompts" ON public.ai_prompts FOR ALL USING (true) WITH CHECK (true);
