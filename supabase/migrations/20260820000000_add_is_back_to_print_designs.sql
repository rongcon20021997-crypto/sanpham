-- Migration to add is_back boolean column to print_designs table
ALTER TABLE public.print_designs
ADD COLUMN IF NOT EXISTS is_back boolean DEFAULT false;
