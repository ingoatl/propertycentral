-- Add column to store pre-generated image URL
ALTER TABLE holiday_email_queue 
ADD COLUMN IF NOT EXISTS pre_generated_image_url TEXT;

-- Add index for faster lookups on pending items without images
CREATE INDEX IF NOT EXISTS idx_holiday_email_queue_pending_no_image 
ON holiday_email_queue (template_id, status) 
WHERE pre_generated_image_url IS NULL AND status = 'pending';