import { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  // Prevents onAuthStateChange from clobbering state mid-registration
  const registeringRef = useRef(false);

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
        // Skip while registerCompany is running — it manages state manually
        if (registeringRef.current) return;
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
    // Block onAuthStateChange from touching React state while we run this flow.
    // Without this guard, signUp() fires SIGNED_IN before the company exists,
    // loadUserData finds nothing, and PublicRoute redirects the user away mid-flow.
    registeringRef.current = true;
    let sessionUser = null;

    try {
      // Step 1: create or recover the auth user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      const alreadyExists = /already registered|already exists/i.test(signUpError?.message || '');
      if (signUpError && !alreadyExists) throw signUpError;

      if (!signUpError && signUpData.session) {
        sessionUser = signUpData.user;
      } else {
        // Email already in auth.users — sign in to recover the session
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw new Error('This email is already registered. Please log in or use a different email.');
        sessionUser = signInData.user;
      }

      // Step 2: create company via edge function which uses a direct Postgres connection.
      // This bypasses PostgREST entirely — no dependency on schema cache or auth.uid().
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId:      sessionUser.id,
          companyName, email, fullName, planId,
          crNumber:    crNumber    || null,
          phone:       phone       || null,
          industry:    industry    || null,
          country:     country     || null,
          countryCode: countryCode || null,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Company creation failed. Please try again.');

      // Step 3: populate React state now that company exists
      setUser(sessionUser);
      await loadUserData(sessionUser);
      setLoading(false);
    } catch (err) {
      // If we got a session but company creation failed, sign out to keep things clean
      if (sessionUser) await supabase.auth.signOut();
      throw err;
    } finally {
      registeringRef.current = false;
    }
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
