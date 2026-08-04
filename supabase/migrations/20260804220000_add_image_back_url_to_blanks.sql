-- Migration to add image_back_url to blanks table and blank_image_type to products table
ALTER TABLE public.blanks
ADD COLUMN IF NOT EXISTS image_back_url text;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS blank_image_type text DEFAULT 'front';
