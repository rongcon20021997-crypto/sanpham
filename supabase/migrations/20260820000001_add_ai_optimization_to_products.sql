-- Thêm các cột lưu trữ trạng thái và nội dung tối ưu Shopee AI
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_optimized boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS shopee_name text,
ADD COLUMN IF NOT EXISTS shopee_description text,
ADD COLUMN IF NOT EXISTS optimized_at timestamptz;
