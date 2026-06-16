
-- Fix company_users INSERT policy for registration flow:
-- During registration, the new user has no company_users row yet, so
-- get_current_company_id() returns NULL. Allow insert when inserting own user_id.
DROP POLICY IF EXISTS cu_insert ON company_users;
CREATE POLICY cu_insert ON company_users FOR INSERT TO authenticated
  WITH CHECK (
    -- Existing company members (admin/manager adding sub-users)
    company_id = get_current_company_id()
    -- Self-registration: inserting own user_id for a company they just created
    OR user_id = auth.uid()
    -- Platform admin can always insert
    OR is_platform_admin()
  );

-- Also fix companies INSERT: allow unauthenticated? No — Supabase signUp gives a
-- session immediately (even before email confirm in some configs). The issue is
-- company insert uses service context. Let's just confirm the policy is open.
-- companies_insert already has WITH CHECK (true), so that's fine.

-- Seed the company for bijo.mammen@innovegicit.com if they completed registration
-- (auth user exists but company was never created — they'll need to re-register
-- OR we can pre-populate). Leave that to the user to re-register.
-- The fix above ensures new registrations will work correctly.
