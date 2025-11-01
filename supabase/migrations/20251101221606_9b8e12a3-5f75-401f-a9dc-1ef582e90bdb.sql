-- Add structured line items and email screenshot path to expenses table
ALTER TABLE expenses ADD COLUMN line_items JSONB;
ALTER TABLE expenses ADD COLUMN email_screenshot_path TEXT;

-- Add comment to describe the structure
COMMENT ON COLUMN expenses.line_items IS 'Structured expense items: {"items": [{"name": "Item Name", "price": 12.99}]}';