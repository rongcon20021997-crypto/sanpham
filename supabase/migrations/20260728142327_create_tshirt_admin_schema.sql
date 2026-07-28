/*
# T-Shirt Print Admin - Full Schema (Version 1)

## Overview
Creates the complete database schema for a t-shirt print product management admin system.
The app has sign-in (staff/admin accounts). Business data is shared across all authenticated
staff (organizational data, not per-user owned). User management is handled via an edge
function using the service role key.

## New Tables
- `profiles` — extends auth.users with role (admin/staff), full name, phone, status.
- `colors`, `sizes`, `themes` — catalog lookups.
- `code_rules` — single-row table storing the auto-code generation rule template.
- `blank_types` — loại phôi: code, name, description.
- `blanks` — phôi: code, blank_type_id, color, size, price, image_url.
- `print_designs` — hình in: code, name, theme, png_url, thumbnail_url, tags, notes.
- `products` — sản phẩm: code, name, blank_id, print_design_id, preview_url, price, status.

## Security
- RLS enabled on every table.
- profiles: authenticated can read all (staff directory); users update own profile.
- Business tables: all authenticated staff can CRUD — intentionally shared org data.
- is_admin() SQL helper checks profiles role for admin-only server-side checks.

## Notes
1. Trigger auto-creates a profiles row on signup.
2. First user to sign up is auto-assigned admin role (bootstrap).
3. code_rules seeded with default template; colors/sizes/themes seeded.
*/

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text,
  phone       text,
  role        text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','staff')),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- Helper: is_admin()
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- Trigger: auto-create profile on signup; bootstrap first user as admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  IF (SELECT count(*) FROM public.profiles) = 1 THEN
    UPDATE public.profiles SET role = 'admin' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- colors catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS public.colors (
  id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code  text NOT NULL UNIQUE,
  name  text NOT NULL,
  hex   text
);
ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "colors_select" ON public.colors;
CREATE POLICY "colors_select" ON public.colors FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "colors_insert" ON public.colors;
CREATE POLICY "colors_insert" ON public.colors FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "colors_update" ON public.colors;
CREATE POLICY "colors_update" ON public.colors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "colors_delete" ON public.colors;
CREATE POLICY "colors_delete" ON public.colors FOR DELETE TO authenticated USING (true);

-- ============================================================
-- sizes catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sizes (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0
);
ALTER TABLE public.sizes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sizes_select" ON public.sizes;
CREATE POLICY "sizes_select" ON public.sizes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sizes_insert" ON public.sizes;
CREATE POLICY "sizes_insert" ON public.sizes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sizes_update" ON public.sizes;
CREATE POLICY "sizes_update" ON public.sizes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sizes_delete" ON public.sizes;
CREATE POLICY "sizes_delete" ON public.sizes FOR DELETE TO authenticated USING (true);

-- ============================================================
-- themes catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS public.themes (
  id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name  text NOT NULL UNIQUE
);
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "themes_select" ON public.themes;
CREATE POLICY "themes_select" ON public.themes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "themes_insert" ON public.themes;
CREATE POLICY "themes_insert" ON public.themes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "themes_update" ON public.themes;
CREATE POLICY "themes_update" ON public.themes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "themes_delete" ON public.themes;
CREATE POLICY "themes_delete" ON public.themes FOR DELETE TO authenticated USING (true);

-- ============================================================
-- code_rules (single row)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.code_rules (
  id          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  template    text NOT NULL DEFAULT '{blank_code}-{color}-{size}-{print_code}',
  description text
);
ALTER TABLE public.code_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "code_rules_select" ON public.code_rules;
CREATE POLICY "code_rules_select" ON public.code_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "code_rules_update" ON public.code_rules;
CREATE POLICY "code_rules_update" ON public.code_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- blank_types (loại phôi)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.blank_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.blank_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blank_types_select" ON public.blank_types;
CREATE POLICY "blank_types_select" ON public.blank_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "blank_types_insert" ON public.blank_types;
CREATE POLICY "blank_types_insert" ON public.blank_types FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "blank_types_update" ON public.blank_types;
CREATE POLICY "blank_types_update" ON public.blank_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "blank_types_delete" ON public.blank_types;
CREATE POLICY "blank_types_delete" ON public.blank_types FOR DELETE TO authenticated USING (true);

-- ============================================================
-- blanks (phôi)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.blanks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text NOT NULL UNIQUE,
  blank_type_id  uuid NOT NULL REFERENCES public.blank_types(id) ON DELETE RESTRICT,
  color          text NOT NULL,
  size           text NOT NULL,
  price          numeric(12,2) NOT NULL DEFAULT 0,
  image_url      text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.blanks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blanks_select" ON public.blanks;
CREATE POLICY "blanks_select" ON public.blanks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "blanks_insert" ON public.blanks;
CREATE POLICY "blanks_insert" ON public.blanks FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "blanks_update" ON public.blanks;
CREATE POLICY "blanks_update" ON public.blanks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "blanks_delete" ON public.blanks;
CREATE POLICY "blanks_delete" ON public.blanks FOR DELETE TO authenticated USING (true);

-- ============================================================
-- print_designs (hình in)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.print_designs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text NOT NULL UNIQUE,
  name           text NOT NULL,
  theme          text,
  png_url        text,
  thumbnail_url  text,
  tags           text[],
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.print_designs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "print_designs_select" ON public.print_designs;
CREATE POLICY "print_designs_select" ON public.print_designs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "print_designs_insert" ON public.print_designs;
CREATE POLICY "print_designs_insert" ON public.print_designs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "print_designs_update" ON public.print_designs;
CREATE POLICY "print_designs_update" ON public.print_designs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "print_designs_delete" ON public.print_designs;
CREATE POLICY "print_designs_delete" ON public.print_designs FOR DELETE TO authenticated USING (true);

-- ============================================================
-- products (sản phẩm)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE,
  name             text NOT NULL,
  blank_id         uuid NOT NULL REFERENCES public.blanks(id) ON DELETE RESTRICT,
  print_design_id  uuid NOT NULL REFERENCES public.print_designs(id) ON DELETE RESTRICT,
  preview_url      text,
  price            numeric(12,2) NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "products_insert" ON public.products;
CREATE POLICY "products_insert" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "products_update" ON public.products;
CREATE POLICY "products_update" ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "products_delete" ON public.products;
CREATE POLICY "products_delete" ON public.products FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_blanks_type ON public.blanks(blank_type_id);
CREATE INDEX IF NOT EXISTS idx_blanks_color_size ON public.blanks(color, size);
CREATE INDEX IF NOT EXISTS idx_print_designs_theme ON public.print_designs(theme);
CREATE INDEX IF NOT EXISTS idx_products_blank ON public.products(blank_id);
CREATE INDEX IF NOT EXISTS idx_products_print ON public.products(print_design_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);

-- ============================================================
-- Seed data
-- ============================================================
INSERT INTO public.code_rules (id, template, description)
VALUES (1, '{blank_code}-{color}-{size}-{print_code}', 'Mã sản phẩm = Mã phôi - Màu - Size - Mã hình')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.colors (code, name, hex) VALUES
('T', 'Trắng', '#FFFFFF'),
('D', 'Đen', '#000000'),
('X', 'Xám', '#808080'),
('N', 'Navy', '#1B2A4A'),
('R', 'Đỏ', '#E53935'),
('V', 'Vàng', '#FDD835'),
('XH', 'Xanh', '#1E88E5'),
('HK', 'Hồng', '#EC407A')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.sizes (code, name, sort_order) VALUES
('S', 'S', 1),
('M', 'M', 2),
('L', 'L', 3),
('XL', 'XL', 4),
('2XL', '2XL', 5),
('3XL', '3XL', 6)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.themes (name) VALUES
('Anime'),
('Sport'),
('Funny'),
('Động vật'),
('Minh họa'),
('Slogan'),
('Game')
ON CONFLICT (name) DO NOTHING;
