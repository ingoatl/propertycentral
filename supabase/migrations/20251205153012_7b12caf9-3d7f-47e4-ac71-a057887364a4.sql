-- Add review tracking columns to mid_term_bookings table
ALTER TABLE mid_term_bookings ADD COLUMN IF NOT EXISTS review_email_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE mid_term_bookings ADD COLUMN IF NOT EXISTS review_email_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE mid_term_bookings ADD COLUMN IF NOT EXISTS review_token UUID DEFAULT gen_random_uuid();
ALTER TABLE mid_term_bookings ADD COLUMN IF NOT EXISTS review_submitted BOOLEAN DEFAULT FALSE;
ALTER TABLE mid_term_bookings ADD COLUMN IF NOT EXISTS review_submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE mid_term_bookings ADD COLUMN IF NOT EXISTS gift_card_sent BOOLEAN DEFAULT FALSE;