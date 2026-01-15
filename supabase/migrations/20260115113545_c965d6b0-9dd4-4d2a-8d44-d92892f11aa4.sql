-- Schedule discovery call reminder cron job (every 15 minutes)
-- This triggers the edge function to send reminders and schedule Recall bots
SELECT cron.schedule(
  'discovery-call-reminder-cron',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://ijsxcaaqphaciaenlegl.supabase.co/functions/v1/discovery-call-reminder-cron',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqc3hjYWFxcGhhY2lhZW5sZWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NjM0MzUsImV4cCI6MjA3NTEzOTQzNX0.8mGapaEeE6TdVkKLuC8Xr2Ei7IeKqOC2PGWV_dnPZxo"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);