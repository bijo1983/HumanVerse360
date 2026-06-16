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
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw new Error('This email is already registered. Please log in or use a different email.');
        sessionUser = signInData.user;
      }

      // Step 2: insert company directly — authenticated user, policy allows any authenticated insert
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyName,
          email,
          phone: phone || null,
          cr_number: crNumber || null,
          industry: industry || null,
          country: country || null,
          country_code: countryCode || null,
          subscription_plan_id: planId,
          subscription_status: 'active',
          subscription_start: new Date().toISOString().split('T')[0],
          admin_user_id: sessionUser.id,
        })
        .select('id, name')
        .single();

      if (companyError) throw new Error(`Company creation failed: ${companyError.message} [${companyError.code}]`);

      // Step 3: link user to company — policy allows user_id = auth.uid()
      const { error: cuError } = await supabase
        .from('company_users')
        .insert({
          company_id: company.id,
          user_id: sessionUser.id,
          full_name: fullName || email,
          email,
          role: 'admin',
          is_active: true,
        });

      if (cuError) throw new Error(`User linking failed: ${cuError.message} [${cuError.code}]`);

      // Step 4: seed default departments (non-fatal)
      await supabase.from('departments').insert([
        { name: 'Human Resources', code: 'HR', company_id: company.id },
        { name: 'Finance', code: 'FIN', company_id: company.id },
        { name: 'Operations', code: 'OPS', company_id: company.id },
        { name: 'Management', code: 'MGT', company_id: company.id },
      ]);

      // Step 5: populate React state
      setUser(sessionUser);
      await loadUserData(sessionUser);
      setLoading(false);
    } catch (err) {
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
