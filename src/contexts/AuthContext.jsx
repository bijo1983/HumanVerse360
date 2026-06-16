import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PLANS } from '../lib/plans';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  // null = use plan defaults; array = custom grants for this user
  const [userModuleGrants, setUserModuleGrants] = useState(null);

  async function loadUserData(sessionUser) {
    const { data: adminRow } = await supabase
      .from('platform_admins')
      .select('email')
      .eq('email', sessionUser.email)
      .maybeSingle();
    setIsAdmin(!!adminRow);

    const { data: cu } = await supabase
      .from('company_users')
      .select('role, company_id, companies(*, subscription_plans(*))')
      .eq('user_id', sessionUser.id)
      .eq('is_active', true)
      .maybeSingle();

    if (cu) {
      setUserRole(cu.role);
      setCompany(cu.companies);
      const plan = cu.companies?.subscription_plans;
      if (plan) {
        setSubscription({ ...plan, planData: PLANS[plan.code] || PLANS.free });
      }

      // Load per-user module grants for this company
      const { data: grants } = await supabase
        .from('company_user_modules')
        .select('module')
        .eq('company_id', cu.company_id)
        .eq('user_id', sessionUser.id);
      setUserModuleGrants(grants && grants.length > 0 ? grants.map(g => g.module) : null);
    } else {
      setUserModuleGrants(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadUserData(session.user);
        } else {
          setCompany(null);
          setSubscription(null);
          setUserRole(null);
          setIsAdmin(false);
          setUserModuleGrants(null);
        }
        setLoading(false);
      })();
    });

    return () => authSub.unsubscribe();
  }, []);

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setCompany(null);
    setSubscription(null);
    setUserRole(null);
    setIsAdmin(false);
    setUserModuleGrants(null);
  }

  async function registerCompany({ companyName, email, password, fullName, planId, crNumber, phone, industry, country, countryCode }) {
    // Step 1: Create auth user — session is returned immediately (auto-confirm on)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (authError) throw authError;
    if (!authData.session) throw new Error('Sign-up did not return a session. Email confirmation may be required — please contact your administrator.');

    // Step 2: Delegate all DB inserts to the edge function so they run under
    // service-role and bypass RLS (the SELECT policy on `companies` cannot be
    // satisfied until company_users exists, so client-side inserts fail).
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-company`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.session.access_token}`,
      },
      body: JSON.stringify({ companyName, fullName, planId, crNumber, phone, industry, country, countryCode }),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || 'Failed to create company record.');

    return result.company;
  }

  async function refreshCompany() {
    if (user) await loadUserData(user);
  }

  function hasModuleAccess(moduleName) {
    if (!moduleName) return true;
    // If there are custom per-user grants, use those
    if (userModuleGrants !== null) return userModuleGrants.includes(moduleName);
    // Otherwise fall back to the subscription plan
    const planCode = subscription?.code || 'free';
    // Prefer DB-sourced modules list from subscription if available
    if (subscription?.modules) return subscription.modules.includes(moduleName);
    const plan = PLANS[planCode] || PLANS.free;
    return plan.modules.includes(moduleName);
  }

  function isWithinEmployeeLimit(currentCount) {
    const planCode = subscription?.code || 'free';
    const maxEmp = subscription?.max_employees;
    if (maxEmp === null || maxEmp === undefined) {
      const plan = PLANS[planCode] || PLANS.free;
      if (plan.maxEmployees === Infinity) return true;
      return currentCount < plan.maxEmployees;
    }
    if (maxEmp === 0) return true; // 0 means unlimited in admin UI
    return currentCount < maxEmp;
  }

  const value = {
    user,
    company,
    subscription,
    userRole,
    isAdmin,
    loading,
    signIn,
    signOut,
    registerCompany,
    refreshCompany,
    hasModuleAccess,
    isWithinEmployeeLimit,
    companyId: company?.id ?? null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
