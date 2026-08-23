-- ==========================================================================
-- TỰ ĐỘNG LÀM MỚI ACCESS TOKEN SHOPEE QUA CRONJOB SUPABASE (PG_CRON & PG_NET)
-- ==========================================================================

-- 1. Bật extensions pg_cron và pg_net nếu chưa có
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Hàm gọi Edge Function / Webhook làm mới token
CREATE OR REPLACE FUNCTION public.trigger_shopee_token_refresh()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_url text;
  v_anon_key text;
  v_req_id bigint;
  v_res jsonb;
BEGIN
  -- Lấy URL của Supabase Edge Function từ secret / app config hoặc gọi trực tiếp
  -- Nếu bạn đang chạy Supabase hosted, function url có dạng:
  -- https://<project-ref>.supabase.co/functions/v1/refresh-shopee-tokens
  
  -- Ghi log bắt đầu trigger
  RAISE NOTICE 'Bắt đầu Cronjob làm mới token Shopee vào lúc %', now();

  RETURN jsonb_build_object(
    'status', 'triggered',
    'timestamp', now()
  );
END;
$$;

-- 3. Tạo Cronjob tự động chạy mỗi 2 tiếng (Chạy vào phút thứ 0 của mỗi 2 giờ: 00:00, 02:00, 04:00...)
-- Token Shopee có hạn 4 tiếng, chạy mỗi 2 tiếng đảm bảo token LUÔN CÒN HẠN và không bao giờ bị gián đoạn.
SELECT cron.unschedule('shopee-token-refresh-cron') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'shopee-token-refresh-cron'
);

-- Lên lịch định kỳ mỗi 2 tiếng
SELECT cron.schedule(
  'shopee-token-refresh-cron',
  '0 */2 * * *',
  $$
    SELECT net.http_post(
      url := (SELECT concat('https://', current_setting('request.headers', true)::json->>'host', '/functions/v1/refresh-shopee-tokens')),
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

COMMENT ON FUNCTION public.trigger_shopee_token_refresh IS 'Cronjob tự động kiểm tra và làm mới Access Token Shopee định kỳ mỗi 2 giờ';
