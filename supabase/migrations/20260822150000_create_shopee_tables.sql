-- Migration: Tạo bảng cấu hình Shopee Partner App, Shopee Shops và Webhook Logs trên Supabase

-- Bảng 1: Cấu hình Partner App dùng chung
CREATE TABLE IF NOT EXISTS public.shopee_app_configs (
  id integer PRIMARY KEY DEFAULT 1,
  partner_id text NOT NULL DEFAULT '',
  partner_key text NOT NULL DEFAULT '',
  environment text NOT NULL DEFAULT 'live',
  redirect_url text NOT NULL DEFAULT '',
  logistics_config jsonb DEFAULT '{}'::jsonb,
  categories_config jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- Cập nhật cột logistics_config và categories_config nếu bảng đã tồn tại trước đó
ALTER TABLE public.shopee_app_configs ADD COLUMN IF NOT EXISTS logistics_config jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.shopee_app_configs ADD COLUMN IF NOT EXISTS categories_config jsonb DEFAULT '[]'::jsonb;

-- Thêm dòng cấu hình mặc định id = 1 nếu chưa có
INSERT INTO public.shopee_app_configs (id, partner_id, partner_key, environment, redirect_url, logistics_config, categories_config)
VALUES (1, '', '', 'live', '', '{}'::jsonb, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Bảng 2: Danh sách Gian Hàng Shopee
CREATE TABLE IF NOT EXISTS public.shopee_shops (
  id text PRIMARY KEY,
  shop_id text NOT NULL,
  shop_name text NOT NULL,
  country text NOT NULL DEFAULT 'VN',
  access_token text DEFAULT '',
  refresh_token text DEFAULT '',
  token_expires_at bigint DEFAULT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  is_default boolean NOT NULL DEFAULT false,
  note text DEFAULT '',
  logistics_config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.shopee_shops ADD COLUMN IF NOT EXISTS logistics_config jsonb DEFAULT '{}'::jsonb;

-- Bảng 3: Nhật Ký Webhook (Shopee Push Notifications & Events)
CREATE TABLE IF NOT EXISTS public.shopee_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text DEFAULT NULL,
  code integer DEFAULT 0,
  topic text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  ip text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Phân quyền RLS (Row Level Security) cho phép truy cập đầy đủ
ALTER TABLE public.shopee_app_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopee_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopee_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access to shopee_app_configs" ON public.shopee_app_configs;
CREATE POLICY "Public full access to shopee_app_configs" ON public.shopee_app_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to shopee_shops" ON public.shopee_shops;
CREATE POLICY "Public full access to shopee_shops" ON public.shopee_shops FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to shopee_webhook_logs" ON public.shopee_webhook_logs;
CREATE POLICY "Public full access to shopee_webhook_logs" ON public.shopee_webhook_logs FOR ALL USING (true) WITH CHECK (true);
