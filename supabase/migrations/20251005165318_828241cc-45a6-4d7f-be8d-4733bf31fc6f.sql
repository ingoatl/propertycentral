-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule monthly report on the 1st of each month at 9:00 AM
SELECT cron.schedule(
  'monthly-property-report',
  '0 9 1 * *', -- At 9:00 AM on the 1st day of every month
  $$
  SELECT net.http_post(
    url:='https://ijsxcaaqphaciaenlegl.supabase.co/functions/v1/send-monthly-report',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqc3hjYWFxcGhhY2lhZW5sZWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NjM0MzUsImV4cCI6MjA3NTEzOTQzNX0.8mGapaEeE6TdVkKLuC8Xr2Ei7IeKqOC2PGWV_dnPZxo"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);