
-- Create public storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('employee-photos', 'employee-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('company-logos',   'company-logos',   true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- employee-photos policies
CREATE POLICY "employee_photos_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'employee-photos');

CREATE POLICY "employee_photos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'employee-photos');

CREATE POLICY "employee_photos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'employee-photos');

CREATE POLICY "employee_photos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'employee-photos');

-- company-logos policies
CREATE POLICY "company_logos_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');

CREATE POLICY "company_logos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'company-logos');

CREATE POLICY "company_logos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'company-logos');

CREATE POLICY "company_logos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'company-logos');
