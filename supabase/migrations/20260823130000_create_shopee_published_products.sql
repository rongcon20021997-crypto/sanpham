-- Migration: Tạo bảng lưu trữ sản phẩm đã đăng lên Shopee

CREATE TABLE IF NOT EXISTS public.shopee_published_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_code text NOT NULL,
  master_name text NOT NULL DEFAULT '',
  shop_id text NOT NULL,
  shop_name text NOT NULL DEFAULT '',
  shopee_item_id bigint DEFAULT NULL,
  item_name text NOT NULL DEFAULT '',
  category_id bigint DEFAULT NULL,
  price numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'draft', -- 'draft', 'publishing', 'published', 'failed'
  shopee_url text DEFAULT '',
  error_message text DEFAULT '',
  payload jsonb DEFAULT '{}'::jsonb,
  published_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_shopee_published_master_code ON public.shopee_published_products (master_code);
CREATE INDEX IF NOT EXISTS idx_shopee_published_shop_id ON public.shopee_published_products (shop_id);
CREATE INDEX IF NOT EXISTS idx_shopee_published_item_id ON public.shopee_published_products (shopee_item_id);

-- RLS
ALTER TABLE public.shopee_published_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access to shopee_published_products" ON public.shopee_published_products;
CREATE POLICY "Public full access to shopee_published_products" ON public.shopee_published_products FOR ALL USING (true) WITH CHECK (true);
