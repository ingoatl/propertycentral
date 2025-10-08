-- Add detailed order information columns to expenses table
ALTER TABLE expenses
ADD COLUMN order_number text,
ADD COLUMN order_date date,
ADD COLUMN tracking_number text,
ADD COLUMN vendor text,
ADD COLUMN items_detail text;