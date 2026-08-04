-- Migration to add print_design_ids and print_positions for multiple print designs support
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS print_design_ids text[],
ADD COLUMN IF NOT EXISTS print_positions jsonb;
