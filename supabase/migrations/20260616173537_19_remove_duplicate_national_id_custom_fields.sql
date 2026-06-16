-- Remove custom fields that duplicate hardcoded employee profile columns.
-- These fields (national ID numbers and their expiry dates per country) are already
-- handled as first-class columns on the employees table with dedicated form fields.
-- Keeping them as custom_fields causes duplicate inputs in the UI.
-- The document-sync trigger (migration 11) auto-populates employee_documents
-- from the profile columns, so expiry tracking works without the custom fields.

DELETE FROM custom_fields
WHERE field_key IN (
  -- Bahrain
  'cpr_number', 'cpr_expiry',
  -- UAE
  'emirates_id', 'emirates_id_expiry',
  -- Saudi Arabia
  'iqama_number', 'iqama_expiry',
  -- Kuwait
  'civil_id', 'civil_id_expiry'
);
