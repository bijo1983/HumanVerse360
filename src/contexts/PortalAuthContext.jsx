import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { portalSupabase } from '../lib/portalSupabase';

const PortalAuthContext = createContext(null);

export function PortalAuthProvider({ slug, children }) {
  const [employee, setEmployee] = useState(null);
  const [company, setCompany]   = useState(null);
  const [loading, setLoading]   = useState(true);

  const loadEmployee = useCallback(async (userId) => {
    if (!userId) { setEmployee(null); setLoading(false); return; }
    const { data } = await portalSupabase
      .from('employees')
      .select('*')
      .eq('portal_user_id', userId)
      .single();
    setEmployee(data ?? null);
    setLoading(false);
  }, []);

  // Load company info (public — uses RPC to bypass RLS)
  const loadCompany = useCallback(async () => {
    if (!slug) return;
    const { data } = await portalSupabase.rpc('get_portal_company_info', { p_slug: slug });
    setCompany(data ?? null);
  }, [slug]);

  useEffect(() => {
    loadCompany();
    portalSupabase.auth.getSession().then(({ data: { session } }) => {
      loadEmployee(session?.user?.id ?? null);
    });
    const { data: { subscription } } = portalSupabase.auth.onAuthStateChange((_event, session) => {
      loadEmployee(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, [loadEmployee, loadCompany]);

  const signIn = async (employeeCode, password) => {
    // Look up the employee's work email by their code
    const { data: email, error: lookupErr } = await portalSupabase.rpc('get_portal_employee_email', {
      p_employee_code: employeeCode,
      p_slug: slug,
    });
    if (lookupErr || !email) throw new Error('Employee ID not found for this company portal.');

    const { error } = await portalSupabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const register = async (employeeCode, workEmail, password) => {
    // Step 1: validate the employee exists with these credentials
    const { data: result, error: valErr } = await portalSupabase.rpc('validate_portal_employee', {
      p_employee_code: employeeCode,
      p_work_email:    workEmail,
      p_slug:          slug,
    });
    if (valErr) throw new Error(valErr.message);
    if (!result?.valid) throw new Error(result?.error ?? 'Validation failed');

    // Step 2: create auth account (email confirmation disabled)
    const { error: signUpErr } = await portalSupabase.auth.signUp({ email: workEmail, password });
    if (signUpErr) throw new Error(signUpErr.message);

    // Step 3: sign in so auth.uid() is set, then link
    const { error: signInErr } = await portalSupabase.auth.signInWithPassword({ email: workEmail, password });
    if (signInErr) throw new Error(signInErr.message);

    const { error: linkErr } = await portalSupabase.rpc('link_portal_employee', {
      p_employee_code: employeeCode,
      p_work_email:    workEmail,
      p_slug:          slug,
    });
    if (linkErr) throw new Error(linkErr.message);
  };

  const signOut = () => portalSupabase.auth.signOut();

  const refreshEmployee = () => {
    portalSupabase.auth.getSession().then(({ data: { session } }) => {
      loadEmployee(session?.user?.id ?? null);
    });
  };

  return (
    <PortalAuthContext.Provider value={{ employee, company, loading, slug, signIn, signOut, register, refreshEmployee }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error('usePortalAuth must be used within PortalAuthProvider');
  return ctx;
}
