-- Schedule overdue task emails to run daily at 8:00 AM
SELECT cron.schedule(
  'send-overdue-task-emails-daily',
  '0 8 * * *', -- Every day at 8:00 AM
  $$
  SELECT
    net.http_post(
      url := 'https://ijsxcaaqphaciaenlegl.supabase.co/functions/v1/send-overdue-task-emails',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqc3hjYWFxcGhhY2lhZW5sZWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NjM0MzUsImV4cCI6MjA3NTEzOTQzNX0.8mGapaEeE6TdVkKLuC8Xr2Ei7IeKqOC2PGWV_dnPZxo"}'::jsonb,
      body := json_build_object('scheduled_run', now())::text
    ) as request_id;
  $$
);