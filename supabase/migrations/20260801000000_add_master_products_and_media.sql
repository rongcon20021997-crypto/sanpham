-- Migration to add master product grouping & media fields to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS master_name text,
ADD COLUMN IF NOT EXISTS master_code text,
ADD COLUMN IF NOT EXISTS images text[],
ADD COLUMN IF NOT EXISTS video_url text;
