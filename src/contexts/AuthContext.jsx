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
  const [showSalary, setShowSalary] = useState(false);
  const [canDeletePayroll, setCanDeletePayroll] = useState(false);
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
      .select('role, company_id, show_salary, can_delete_payroll, companies(*, subscription_plans(*))')
      .eq('user_id', sessionUser.id)
      .eq('is_active', true)
      .maybeSingle();

    if (cu) {
      setUserRole(cu.role);
      setCompany(cu.companies);
      setShowSalary(cu.show_salary ?? false);
      setCanDeletePayroll(cu.can_delete_payroll ?? false);
      const plan = cu.companies?.subscription_plans;
      if (plan) {
        setSubscription({ ...plan, planData: PLANS[plan.code] || PLANS.free });
      }

      const { data: grants } = await supabase
        .from('company_user_modules')
        .select('module')
        .eq('company_id', cu.company_id)
        .eq('user_id', sessionUser.id);
      setUserModuleGrants(grants && grants.length > 0 ? grants.map(g => g.module) : null);
    } else if (!adminRow) {
      // Auth user exists but has no company and is not a platform admin —
      // this is a stale/orphaned session; sign out to force re-registration.
      await supabase.auth.signOut();
      setUser(null);
      setCompany(null);
      setSubscription(null);
      setUserRole(null);
      setIsAdmin(false);
      setShowSalary(false);
      setCanDeletePayroll(false);
      setUserModuleGrants(null);
    } else {
      setShowSalary(!!adminRow); // admins always see salary
      setCanDeletePayroll(!!adminRow);
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
        // PASSWORD_RECOVERY: the reset-password page handles this; don't load company data
        if (event === 'PASSWORD_RECOVERY') {
          setUser(session?.user ?? null);
          setLoading(false);
          return;
        }
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadUserData(session.user);
        } else {
          setCompany(null);
          setSubscription(null);
          setUserRole(null);
          setIsAdmin(false);
          setShowSalary(false);
          setCanDeletePayroll(false);
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
    setShowSalary(false);
    setCanDeletePayroll(false);
    setUserModuleGrants(null);
  }

  async function registerCompany({ companyName, email, password, fullName, planId, crNumber, phone, industry, country, countryCode }) {
    registeringRef.current = true;
    let sessionUser = null;

    const clearState = () => {
      setUser(null);
      setCompany(null);
      setSubscription(null);
      setUserRole(null);
      setIsAdmin(false);
      setShowSalary(false);
      setCanDeletePayroll(false);
      setUserModuleGrants(null);
    };

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
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw new Error('This email is already registered. Please log in or use a different email.');
        sessionUser = signInData.user;
      }

      // Step 2: call SECURITY DEFINER RPC — runs as postgres, bypasses all RLS
      const { data: rpcData, error: rpcError } = await supabase.rpc('register_company', {
        p_company_name: companyName,
        p_user_id:      sessionUser.id,
        p_email:        email,
        p_full_name:    fullName || email,
        p_plan_id:      planId,
        p_cr_number:    crNumber    || null,
        p_phone:        phone       || null,
        p_industry:     industry    || null,
        p_country:      country     || null,
        p_country_code: countryCode || null,
      });

      if (rpcError) {
        throw new Error(`Registration RPC failed: ${rpcError.message} (code: ${rpcError.code}, hint: ${rpcError.hint || 'none'})`);
      }

      // Step 3: verify the company_users row is actually visible before proceeding
      // Retry up to 5 times with 400ms gaps to handle any replication lag
      let cu = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data } = await supabase
          .from('company_users')
          .select('company_id, role, companies(id, name, subscription_plans(*))')
          .eq('user_id', sessionUser.id)
          .eq('is_active', true)
          .maybeSingle();
        if (data?.company_id) { cu = data; break; }
        await new Promise(r => setTimeout(r, 400));
      }

      if (!cu) {
        // Capture the exact DB state for diagnosis
        const { data: rawCompany } = await supabase
          .from('companies')
          .select('id, name, email')
          .eq('email', email)
          .maybeSingle();

        const rpcResult = rpcData ? JSON.stringify(rpcData) : 'null';
        throw new Error(
          `Company created (RPC returned: ${rpcResult}) but company_users link is missing. ` +
          `companies row: ${rawCompany ? JSON.stringify(rawCompany) : 'not found'}. ` +
          `User ID: ${sessionUser.id}. Please contact support.`
        );
      }

      // Step 4: populate React state — only reached if company is confirmed in DB
      const plan = cu.companies?.subscription_plans;
      setUser(sessionUser);
      setCompany(cu.companies);
      setUserRole(cu.role);
      if (plan) setSubscription({ ...plan, planData: PLANS[plan.code] || PLANS.free });
      setLoading(false);
    } catch (err) {
      clearState();
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
    showSalary: isAdmin ? true : showSalary,
    canDeletePayroll: isAdmin || userRole === 'admin' ? true : canDeletePayroll,
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
