-- Remove old cron jobs if they exist
DO $$
BEGIN
  PERFORM cron.unschedule('daily-email-scan');
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('daily-ownerrez-sync');
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create daily email scan job (runs at 6 AM every day)
SELECT cron.schedule(
  'daily-email-scan',
  '0 6 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://ijsxcaaqphaciaenlegl.supabase.co/functions/v1/scan-gmail',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqc3hjYWFxcGhhY2lhZW5sZWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NjM0MzUsImV4cCI6MjA3NTEzOTQzNX0.8mGapaEeE6TdVkKLuC8Xr2Ei7IeKqOC2PGWV_dnPZxo"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Create daily OwnerRez sync job (runs at 7 AM every day)
SELECT cron.schedule(
  'daily-ownerrez-sync',
  '0 7 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://ijsxcaaqphaciaenlegl.supabase.co/functions/v1/sync-ownerrez',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqc3hjYWFxcGhhY2lhZW5sZWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NjM0MzUsImV4cCI6MjA3NTEzOTQzNX0.8mGapaEeE6TdVkKLuC8Xr2Ei7IeKqOC2PGWV_dnPZxo"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);