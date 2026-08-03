-- Migration to add print_position column to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS print_position jsonb DEFAULT '{"posX": 50, "posY": 38, "scale": 45}'::jsonb;
