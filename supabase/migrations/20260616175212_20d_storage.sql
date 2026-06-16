
-- Restrict storage SELECT to authenticated users scoped to their own company folder.
-- Public buckets allow direct URL access without a SELECT policy, so restricting
-- listing does not break image display — it only prevents cross-company enumeration.
DROP POLICY IF EXISTS employee_photos_select ON storage.objects;
CREATE POLICY employee_photos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-photos'
    AND (storage.foldername(name))[1] = (get_current_company_id())::text
  );

DROP POLICY IF EXISTS company_logos_select ON storage.objects;
CREATE POLICY company_logos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = (get_current_company_id())::text
  );
