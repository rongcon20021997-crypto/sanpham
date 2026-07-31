/*
# Storage policies for tshirt-assets bucket

Creates the `tshirt-assets` public storage bucket and sets permissions.
Allows authenticated and anon users to upload, read, and manage image files in the
`tshirt-assets` public storage bucket so preview images render in the browser.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('tshirt-assets', 'tshirt-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "assets_read" ON storage.objects;
CREATE POLICY "assets_read"
  ON storage.objects FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'tshirt-assets');

DROP POLICY IF EXISTS "assets_insert" ON storage.objects;
CREATE POLICY "assets_insert"
  ON storage.objects FOR INSERT
  TO authenticated, anon
  WITH CHECK (bucket_id = 'tshirt-assets');

DROP POLICY IF EXISTS "assets_update" ON storage.objects;
CREATE POLICY "assets_update"
  ON storage.objects FOR UPDATE
  TO authenticated, anon
  USING (bucket_id = 'tshirt-assets') WITH CHECK (bucket_id = 'tshirt-assets');

DROP POLICY IF EXISTS "assets_delete" ON storage.objects;
CREATE POLICY "assets_delete"
  ON storage.objects FOR DELETE
  TO authenticated, anon
  USING (bucket_id = 'tshirt-assets');
