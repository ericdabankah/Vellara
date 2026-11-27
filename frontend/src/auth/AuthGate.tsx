import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Building2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type Workspace = {
  id: string;
  name: string;
  businessType: string;
  role: string;
};

type RenderProps = {
  workspace: Workspace;
  workspaces: Workspace[];
  onWorkspaceChange: (workspaceId: string) => void;
  signOut: () => Promise<void>;
};

type Props = {
  children: (props: RenderProps) => ReactNode;
};

type MembershipRow = {
  organization_id: string;
  role: string;
  status: string;
};

type OrganizationRow = {
  id: string;
  name: string;
  status: string;
};

type BusinessProfileRow = {
  organization_id: string;
  business_type: string;
  display_name: string;
};

export default function AuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const selectedWorkspaceId = useRef<string | null>(null);
  const workspaceRequestVersion = useRef(0);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("hotel");
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;
    let authEventVersion = 0;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted || authEventVersion > 0) return;
      if (error) setErrorMessage(error.message);
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      authEventVersion += 1;
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      if (event === "SIGNED_OUT") setRecoveryMode(false);
      setSession(nextSession);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        workspaceRequestVersion.current += 1;
        setWorkspaceLoading(false);
        setWorkspace(null);
        setWorkspaces([]);
        selectedWorkspaceId.current = null;
      }
      setErrorMessage("");
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!supabase || !session?.user.id) return;
    const requestId = ++workspaceRequestVersion.current;
    const isCurrent = () => workspaceRequestVersion.current === requestId;
    setWorkspaceLoading(true);
    setErrorMessage("");

    const membershipResult = await supabase
      .from("organization_memberships")
      .select("organization_id, role, status")
      .eq("user_id", session.user.id)
      .eq("status", "active");

    if (!isCurrent()) return;
    if (membershipResult.error) {
      setErrorMessage(membershipResult.error.message);
      setWorkspaceLoading(false);
      return;
    }

    const memberships = (membershipResult.data ?? []) as MembershipRow[];
    if (memberships.length === 0) {
      setWorkspaces([]);
      setWorkspace(null);
      selectedWorkspaceId.current = null;
      setWorkspaceLoading(false);
      return;
    }

    const organizationIds = memberships.map((membership) => membership.organization_id);
    const organizationResult = await supabase
      .from("organizations")
      .select("id, name, status")
      .in("id", organizationIds)
      .eq("status", "active");

    if (!isCurrent()) return;
    if (organizationResult.error) {
      setErrorMessage(organizationResult.error.message);
      setWorkspaceLoading(false);
      return;
    }

    const organizations = (organizationResult.data ?? []) as OrganizationRow[];
    if (organizations.length === 0) {
      setWorkspaces([]);
      setWorkspace(null);
      selectedWorkspaceId.current = null;
      setWorkspaceLoading(false);
      return;
    }

    const businessResult = await supabase
      .from("business_profiles")
      .select("organization_id, business_type, display_name")
      .in("organization_id", organizations.map((organization) => organization.id));

    if (!isCurrent()) return;
    if (businessResult.error) {
      setErrorMessage(businessResult.error.message);
      setWorkspaceLoading(false);
      return;
    }

    const businessByOrganization = new Map(
      ((businessResult.data ?? []) as BusinessProfileRow[]).map((business) => [business.organization_id, business]),
    );
    const membershipByOrganization = new Map(memberships.map((membership) => [membership.organization_id, membership]));
    const availableWorkspaces = organizations
      .map((organization) => {
        const business = businessByOrganization.get(organization.id);
        const membership = membershipByOrganization.get(organization.id);
        return {
          id: organization.id,
          name: business?.display_name || organization.name,
          businessType: business?.business_type || "hotel",
          role: membership?.role || "member",
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));

    setWorkspaces(availableWorkspaces);
    const selectedWorkspace = availableWorkspaces.find((item) => item.id === selectedWorkspaceId.current)
      ?? availableWorkspaces[0];
    selectedWorkspaceId.current = selectedWorkspace.id;
    setWorkspace(selectedWorkspace);
    setWorkspaceLoading(false);
  }, [session?.user.id]);

  useEffect(() => {
    if (session) void loadWorkspace();
    else setWorkspace(null);
  }, [session, loadWorkspace]);

  function handleWorkspaceChange(workspaceId: string) {
    const nextWorkspace = workspaces.find((item) => item.id === workspaceId);
    if (!nextWorkspace) return;
    selectedWorkspaceId.current = nextWorkspace.id;
    setWorkspace(nextWorkspace);
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (mode === "signup" && password !== confirmPassword) {
      setErrorMessage("Your passwords do not match.");
      return;
    }
    setSubmitting(true);
    setNotice("");
    setErrorMessage("");

    const result = mode === "signup"
      ? await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            // Return the owner to this deployed Owner Desk after email confirmation.
            emailRedirectTo: window.location.origin,
          },
        })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (result.error) {
      setErrorMessage(result.error.message);
    } else if (mode === "signup" && !result.data.session) {
      setNotice("Your account has been created. Check your email to confirm your address, then sign in.");
    } else {
      setNotice(mode === "signup" ? "Account created. Let's set up your property." : "Signed in successfully.");
      if (result.data.session) setSession(result.data.session);
    }
    setSubmitting(false);
  }

  async function requestPasswordReset() {
    if (!supabase) return;
    if (!email.trim()) {
      setErrorMessage("Enter your email address first.");
      return;
    }
    setSubmitting(true);
    setErrorMessage("");
    setNotice("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    if (error) setErrorMessage(error.message);
    else setNotice("If an account exists for that address, a password reset link has been sent.");
    setSubmitting(false);
  }

  async function updateRecoveredPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (password.length < 8 || password !== confirmPassword) {
      setErrorMessage(password.length < 8 ? "Use at least 8 characters." : "Your passwords do not match.");
      return;
    }
    setSubmitting(true);
    setErrorMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setErrorMessage(error.message);
    else {
      setRecoveryMode(false);
      setPassword("");
      setConfirmPassword("");
      setNotice("Your password has been updated. You can continue to your workspace.");
    }
    setSubmitting(false);
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setErrorMessage("");
    const { data, error } = await supabase.rpc("create_organization", {
      p_name: businessName.trim(),
      p_business_type: businessType,
      p_timezone: "Africa/Accra",
      p_currency: "GHS",
    });

    if (error) {
      setErrorMessage(error.message);
    } else if (!data) {
      setErrorMessage("The workspace could not be created. Please try again.");
    } else {
      await loadWorkspace();
    }
    setSubmitting(false);
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setErrorMessage(error.message);
  }

  if (!isSupabaseConfigured || !supabase) {
    return (
      <div className="auth-screen">
        <section className="auth-card">
          <div className="auth-brand"><b>V</b><span>VELLARA<small>OWNER DESK</small></span></div>
          <h1>Connect your workspace</h1>
          <p>Add the Supabase project URL and publishable key to <code>frontend/.env.local</code> to enable secure sign-in.</p>
          <small className="auth-footnote">No service-role key belongs in the browser.</small>
        </section>
      </div>
    );
  }

  if (authLoading || (session && workspaceLoading)) {
    return <div className="auth-screen"><div className="auth-loading"><span />Preparing your secure workspace…</div></div>;
  }

  if (session && recoveryMode) {
    return (
      <div className="auth-screen">
        <section className="auth-card">
          <div className="auth-brand"><b>V</b><span>VELLARA<small>OWNER DESK</small></span></div>
          <div className="auth-eyebrow">ACCOUNT SECURITY</div>
          <h1>Choose a new password.</h1>
          <p>Set a new password for your VELLARA owner account.</p>
          <form onSubmit={updateRecoveredPassword} className="auth-form">
            <label><span>New password</span><div><LockKeyhole/><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required placeholder="At least 8 characters" /></div></label>
            <label><span>Confirm new password</span><div><LockKeyhole/><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required placeholder="Repeat your password" /></div></label>
            {errorMessage && <div className="auth-error" role="alert">{errorMessage}</div>}
            {notice && <div className="auth-notice" role="status">{notice}</div>}
            <button className="auth-submit" disabled={submitting}>{submitting ? "Updating…" : "Update password"}</button>
          </form>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-screen">
        <section className="auth-card">
          <div className="auth-brand"><b>V</b><span>VELLARA<small>OWNER DESK</small></span></div>
          <div className="auth-eyebrow">THE FRONT DESK, REIMAGINED</div>
          <h1>{mode === "signin" ? "Welcome back." : "Create your account."}</h1>
          <p>{mode === "signin" ? "Sign in to manage your property and guest experience." : "Start with your account. Your property workspace comes next."}</p>
          <form onSubmit={handleAuth} className="auth-form">
            {mode === "signup" && <label><span>Your name</span><div><UserRound/><input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required placeholder="Full name" /></div></label>}
            {mode === "signup" && <label><span>Confirm password</span><div><LockKeyhole/><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required placeholder="Repeat your password" /></div></label>}
            <label><span>Email address</span><div><Mail/><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="you@example.com" /></div></label>
            <label><span>Password</span><div><LockKeyhole/><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required placeholder="At least 8 characters" /></div></label>
            {errorMessage && <div className="auth-error" role="alert">{errorMessage}</div>}
            {notice && <div className="auth-notice" role="status">{notice}</div>}
            <button className="auth-submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
          </form>
          {mode === "signin" && <div className="auth-forgot"><button type="button" onClick={() => void requestPasswordReset()} disabled={submitting}>Forgot password?</button></div>}
          <div className="auth-switch">{mode === "signin" ? "New to VELLARA?" : "Already have an account?"} <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setNotice(""); setErrorMessage(""); }}>{mode === "signin" ? "Create an account" : "Sign in"}</button></div>
          <small className="auth-footnote">Secure access powered by Supabase.</small>
        </section>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="auth-screen">
        <section className="auth-card">
          <div className="auth-brand"><b>V</b><span>VELLARA<small>OWNER DESK</small></span></div>
          <div className="auth-eyebrow">YOUR BUSINESS, ONE DESK</div>
          <h1>Set up your workspace.</h1>
          <p>Tell us about the business VELLARA will help you run. You can complete the finer details later.</p>
          <form onSubmit={createWorkspace} className="auth-form">
            <label><span>Business name</span><div><Building2/><input value={businessName} onChange={(event) => setBusinessName(event.target.value)} required minLength={2} maxLength={120} placeholder="e.g. The Garden Hotel" /></div></label>
            <label><span>Business type</span><select value={businessType} onChange={(event) => setBusinessType(event.target.value)}><option value="hotel">Hotel / hospitality</option><option value="real_estate">Real estate</option><option value="other">Other</option></select></label>
            {errorMessage && <div className="auth-error" role="alert">{errorMessage}</div>}
            <button className="auth-submit" disabled={submitting}>{submitting ? "Creating workspace…" : "Create workspace"}</button>
          </form>
          <div className="auth-switch"><button onClick={() => void signOut()}>Sign out</button></div>
          <small className="auth-footnote">Your workspace is isolated from other businesses.</small>
        </section>
      </div>
    );
  }

  return <>{children({ workspace, workspaces, onWorkspaceChange: handleWorkspaceChange, signOut })}</>;
}
