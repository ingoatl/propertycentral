-- Schedule monthly report to run on the 1st of each month at 9:00 AM UTC
SELECT cron.schedule(
  'send-monthly-report',
  '0 9 1 * *',
  $$
  SELECT
    net.http_post(
        url:='https://ijsxcaaqphaciaenlegl.supabase.co/functions/v1/send-monthly-report',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqc3hjYWFxcGhhY2lhZW5sZWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NjM0MzUsImV4cCI6MjA3NTEzOTQzNX0.8mGapaEeE6TdVkKLuC8Xr2Ei7IeKqOC2PGWV_dnPZxo"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);