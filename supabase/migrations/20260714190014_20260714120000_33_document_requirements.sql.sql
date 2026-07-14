-- ============================================================
-- 33: Country document requirements (Phase 2)
-- ============================================================

ALTER TABLE employee_documents DROP CONSTRAINT IF EXISTS employee_documents_document_type_check;

CREATE TABLE IF NOT EXISTS country_document_requirements (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code       char(2) NOT NULL REFERENCES countries(code),
  company_id         uuid REFERENCES companies(id) ON DELETE CASCADE,
  document_code      text NOT NULL,
  document_name      text NOT NULL,
  is_mandatory       boolean NOT NULL DEFAULT false,
  requires_upload    boolean NOT NULL DEFAULT true,
  has_number         boolean NOT NULL DEFAULT false,
  has_expiry         boolean NOT NULL DEFAULT false,
  expiry_notify_days integer[] DEFAULT '{90,60,30}',
  applicable_when    jsonb,
  hint               text,
  display_order      integer NOT NULL DEFAULT 0,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (country_code, company_id, document_code)
);

ALTER TABLE country_document_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY cdr_read ON country_document_requirements FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = get_current_company_id());
CREATE POLICY cdr_company_write ON country_document_requirements FOR ALL TO authenticated
  USING (company_id = get_current_company_id())
  WITH CHECK (company_id = get_current_company_id());
CREATE POLICY cdr_platform_write ON country_document_requirements FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

ALTER TABLE employee_documents
  ADD COLUMN IF NOT EXISTS requirement_id uuid REFERENCES country_document_requirements(id) ON DELETE SET NULL;

INSERT INTO country_document_requirements
  (country_code, document_code, document_name, is_mandatory, has_number, has_expiry, expiry_notify_days, applicable_when, hint, display_order)
VALUES
  ('BH','cpr_copy','CPR Copy',true,true,true,'{90,60,30}',NULL,'Central Population Registry card',1),
  ('BH','passport_copy','Passport Copy',true,true,true,'{180,90,30}',NULL,NULL,2),
  ('BH','visa_copy','Visa Copy',true,true,true,'{90,60,30}','{"field":"nationality_class","operator":"neq","value":"Bahraini"}','Expatriate employees only',3),
  ('BH','work_permit','Work Permit',true,true,true,'{90,60,30}','{"field":"nationality_class","operator":"neq","value":"Bahraini"}','LMRA work permit — expatriate employees only',4),
  ('BH','gosi_registration','GOSI Registration',false,true,false,NULL,NULL,'Social Insurance Organisation registration',5),
  ('AE','emirates_id','Emirates ID Copy',true,true,true,'{90,60,30}',NULL,NULL,1),
  ('AE','passport_copy','Passport Copy',true,true,true,'{180,90,30}',NULL,NULL,2),
  ('AE','residence_visa','Residence Visa',true,true,true,'{90,60,30}','{"field":"nationality_class","operator":"eq","value":"Expatriate"}',NULL,3),
  ('AE','labour_card','Labour Card',true,true,true,'{90,60,30}','{"field":"nationality_class","operator":"eq","value":"Expatriate"}','MOHRE labour card',4),
  ('AE','medical_insurance','Medical Insurance Card',true,true,true,'{60,30}',NULL,'Mandatory medical insurance',5),
  ('SA','national_id_iqama','National ID / Iqama Copy',true,true,true,'{90,60,30}',NULL,NULL,1),
  ('SA','passport_copy','Passport Copy',true,true,true,'{180,90,30}','{"field":"nationality_class","operator":"eq","value":"Expatriate"}',NULL,2),
  ('SA','gosi_registration','GOSI Registration',true,true,false,NULL,NULL,NULL,3),
  ('SA','work_permit','Work Permit',true,true,true,'{90,60,30}','{"field":"nationality_class","operator":"eq","value":"Expatriate"}',NULL,4),
  ('OM','civil_id','Civil ID Copy',true,true,true,'{90,60,30}',NULL,NULL,1),
  ('OM','passport_copy','Passport Copy',true,true,true,'{180,90,30}',NULL,NULL,2),
  ('OM','labour_card','Labour Card',true,true,true,'{90,60,30}','{"field":"nationality_class","operator":"eq","value":"Expatriate"}',NULL,3),
  ('OM','visa_copy','Visa Copy',true,true,true,'{90,60,30}','{"field":"nationality_class","operator":"eq","value":"Expatriate"}',NULL,4),
  ('QA','qid_copy','QID Copy',true,true,true,'{90,60,30}',NULL,NULL,1),
  ('QA','passport_copy','Passport Copy',true,true,true,'{180,90,30}',NULL,NULL,2),
  ('QA','visa_copy','Visa Copy',true,true,true,'{90,60,30}','{"field":"nationality_class","operator":"eq","value":"Expatriate"}',NULL,3),
  ('QA','work_permit','Work Permit',true,true,true,'{90,60,30}','{"field":"nationality_class","operator":"eq","value":"Expatriate"}',NULL,4),
  ('KW','civil_id','Civil ID Copy',true,true,true,'{90,60,30}',NULL,NULL,1),
  ('KW','passport_copy','Passport Copy',true,true,true,'{180,90,30}',NULL,NULL,2),
  ('KW','visa_copy','Visa Copy',true,true,true,'{90,60,30}','{"field":"nationality_class","operator":"eq","value":"Expatriate"}',NULL,3),
  ('KW','work_permit','Work Permit',true,true,true,'{90,60,30}','{"field":"nationality_class","operator":"eq","value":"Expatriate"}',NULL,4),
  ('IN','aadhaar','Aadhaar Card',true,true,false,NULL,NULL,NULL,1),
  ('IN','pan','PAN Card',true,true,false,NULL,NULL,NULL,2),
  ('IN','bank_proof','Bank Proof',true,false,false,NULL,NULL,'Cancelled cheque or passbook copy',3),
  ('IN','pf_declaration','PF Declaration (Form 11)',true,false,false,NULL,NULL,NULL,4),
  ('IN','esi_declaration','ESI Declaration (Form 1)',false,false,false,NULL,NULL,'Required when gross wage is within the ESI ceiling',5),
  ('IN','form_12b','Form 12B',false,false,false,NULL,NULL,'Previous employer income during the financial year',6),
  ('GB','ni_proof','National Insurance Proof',true,true,false,NULL,NULL,NULL,1),
  ('GB','right_to_work','Right to Work Document',true,false,true,'{90,30}',NULL,'Passport, share code check, or visa evidence',2),
  ('GB','p45','P45 / Starter Checklist',true,false,false,NULL,NULL,NULL,3),
  ('GB','pension_enrollment','Pension Enrolment Form',false,false,false,NULL,NULL,'Auto-enrolment opt-in/out record',4),
  ('US','ssn_card','Social Security Card',true,true,false,NULL,NULL,NULL,1),
  ('US','i9_form','Form I-9',true,false,false,NULL,NULL,'Employment eligibility verification',2),
  ('US','w4_form','Form W-4',true,false,false,NULL,NULL,NULL,3),
  ('US','state_tax_form','State Withholding Form',false,false,false,NULL,NULL,'Where the work state has income tax',4),
  ('US','direct_deposit','Direct Deposit Authorization',true,false,false,NULL,NULL,NULL,5)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';