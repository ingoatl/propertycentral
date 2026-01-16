-- Add unique constraint on review_id
ALTER TABLE google_review_requests 
ADD CONSTRAINT google_review_requests_review_id_key UNIQUE (review_id);