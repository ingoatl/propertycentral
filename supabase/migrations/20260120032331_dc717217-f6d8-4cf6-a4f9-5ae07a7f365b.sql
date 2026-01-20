-- Create storage bucket for work order photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-order-photos', 'work-order-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone with a valid work order token to upload photos
CREATE POLICY "Anyone can upload work order photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'work-order-photos');

-- Allow public read access to work order photos
CREATE POLICY "Work order photos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'work-order-photos');

-- Allow vendors to delete their own photos
CREATE POLICY "Users can delete work order photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'work-order-photos');