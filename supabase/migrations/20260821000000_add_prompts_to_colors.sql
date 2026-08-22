-- Migration to add prompt_front and prompt_back to colors table for AI image generation
ALTER TABLE public.colors
ADD COLUMN IF NOT EXISTS prompt_front text,
ADD COLUMN IF NOT EXISTS prompt_back text;
