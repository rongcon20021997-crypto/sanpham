-- Migration: Thêm cột size_chart_url vào bảng shopee_app_configs để lưu ảnh Bảng quy đổi kích cỡ mặc định
ALTER TABLE public.shopee_app_configs ADD COLUMN IF NOT EXISTS size_chart_url text DEFAULT '';
