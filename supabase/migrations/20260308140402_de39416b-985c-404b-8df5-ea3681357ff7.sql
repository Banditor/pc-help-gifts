
-- Add quantity column to gifts
ALTER TABLE public.gifts ADD COLUMN quantity INTEGER DEFAULT 0;

-- Create storage bucket for gift images
INSERT INTO storage.buckets (id, name, public) VALUES ('gift-images', 'gift-images', true);

-- Allow anyone to view gift images
CREATE POLICY "Anyone can view gift images" ON storage.objects
  FOR SELECT USING (bucket_id = 'gift-images');

-- Allow anyone to upload gift images (admin manages via UI)
CREATE POLICY "Allow upload gift images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'gift-images');

-- Allow delete gift images
CREATE POLICY "Allow delete gift images" ON storage.objects
  FOR DELETE USING (bucket_id = 'gift-images');
