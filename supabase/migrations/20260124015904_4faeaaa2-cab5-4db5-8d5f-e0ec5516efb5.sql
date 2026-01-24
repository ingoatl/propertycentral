-- Add photo reminder tracking columns to work_orders
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS before_photo_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS after_photo_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS before_photo_reminder_count INT DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS after_photo_reminder_count INT DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS vendor_viewed_at TIMESTAMPTZ;

-- Add media_type column to work_order_photos for video support
ALTER TABLE work_order_photos ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) DEFAULT 'photo';

-- Create index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_work_orders_photo_reminders ON work_orders(status, before_photo_reminder_count, after_photo_reminder_count) 
WHERE status IN ('scheduled', 'in_progress');

COMMENT ON COLUMN work_orders.before_photo_reminder_sent_at IS 'Last time a before photo reminder was sent';
COMMENT ON COLUMN work_orders.after_photo_reminder_sent_at IS 'Last time an after photo reminder was sent';
COMMENT ON COLUMN work_order_photos.media_type IS 'Type of media: photo or video';