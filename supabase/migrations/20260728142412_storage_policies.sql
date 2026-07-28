/*
# Storage policies for tshirt-assets bucket

Allows authenticated users to upload, read, and manage image files in the
`tshirt-assets` public storage bucket. Files are public-readable so preview
images render in the browser.
*/

DROP POLICY IF EXISTS "assets_read" ON storage.objects;
CREATE POLICY "assets_read"
  ON storage.objects FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'tshirt-assets');

DROP POLICY IF EXISTS "assets_insert" ON storage.objects;
CREATE POLICY "assets_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'tshirt-assets');

DROP POLICY IF EXISTS "assets_update" ON storage.objects;
CREATE POLICY "assets_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'tshirt-assets') WITH CHECK (bucket_id = 'tshirt-assets');

DROP POLICY IF EXISTS "assets_delete" ON storage.objects;
CREATE POLICY "assets_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'tshirt-assets');
