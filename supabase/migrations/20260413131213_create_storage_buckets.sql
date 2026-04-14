/*
  # Create storage buckets for image uploads

  1. Storage Buckets
    - `avatars` - User profile pictures
    - `establishment-logos` - Establishment logos
    - `establishment-banners` - Pro establishment banners
    - `establishment-photos` - Pro establishment gallery photos
    - `event-images` - Event images
    - `promo-images` - Promotion images

  2. Security
    - All buckets are public for reading
    - Authenticated users can upload to their own folders
*/

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('establishment-logos', 'establishment-logos', true),
  ('establishment-banners', 'establishment-banners', true),
  ('establishment-photos', 'establishment-photos', true),
  ('event-images', 'event-images', true),
  ('promo-images', 'promo-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public read for establishment logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'establishment-logos');

CREATE POLICY "Auth users can upload establishment logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'establishment-logos');

CREATE POLICY "Auth users can update establishment logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'establishment-logos')
  WITH CHECK (bucket_id = 'establishment-logos');

CREATE POLICY "Auth users can delete establishment logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'establishment-logos');

CREATE POLICY "Public read for establishment banners"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'establishment-banners');

CREATE POLICY "Auth users can upload establishment banners"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'establishment-banners');

CREATE POLICY "Auth users can update establishment banners"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'establishment-banners')
  WITH CHECK (bucket_id = 'establishment-banners');

CREATE POLICY "Auth users can delete establishment banners"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'establishment-banners');

CREATE POLICY "Public read for establishment photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'establishment-photos');

CREATE POLICY "Auth users can upload establishment photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'establishment-photos');

CREATE POLICY "Auth users can update establishment photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'establishment-photos')
  WITH CHECK (bucket_id = 'establishment-photos');

CREATE POLICY "Auth users can delete establishment photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'establishment-photos');

CREATE POLICY "Public read for event images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'event-images');

CREATE POLICY "Auth users can upload event images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'event-images');

CREATE POLICY "Auth users can update event images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'event-images')
  WITH CHECK (bucket_id = 'event-images');

CREATE POLICY "Auth users can delete event images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'event-images');

CREATE POLICY "Public read for promo images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'promo-images');

CREATE POLICY "Auth users can upload promo images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'promo-images');

CREATE POLICY "Auth users can update promo images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'promo-images')
  WITH CHECK (bucket_id = 'promo-images');

CREATE POLICY "Auth users can delete promo images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'promo-images');
