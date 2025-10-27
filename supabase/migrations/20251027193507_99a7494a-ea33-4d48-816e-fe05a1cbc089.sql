-- Schedule team performance digest email daily at 6pm EST (23:00 UTC)
-- Note: pg_cron extension is already enabled in Supabase projects
SELECT cron.schedule(
  'daily-team-performance-digest',
  '0 23 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://ijsxcaaqphaciaenlegl.supabase.co/functions/v1/send-team-performance-digest',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqc3hjYWFxcGhhY2lhZW5sZWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NjM0MzUsImV4cCI6MjA3NTEzOTQzNX0.8mGapaEeE6TdVkKLuC8Xr2Ei7IeKqOC2PGWV_dnPZxo"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);