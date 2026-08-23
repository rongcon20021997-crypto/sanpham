-- Migration: Tạo bảng cấu hình TikTok Shop Partner App, TikTok Shops và Webhook Logs trên Supabase

-- Bảng 1: Cấu hình App TikTok Shop (Khóa ứng dụng và Khóa bí mật nội bộ)
CREATE TABLE IF NOT EXISTS public.tiktok_app_configs (
  id integer PRIMARY KEY DEFAULT 1,
  app_key text NOT NULL DEFAULT '',
  app_secret text NOT NULL DEFAULT '',
  service_id text NOT NULL DEFAULT '',
  environment text NOT NULL DEFAULT 'live',
  redirect_url text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

-- Thêm dòng cấu hình mặc định id = 1 nếu chưa có
INSERT INTO public.tiktok_app_configs (id, app_key, app_secret, service_id, environment, redirect_url)
VALUES (1, '', '', '', 'live', '')
ON CONFLICT (id) DO NOTHING;

-- Bảng 2: Danh sách Gian Hàng TikTok Shop
CREATE TABLE IF NOT EXISTS public.tiktok_shops (
  id text PRIMARY KEY,
  shop_cipher text NOT NULL DEFAULT '',
  shop_code text NOT NULL DEFAULT '',
  shop_name text NOT NULL,
  region text NOT NULL DEFAULT 'VN',
  seller_type text DEFAULT 'CROSS_BORDER',
  open_id text DEFAULT '',
  access_token text DEFAULT '',
  refresh_token text DEFAULT '',
  token_expires_at bigint DEFAULT NULL,
  refresh_token_expires_at bigint DEFAULT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  is_default boolean NOT NULL DEFAULT false,
  note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Bảng 3: Nhật Ký Webhook TikTok Shop
CREATE TABLE IF NOT EXISTS public.tiktok_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text DEFAULT NULL,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Phân quyền RLS (Row Level Security) cho phép truy cập đầy đủ
ALTER TABLE public.tiktok_app_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access to tiktok_app_configs" ON public.tiktok_app_configs;
CREATE POLICY "Public full access to tiktok_app_configs" ON public.tiktok_app_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to tiktok_shops" ON public.tiktok_shops;
CREATE POLICY "Public full access to tiktok_shops" ON public.tiktok_shops FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to tiktok_webhook_logs" ON public.tiktok_webhook_logs;
CREATE POLICY "Public full access to tiktok_webhook_logs" ON public.tiktok_webhook_logs FOR ALL USING (true) WITH CHECK (true);
