import { createClient } from '@supabase/supabase-js';

// Separate Supabase client for the employee portal.
// Uses a different localStorage key so portal sessions never conflict
// with the admin application session.
export const portalSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { storageKey: 'hr-portal-auth-token' } }
);
