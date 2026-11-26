import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Activity, ArrowDownLeft, ArrowUpRight, BedDouble, Bell, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, CreditCard, Headphones, LayoutDashboard, LogOut, Menu, MessageSquare, Phone, Plus, RefreshCw, Search, Settings, ShieldCheck, Sparkles, Users, X, Zap } from "lucide-react";
import AuthGate from "./auth/AuthGate";
import { supabase } from "./lib/supabase";

type Workspace = { id: string; name: string; businessType: string; role: string };
type Section = "Overview" | "Properties" | "Calls" | "Reservations" | "Guests" | "Rooms" | "Numbers" | "AI Receptionists" | "Plans" | "Settings";
type CallRow = { id: string; status: string; direction: string; caller_e164: string | null; guest_name: string | null; started_at: string; duration_seconds: number | null; outcome: string | null; summary: string };
type GuestRow = { id: string; full_name: string; phone_e164: string | null; email: string | null; notes: string; source: string; created_at: string };
type RoomRow = { id: string; room_number: string; room_type: string; capacity: number; status: string; nightly_rate_minor: number | null; currency: string; floor_label: string | null };
type PropertyRow = { id: string; vertical: "hospitality" | "real_estate"; name: string; slug: string; description: string; status: string; city: string | null; region: string | null; timezone_override: string | null; currency_override: string | null; created_at: string };
type ReservationRow = { id: string; guest_id: string | null; room_id: string | null; confirmation_code: string | null; status: string; source: string; arrival_date: string; departure_date: string; adults: number; children: number; total_amount_minor: number | null; currency: string; special_requests: string; created_at: string };
type PhoneRow = { id: string; phone_e164: string; label: string; status: string; verification_status: string; phone_number_channels: { channel: string; status: string }[] };
type ReceptionistRow = { id: string; display_name: string; description: string; status: string; language_code: string; timezone: string };
type RouteRow = { id: string; phone_number_id: string; receptionist_instance_id: string; channel: string; priority: number; is_enabled: boolean };
type PlanRow = { id: string; code: string; name: string; description: string; is_available_for_purchase: boolean; display_order: number };
type EntitlementRow = { plan_id: string; phone_number_limit: number | null; receptionist_instance_limit: number | null; concurrent_call_limit: number | null; configuration_status: string; custom_entitlements: boolean };
type PriceRow = { id: string; plan_id: string; currency: string; billing_interval: string; amount_minor: number };
type ActivityRow = { id: string; event_type: string; summary: string; created_at: string };
type BusinessProfile = { organization_id: string; business_type: string; display_name: string; legal_name: string | null; description: string | null; contact_email: string | null; contact_phone_e164: string | null; website_url: string | null; address_line_1: string | null; city: string | null; region: string | null; timezone: string; currency: string };
type DeskData = { calls: CallRow[]; reservations: ReservationRow[]; guests: GuestRow[]; rooms: RoomRow[]; phones: PhoneRow[]; routes: RouteRow[]; receptionists: ReceptionistRow[]; plans: PlanRow[]; entitlements: EntitlementRow[]; prices: PriceRow[]; activities: ActivityRow[]; subscription: { id: string; status: string; plan_id: string; current_period_end: string | null } | null; profile: BusinessProfile | null; metrics: { calls: number; reservations: number; guests: number; occupied: number; rooms: number } };
type ModalKind = "guest" | "room" | "reservation" | null;

const nav: { name: Section; icon: ReactNode; group: string }[] = [
  { name: "Overview", icon: <LayoutDashboard />, group: "workspace" },
  { name: "Properties", icon: <BedDouble />, group: "workspace" },
  { name: "Calls", icon: <Phone />, group: "workspace" },
  { name: "Reservations", icon: <CalendarDays />, group: "workspace" },
  { name: "Guests", icon: <Users />, group: "workspace" },
  { name: "Rooms", icon: <BedDouble />, group: "workspace" },
  { name: "Numbers", icon: <MessageSquare />, group: "manage" },
  { name: "AI Receptionists", icon: <Headphones />, group: "manage" },
  { name: "Plans", icon: <CreditCard />, group: "manage" },
  { name: "Settings", icon: <Settings />, group: "account" },
];
const blank: DeskData = { calls: [], reservations: [], guests: [], rooms: [], phones: [], routes: [], receptionists: [], plans: [], entitlements: [], prices: [], activities: [], subscription: null, profile: null, metrics: { calls: 0, reservations: 0, guests: 0, occupied: 0, rooms: 0 } };

function startOfAccraDay() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Accra", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (key: string) => parts.find((part) => part.type === key)?.value ?? "00";
  return new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")))).toISOString();
}
function dateText(value: string | null | undefined) { return value ? new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Accra" }).format(new Date(value)) : "Not set"; }
function timeText(value: string | null | undefined) { return value ? new Intl.DateTimeFormat("en-GH", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" }).format(new Date(value)) : "—"; }
function cash(value: number | null | undefined, currency = "GHS") { return value == null ? "Not set" : new Intl.NumberFormat("en-GH", { style: "currency", currency, maximumFractionDigits: 2 }).format(value / 100); }
function initials(value: string) { return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "V"; }
function pill(status: string) { return "status-pill status-" + status.toLowerCase().replace(/[^a-z]+/g, "-"); }

export default function App() {
  return <AuthGate>{({ workspace, signOut }) => <OwnerDesk workspace={workspace} signOut={signOut} />}</AuthGate>;
}

function OwnerDesk({ workspace, signOut }: { workspace: Workspace; signOut: () => Promise<void> }) {
  const [active, setActive] = useState<Section>("Overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [data, setData] = useState<DeskData>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<ModalKind>(null);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [propertySchemaReady, setPropertySchemaReady] = useState(false);
  const [propertySchemaError, setPropertySchemaError] = useState("");
  const [propertyModal, setPropertyModal] = useState(false);

  const reload = useCallback(async (quiet = false) => {
    if (!supabase) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    const today = startOfAccraDay();
    const propertyDb = supabase as unknown as SupabaseClient<any>;
    const [calls, reservations, guests, rooms, phones, routes, receptionists, plans, entitlements, prices, activities, subscription, profile, callCount, reservationCount, guestCount, roomCount, occupiedCount] = await Promise.all([
      supabase.from("calls").select("id,status,direction,caller_e164,guest_name,started_at,duration_seconds,outcome,summary").eq("organization_id", workspace.id).order("started_at", { ascending: false }).limit(100),
      supabase.from("reservations").select("id,guest_id,room_id,confirmation_code,status,source,arrival_date,departure_date,adults,children,total_amount_minor,currency,special_requests,created_at").eq("organization_id", workspace.id).order("arrival_date", { ascending: true }).limit(200),
      supabase.from("guests").select("id,full_name,phone_e164,email,notes,source,created_at").eq("organization_id", workspace.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("rooms").select("id,room_number,room_type,capacity,status,nightly_rate_minor,currency,floor_label").eq("organization_id", workspace.id).order("room_number", { ascending: true }).limit(500),
      supabase.from("organization_phone_numbers").select("id,phone_e164,label,status,verification_status,phone_number_channels(channel,status)").eq("organization_id", workspace.id).order("created_at", { ascending: false }),
      supabase.from("receptionist_number_routes").select("id,phone_number_id,receptionist_instance_id,channel,priority,is_enabled").eq("organization_id", workspace.id).order("priority", { ascending: true }),
      supabase.from("receptionist_instances").select("id,display_name,description,status,language_code,timezone").eq("organization_id", workspace.id).order("created_at", { ascending: true }),
      supabase.from("subscription_plans").select("id,code,name,description,is_available_for_purchase,display_order").eq("is_listed", true).order("display_order", { ascending: true }),
      supabase.from("subscription_plan_entitlements").select("plan_id,phone_number_limit,receptionist_instance_limit,concurrent_call_limit,configuration_status,custom_entitlements"),
      supabase.from("subscription_prices").select("id,plan_id,currency,billing_interval,amount_minor").eq("is_active", true),
      supabase.from("activity_events").select("id,event_type,summary,created_at").eq("organization_id", workspace.id).order("created_at", { ascending: false }).limit(12),
      supabase.from("organization_subscriptions").select("id,status,plan_id,current_period_end").eq("organization_id", workspace.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("business_profiles").select("organization_id,business_type,display_name,legal_name,description,contact_email,contact_phone_e164,website_url,address_line_1,city,region,timezone,currency").eq("organization_id", workspace.id).maybeSingle(),
      supabase.from("calls").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id).gte("started_at", today),
      supabase.from("reservations").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id).gte("created_at", today),
      supabase.from("guests").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id).gte("created_at", today),
      supabase.from("rooms").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id),
      supabase.from("rooms").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id).eq("status", "occupied"),
    ]);
    const [propertyRows, moduleRows] = await Promise.all([
      propertyDb.from("properties").select("id,vertical,name,slug,description,status,city,region,timezone_override,currency_override,created_at").eq("organization_id", workspace.id).order("created_at", { ascending: false }),
      propertyDb.from("organization_modules").select("module_key,is_enabled").eq("organization_id", workspace.id),
    ]);
    if (propertyRows.error || moduleRows.error) {
      setPropertySchemaReady(false);
      setPropertySchemaError(propertyRows.error?.message || moduleRows.error?.message || "Property schema is unavailable.");
    } else {
      setPropertySchemaReady(true);
      setPropertySchemaError("");
      setProperties((propertyRows.data ?? []) as PropertyRow[]);
    }
    const failed = [calls.error, reservations.error, guests.error, rooms.error, phones.error, routes.error, receptionists.error, plans.error, entitlements.error, prices.error, activities.error, subscription.error, profile.error, callCount.error, reservationCount.error, guestCount.error, roomCount.error, occupiedCount.error].find(Boolean);
    if (failed) setError(failed.message);
    else setData({
      calls: (calls.data ?? []) as CallRow[], reservations: (reservations.data ?? []) as ReservationRow[],
      guests: (guests.data ?? []) as GuestRow[], rooms: (rooms.data ?? []) as RoomRow[],
      phones: (phones.data ?? []) as unknown as PhoneRow[], routes: (routes.data ?? []) as RouteRow[], receptionists: (receptionists.data ?? []) as ReceptionistRow[],
      plans: (plans.data ?? []) as PlanRow[], entitlements: (entitlements.data ?? []) as EntitlementRow[],
      prices: (prices.data ?? []) as PriceRow[], activities: (activities.data ?? []) as ActivityRow[],
      subscription: subscription.data as DeskData["subscription"], profile: profile.data as BusinessProfile | null,
      metrics: { calls: callCount.count ?? 0, reservations: reservationCount.count ?? 0, guests: guestCount.count ?? 0, rooms: roomCount.count ?? 0, occupied: occupiedCount.count ?? 0 },
    });
    setLoading(false); setRefreshing(false);
  }, [workspace.id]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel("owner-desk-" + workspace.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "calls", filter: "organization_id=eq." + workspace.id }, () => void reload(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: "organization_id=eq." + workspace.id }, () => void reload(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "guests", filter: "organization_id=eq." + workspace.id }, () => void reload(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: "organization_id=eq." + workspace.id }, () => void reload(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "properties", filter: "organization_id=eq." + workspace.id }, () => void reload(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_events", filter: "organization_id=eq." + workspace.id }, () => void reload(true))
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [workspace.id, reload]);

  const activeCall = useMemo(() => data.calls.find((call) => call.status === "ringing" || call.status === "in_progress"), [data.calls]);
  const occupancy = data.metrics.rooms ? Math.round(data.metrics.occupied * 100 / data.metrics.rooms) : 0;

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !modal) return;
    const form = new FormData(event.currentTarget);
    setSaving(true); setError(""); setNotice("");
    let result: { error: { message: string } | null };
    if (modal === "guest") {
      result = await supabase.from("guests").insert({
        organization_id: workspace.id, full_name: String(form.get("full_name") ?? "").trim(),
        phone_e164: String(form.get("phone_e164") ?? "").trim() || null,
        email: String(form.get("email") ?? "").trim() || null, notes: String(form.get("notes") ?? "").trim(), source: "owner_desk",
      });
    } else if (modal === "room") {
      const rate = String(form.get("nightly_rate") ?? "").trim();
      result = await supabase.from("rooms").insert({
        organization_id: workspace.id, room_number: String(form.get("room_number") ?? "").trim(),
        room_type: String(form.get("room_type") ?? "Standard").trim(), capacity: Number(form.get("capacity") ?? 2),
        status: String(form.get("status") ?? "available"), nightly_rate_minor: rate ? Math.round(Number(rate) * 100) : null,
        currency: data.profile?.currency ?? "GHS", floor_label: String(form.get("floor_label") ?? "").trim() || null,
      });
    } else {
      result = await supabase.from("reservations").insert({
        organization_id: workspace.id, guest_id: String(form.get("guest_id") ?? "") || null,
        room_id: String(form.get("room_id") ?? "") || null, arrival_date: String(form.get("arrival_date") ?? ""),
        departure_date: String(form.get("departure_date") ?? ""), adults: Number(form.get("adults") ?? 1),
        children: Number(form.get("children") ?? 0), status: "pending", source: "owner_desk",
        special_requests: String(form.get("special_requests") ?? "").trim(), currency: data.profile?.currency ?? "GHS",
      });
    }
    if (result.error) setError(result.error.message);
    else { setNotice(modal === "guest" ? "Guest added." : modal === "room" ? "Room added." : "Reservation created."); setModal(null); await reload(true); }
    setSaving(false);
  }

  async function updateStatus(table: "rooms" | "reservations", id: string, status: string) {
    if (!supabase) return;
    setError(""); setNotice("");
    const result = await supabase.from(table).update({ status }).eq("organization_id", workspace.id).eq("id", id).select("id").maybeSingle();
    if (result.error) setError(result.error.message); else if (!result.data) setError("This change was not applied. Your workspace role may not have permission."); else { setNotice("Changes saved."); await reload(true); }
  }

  async function createProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const vertical = String(form.get("vertical") ?? "hospitality") as PropertyRow["vertical"];
    const name = String(form.get("name") ?? "").trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const propertyDb = supabase as unknown as SupabaseClient<any>;
    setSaving(true); setError(""); setNotice("");
    const moduleResult = await propertyDb.from("organization_modules").upsert({ organization_id: workspace.id, module_key: vertical, is_enabled: true, disabled_at: null }, { onConflict: "organization_id,module_key" });
    if (moduleResult.error) {
      setError(moduleResult.error.message); setSaving(false); return;
    }
    const result = await propertyDb.from("properties").insert({
      organization_id: workspace.id, vertical, name, slug,
      description: String(form.get("description") ?? "").trim(),
      city: String(form.get("city") ?? "").trim() || null,
      region: String(form.get("region") ?? "").trim() || null,
      timezone_override: String(form.get("timezone_override") ?? "").trim() || null,
      currency_override: String(form.get("currency_override") ?? "").trim() || null,
    }).select("id").maybeSingle();
    if (result.error) setError(result.error.message);
    else if (!result.data) setError("The property was not created. Check your workspace permissions.");
    else { setNotice("Property created. Its currency and timezone inherit your workspace defaults unless overridden."); setPropertyModal(false); await reload(true); }
    setSaving(false);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    setSaving(true); setError(""); setNotice("");
    const result = await supabase.from("business_profiles").update({
      display_name: String(form.get("display_name") ?? "").trim(), business_type: String(form.get("business_type") ?? "hotel"),
      legal_name: String(form.get("legal_name") ?? "").trim() || null, description: String(form.get("description") ?? "").trim() || null,
      contact_email: String(form.get("contact_email") ?? "").trim() || null, contact_phone_e164: String(form.get("contact_phone_e164") ?? "").trim() || null,
      website_url: String(form.get("website_url") ?? "").trim() || null, address_line_1: String(form.get("address_line_1") ?? "").trim() || null,
      city: String(form.get("city") ?? "").trim() || null, region: String(form.get("region") ?? "").trim() || null,
    }).eq("organization_id", workspace.id).select("organization_id").maybeSingle();
    if (result.error) setError(result.error.message); else if (!result.data) setError("Your workspace role cannot update business settings."); else { setNotice("Business profile updated."); await reload(true); }
    setSaving(false);
  }

  return <div className="app-shell">
    <aside className={mobileMenu ? "sidebar sidebar-open" : "sidebar"}>
      <div className="brand-lockup"><div className="brand-mark">V</div><div><strong>VELLARA</strong><span>OWNER DESK</span></div><button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X /></button></div>
      <div className="workspace-switcher"><div className="workspace-avatar">{initials(workspace.name)}</div><div className="workspace-copy"><strong>{workspace.name}</strong><span>{workspace.businessType.replace("_", " ")}</span></div><ChevronDown size={15} /></div>
      <div className="nav-section"><span>WORKSPACE</span>{nav.filter((item) => item.group === "workspace").map((item) => <button key={item.name} className={active === item.name ? "nav-link nav-active" : "nav-link"} onClick={() => { setActive(item.name); setMobileMenu(false); }}>{item.icon}{item.name}</button>)}</div>
      <div className="nav-section"><span>CONFIGURATION</span>{nav.filter((item) => item.group === "manage").map((item) => <button key={item.name} className={active === item.name ? "nav-link nav-active" : "nav-link"} onClick={() => { setActive(item.name); setMobileMenu(false); }}>{item.icon}{item.name}</button>)}</div>
      <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={16} /><span><b>Workspace protected</b><small>Tenant-isolated access</small></span></div><button className={active === "Settings" ? "nav-link nav-active" : "nav-link"} onClick={() => { setActive("Settings"); setMobileMenu(false); }}><Settings />Settings</button><div className="profile-strip"><div className="profile-avatar">{initials(workspace.name)}</div><div><b>{workspace.name}</b><small>{workspace.role}</small></div><button className="icon-button" onClick={() => void signOut()} aria-label="Sign out"><LogOut size={17} /></button></div></div>
    </aside>
    {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation" />}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu /></button><span>Owner Desk</span><ChevronRight size={14} /><b>{active}</b></div><div className="topbar-right"><span className="secure-label"><i /> Secure workspace</span><button className="icon-button" onClick={() => void reload(true)} title="Refresh data" aria-label="Refresh data"><RefreshCw className={refreshing ? "spin" : ""} size={17} /></button><span className="icon-button" aria-hidden="true"><Bell size={18} /></span><div className="topbar-avatar">{initials(workspace.name)}</div></div></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">{active === "Overview" || active === "Properties" ? "PROPERTY OPERATIONS" : "OWNER WORKSPACE"}</div><h1>{pageTitle(active)}</h1><p>{pageDescription(active, workspace.name)}</p></div><div className="heading-actions"><span className="today-label"><CalendarDays size={15} />{new Intl.DateTimeFormat("en-GH", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Accra" }).format(new Date())}</span>{active === "Properties" && <button className="primary-button" onClick={() => setPropertyModal(true)}><Plus size={16} />Add property</button>}{active === "Guests" && <button className="primary-button" onClick={() => setModal("guest")}><Plus size={16} />Add guest</button>}{active === "Rooms" && <button className="primary-button" onClick={() => setModal("room")}><Plus size={16} />Add room</button>}{active === "Reservations" && <button className="primary-button" onClick={() => setModal("reservation")}><Plus size={16} />New reservation</button>}</div></div>
        {error && <div className="inline-alert alert-error" role="alert"><CircleHelp size={16} />{error}<button onClick={() => setError("")} aria-label="Dismiss"><X size={14} /></button></div>}
        {notice && <div className="inline-alert alert-success" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}
        {loading ? <div className="loading-panel"><span className="loader" />Loading your workspace data…</div> : <>
          {active === "Overview" && <Overview data={data} activeCall={activeCall} occupancy={occupancy} onNavigate={setActive} />}
          {active === "Properties" && <PropertiesPage properties={properties} profile={data.profile} schemaReady={propertySchemaReady} schemaError={propertySchemaError} onAdd={() => setPropertyModal(true)} />}
          {active === "Calls" && <CallsPage calls={data.calls} />}
          {active === "Reservations" && <ReservationsPage reservations={data.reservations} guests={data.guests} rooms={data.rooms} onStatus={updateStatus} />}
          {active === "Guests" && <GuestsPage guests={data.guests} />}
          {active === "Rooms" && <RoomsPage rooms={data.rooms} onStatus={updateStatus} />}
          {active === "Numbers" && <NumbersPage phones={data.phones} routes={data.routes} receptionists={data.receptionists} />}
          {active === "AI Receptionists" && <ReceptionistsPage instances={data.receptionists} routes={data.routes} phones={data.phones} />}
          {active === "Plans" && <PlansPage plans={data.plans} entitlements={data.entitlements} prices={data.prices} subscription={data.subscription} />}
          {active === "Settings" && <SettingsPage profile={data.profile} saving={saving} onSubmit={saveSettings} />}
        </>}
        <footer className="page-footer"><span>VELLARA OWNER DESK</span><span>Thoughtful hospitality. Clear operations.</span></footer>
      </div>
    </main>
    {modal && <RecordModal kind={modal} guests={data.guests} rooms={data.rooms} saving={saving} onClose={() => setModal(null)} onSubmit={createRecord} />}
    {propertyModal && <PropertyModal saving={saving} onClose={() => setPropertyModal(false)} onSubmit={createProperty} />}
  </div>;
}

function pageTitle(section: Section) {
  const titles: Record<Section, string> = { Overview: "Your desk, at a glance.", Properties: "Your properties", Calls: "Call activity", Reservations: "Reservations", Guests: "Guest directory", Rooms: "Room management", Numbers: "Connected numbers", "AI Receptionists": "Your AI receptionists", Plans: "Plans & subscription", Settings: "Business settings" };
  return titles[section];
}
function pageDescription(section: Section, name: string) {
  const descriptions: Record<Section, string> = { Overview: "A live view of " + name + " and its guest experience.", Properties: "Manage each location, its operating vertical, and inherited business settings.", Calls: "Review conversations handled by VELLARA.", Reservations: "Track enquiries, upcoming stays, and reservation status.", Guests: "Keep guest contact details and notes in one secure place.", Rooms: "Manage room inventory and availability status.", Numbers: "Manage the phone identities and channels connected to your workspace.", "AI Receptionists": "Configure independent receptionist instances and routing.", Plans: "Understand your subscription, included capacity, and billing status.", Settings: "Keep your business details accurate across the Owner Desk." };
  return descriptions[section];
}
function Overview({ data, activeCall, occupancy, onNavigate }: { data: DeskData; activeCall?: CallRow; occupancy: number; onNavigate: (section: Section) => void }) {
  const metrics = [
    { label: "Calls today", value: data.metrics.calls, hint: "Recorded call sessions", icon: <Phone /> },
    { label: "Reservations today", value: data.metrics.reservations, hint: "Created in this workspace", icon: <CalendarDays /> },
    { label: "Room occupancy", value: data.metrics.rooms ? occupancy + "%" : "—", hint: data.metrics.occupied + " of " + data.metrics.rooms + " rooms occupied", icon: <BedDouble /> },
    { label: "New guests today", value: data.metrics.guests, hint: "Guest profiles created today", icon: <Users /> },
  ];
  return <>
    <section className="metric-grid">{metrics.map((item) => <article className="metric-card" key={item.label}><div className="metric-top"><span>{item.label}</span><i>{item.icon}</i></div><strong>{item.value}</strong><small>{item.hint}</small></article>)}</section>
    <div className="overview-grid">
      <section className="surface call-panel"><div className="surface-heading"><div><span className="eyebrow">LIVE RECEPTION</span><h2>{activeCall?.status === "ringing" ? "Incoming call" : activeCall ? "Call in progress" : "Incoming call"}</h2></div><span className={activeCall ? "connection-state connected" : "connection-state"}><i />{activeCall ? activeCall.status.replace("_", " ") : "VOICE CONNECTION PENDING"}</span></div>
        <div className={activeCall ? activeCall.status === "ringing" ? "call-stage call-stage-active call-stage-ringing" : "call-stage call-stage-active" : "call-stage"}><div className="call-orbit" /><div className="call-stage-content"><div className="headset-icon"><Headphones /></div><span className="call-kicker">{activeCall?.status === "ringing" ? "INCOMING CALL · RINGING" : activeCall ? "LIVE CALL SESSION" : "RECEPTION IS READY"}</span><h3>{activeCall ? activeCall.guest_name || activeCall.caller_e164 || "Guest calling" : "Ready for your next guest"}</h3><p>{activeCall ? "Started " + timeText(activeCall.started_at) + ". " + (activeCall.summary || "The backend is reporting this live session.") : "When the voice provider is connected, live calls and AI activity will appear here. Call controls remain inactive until a verified call-control service is available."}</p><div className="call-actions"><button className="call-answer" disabled title="Call control is not connected yet">Answer</button><button className="call-decline" disabled title="Call control is not connected yet">Decline</button></div></div></div>
        <div className="call-panel-footer"><span><i />AI receptionist</span><b>VELLARA AI</b></div>
      </section>
      <section className="surface activity-panel"><div className="surface-heading"><div><span className="eyebrow">WORKSPACE FEED</span><h2>Recent activity</h2></div><Activity size={18} /></div>
        {data.activities.length ? <div className="activity-list">{data.activities.slice(0, 7).map((item) => <div className="activity-row" key={item.id}><div className="activity-symbol"><Zap size={15} /></div><div><b>{item.summary}</b><small>{item.event_type.replaceAll("_", " ")}</small></div><time>{timeText(item.created_at)}</time></div>)}</div> : <EmptyState title="No activity yet" description="Calls, reservations, and guest updates will appear here as your workspace receives real activity." />}
      </section>
    </div>
    <section className="quick-grid"><button className="quick-card" onClick={() => onNavigate("Calls")}><span className="quick-icon"><Phone /></span><span><b>Review calls</b><small>{data.calls.length} recent call records</small></span><ChevronRight /></button><button className="quick-card" onClick={() => onNavigate("Reservations")}><span className="quick-icon"><CalendarDays /></span><span><b>Manage reservations</b><small>{data.reservations.length} reservation records</small></span><ChevronRight /></button><button className="quick-card" onClick={() => onNavigate("AI Receptionists")}><span className="quick-icon"><Sparkles /></span><span><b>AI receptionists</b><small>{data.receptionists.length} configured instances</small></span><ChevronRight /></button></section>
  </>;
}

function PropertiesPage({ properties, profile, schemaReady, schemaError, onAdd }: { properties: PropertyRow[]; profile: BusinessProfile | null; schemaReady: boolean; schemaError: string; onAdd: () => void }) {
  const hospitality = properties.filter((property) => property.vertical === "hospitality");
  const realEstate = properties.filter((property) => property.vertical === "real_estate");
  if (!schemaReady) return <section className="surface property-schema-note"><div className="empty-icon"><BedDouble /></div><h2>Property foundation is not active yet</h2><p>The Owner Desk is ready for this module, but the connected database does not expose the new property tables yet. The migration is being reviewed and has not been applied to the live database.</p><small>{schemaError}</small></section>;
  return <div className="property-management">
    <section className="property-summary-grid">
      <article className="metric-card"><div className="metric-top"><span>All properties</span><i><BedDouble /></i></div><strong>{properties.length}</strong><small>Across enabled business verticals</small></article>
      <article className="metric-card"><div className="metric-top"><span>Hospitality</span><i><BedDouble /></i></div><strong>{hospitality.length}</strong><small>Hotels, serviced apartments and stays</small></article>
      <article className="metric-card"><div className="metric-top"><span>Real estate</span><i><LayoutDashboard /></i></div><strong>{realEstate.length}</strong><small>Sales and rental property portfolios</small></article>
    </section>
    <section className="surface data-surface">
      <div className="table-toolbar"><div><h2>Property portfolio</h2><p>Each property has its own operational space and access boundary.</p></div><button className="secondary-button" onClick={onAdd}><Plus size={15} />Add property</button></div>
      {properties.length ? <div className="property-grid">{properties.map((property) => {
        const currency = property.currency_override || profile?.currency || "GHS";
        const timezone = property.timezone_override || profile?.timezone || "Africa/Accra";
        return <article className="property-card" key={property.id}>
          <div className="property-card-top"><span className="property-vertical">{property.vertical === "hospitality" ? "HOSPITALITY" : "REAL ESTATE"}</span><span className={pill(property.status)}>{property.status}</span></div>
          <h3>{property.name}</h3><p>{property.description || (property.vertical === "hospitality" ? "Hospitality property" : "Real-estate portfolio property")}</p>
          <div className="property-address">{[property.city, property.region].filter(Boolean).join(", ") || "Address not added"}</div>
          <div className="property-settings"><span><small>Currency</small><b>{currency}{property.currency_override ? " · custom" : " · inherited"}</b></span><span><small>Timezone</small><b>{timezone}{property.timezone_override ? " · custom" : " · inherited"}</b></span></div>
        </article>;
      })}</div> : <EmptyState title="Your property portfolio is empty" description="Create your first property. Rooms and room types will be managed inside their hospitality property, not at organization level." />}
    </section>
    <p className="property-footnote">Organization defaults: {profile?.currency || "GHS"} · {profile?.timezone || "Africa/Accra"}. Each property can override either setting independently.</p>
  </div>;
}
function PropertyModal({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card property-modal" onSubmit={onSubmit}>
    <div className="modal-heading"><div><span className="eyebrow">PROPERTY PORTFOLIO</span><h2>Add a property</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X /></button></div>
    <div className="form-grid">
      <Field label="Property name"><input name="name" required minLength={2} maxLength={120} autoFocus placeholder="e.g. The Cedar Residence" /></Field>
      <Field label="Business vertical"><select name="vertical" defaultValue="hospitality"><option value="hospitality">Hospitality</option><option value="real_estate">Real estate</option></select></Field>
      <Field label="City"><input name="city" placeholder="e.g. Accra" /></Field>
      <Field label="Region"><input name="region" placeholder="e.g. Greater Accra" /></Field>
      <Field label="Currency override"><select name="currency_override" defaultValue=""><option value="">Use workspace default ({'GHS'})</option><option value="GHS">GHS · Ghana cedi</option><option value="USD">USD · US dollar</option><option value="GBP">GBP · British pound</option><option value="EUR">EUR · Euro</option><option value="NGN">NGN · Nigerian naira</option></select></Field>
      <Field label="Timezone override"><input name="timezone_override" placeholder="Leave blank to inherit, e.g. Africa/Accra" /></Field>
      <Field label="Description" wide><textarea name="description" rows={3} placeholder="A short description of this property." /></Field>
    </div>
    <p className="property-modal-note">Currency and timezone are inherited from the organization unless you set an override. You can override either one without changing the other.</p>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Creating…" : "Create property"}</button></div>
  </form></div>;
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="table-search"><Search size={16} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>; }
function CallsPage({ calls }: { calls: CallRow[] }) {
  const [query, setQuery] = useState("");
  const rows = calls.filter((call) => (call.guest_name || "").toLowerCase().includes(query.toLowerCase()) || (call.caller_e164 || "").includes(query) || call.status.includes(query.toLowerCase()));
  return <section className="surface data-surface"><div className="table-toolbar"><div><h2>Call history</h2><p>Most recent 100 recorded calls</p></div><SearchInput value={query} onChange={setQuery} placeholder="Search calls" /></div>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Caller</th><th>Direction</th><th>Date & time</th><th>Duration</th><th>Status</th><th>Outcome</th></tr></thead><tbody>{rows.map((call) => <tr key={call.id}><td><b>{call.guest_name || "Unknown caller"}</b><small>{call.caller_e164 || "Number unavailable"}</small></td><td><span className="direction-cell">{call.direction === "inbound" ? <ArrowDownLeft /> : <ArrowUpRight />}{call.direction}</span></td><td>{dateText(call.started_at)}<small>{timeText(call.started_at)}</small></td><td>{call.duration_seconds == null ? "—" : Math.floor(call.duration_seconds / 60) + "m " + call.duration_seconds % 60 + "s"}</td><td><span className={pill(call.status)}>{call.status.replace("_", " ")}</span></td><td>{call.outcome || "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="No calls recorded" description="Call records appear here when the voice backend sends verified call events." />}</section>;
}
function ReservationsPage({ reservations, guests, rooms, onStatus }: { reservations: ReservationRow[]; guests: GuestRow[]; rooms: RoomRow[]; onStatus: (table: "rooms" | "reservations", id: string, status: string) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const rows = reservations.filter((r) => { const guest = guests.find((g) => g.id === r.guest_id); const room = rooms.find((item) => item.id === r.room_id); return ((guest?.full_name || "") + " " + (room?.room_number || "") + " " + (r.confirmation_code || "") + " " + r.status).toLowerCase().includes(query.toLowerCase()); });
  return <section className="surface data-surface"><div className="table-toolbar"><div><h2>Reservation ledger</h2><p>Guest stays and booking requests</p></div><SearchInput value={query} onChange={setQuery} placeholder="Search reservations" /></div>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Guest</th><th>Room</th><th>Stay</th><th>Guests</th><th>Amount</th><th>Status</th><th>Update</th></tr></thead><tbody>{rows.map((r) => { const guest = guests.find((g) => g.id === r.guest_id); const room = rooms.find((item) => item.id === r.room_id); return <tr key={r.id}><td><b>{guest?.full_name || "Guest enquiry"}</b><small>{r.confirmation_code || "No confirmation code"}</small></td><td>{room?.room_number || "Unassigned"}<small>{room?.room_type || "Room pending"}</small></td><td>{dateText(r.arrival_date)}<small>to {dateText(r.departure_date)}</small></td><td>{r.adults} adults, {r.children} children</td><td>{cash(r.total_amount_minor, r.currency)}</td><td><span className={pill(r.status)}>{r.status.replace("_", " ")}</span></td><td><select className="inline-select" value={r.status} onChange={(event) => void onStatus("reservations", r.id, event.target.value)}><option value="inquiry">Inquiry</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="checked_in">Checked in</option><option value="checked_out">Checked out</option><option value="canceled">Canceled</option><option value="no_show">No show</option></select></td></tr>; })}</tbody></table></div> : <EmptyState title="No reservations yet" description="Create your first reservation or wait for a verified receptionist to add one." />}</section>;
}
function GuestsPage({ guests }: { guests: GuestRow[] }) {
  const [query, setQuery] = useState("");
  const rows = guests.filter((g) => (g.full_name + " " + (g.phone_e164 || "") + " " + (g.email || "")).toLowerCase().includes(query.toLowerCase()));
  return <section className="surface data-surface"><div className="table-toolbar"><div><h2>Guest directory</h2><p>Guest records belonging to this workspace</p></div><SearchInput value={query} onChange={setQuery} placeholder="Search guests" /></div>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Guest</th><th>Phone</th><th>Email</th><th>Source</th><th>Added</th></tr></thead><tbody>{rows.map((g) => <tr key={g.id}><td><div className="guest-cell"><span>{initials(g.full_name)}</span><b>{g.full_name}</b></div></td><td>{g.phone_e164 || "—"}</td><td>{g.email || "—"}</td><td><span className="source-label">{g.source.replace("_", " ")}</span></td><td>{dateText(g.created_at)}</td></tr>)}</tbody></table></div> : <EmptyState title="Your guest book is empty" description="Add a guest record or let VELLARA create one from a verified guest interaction." />}</section>;
}
function RoomsPage({ rooms, onStatus }: { rooms: RoomRow[]; onStatus: (table: "rooms" | "reservations", id: string, status: string) => Promise<void> }) {
  return <section className="surface data-surface"><div className="table-toolbar"><div><h2>Room inventory</h2><p>{rooms.length} room records in this workspace</p></div><span className="table-meta">Status updates save immediately</span></div>{rooms.length ? <div className="room-grid">{rooms.map((room) => <article className="room-card" key={room.id}><div className="room-card-top"><div className="room-icon"><BedDouble /></div><span className={pill(room.status)}>{room.status.replace("_", " ")}</span></div><h3>Room {room.room_number}</h3><p>{room.room_type}{room.floor_label ? " · " + room.floor_label : ""}</p><div className="room-meta"><span>{room.capacity} guests</span><b>{cash(room.nightly_rate_minor, room.currency)} <small>/ night</small></b></div><select className="room-status-select" value={room.status} onChange={(event) => void onStatus("rooms", room.id, event.target.value)}><option value="available">Available</option><option value="occupied">Occupied</option><option value="maintenance">Maintenance</option><option value="out_of_service">Out of service</option></select></article>)}</div> : <EmptyState title="No rooms added" description="Add your property's room inventory to start tracking occupancy." />}</section>;
}
function NumbersPage({ phones, routes, receptionists }: { phones: PhoneRow[]; routes: RouteRow[]; receptionists: ReceptionistRow[] }) {
  return <><section className="capacity-banner"><div className="capacity-banner-icon"><Phone /></div><div><b>One number, multiple channels.</b><p>A verified phone number can power voice and WhatsApp together while consuming one number slot.</p></div><span className="capacity-lock"><ShieldCheck size={15} />Backend verification required</span></section><section className="surface data-surface"><div className="table-toolbar"><div><h2>Connected phone numbers</h2><p>{phones.length} registered number identities</p></div><button className="secondary-button" disabled title="Number verification and subscription enforcement are completed by the backend"><Plus size={15} />Add number</button></div>{phones.length ? <div className="number-list">{phones.map((phone) => <article className="number-row" key={phone.id}><div className="number-icon"><Phone /></div><div className="number-main"><b>{phone.label}</b><span>{phone.phone_e164}</span><div className="channel-tags">{phone.phone_number_channels?.map((channel) => <i key={channel.channel}>{channel.channel === "voice" ? <Phone size={12} /> : <MessageSquare size={12} />}{channel.channel}</i>)}</div><div className="route-tags">{routes.filter((route) => route.phone_number_id === phone.id && route.is_enabled).map((route) => <small key={route.id}>{route.channel} → {receptionists.find((item) => item.id === route.receptionist_instance_id)?.display_name || "Receptionist"}</small>)}</div></div><span className={pill(phone.status)}>{phone.status}</span><span className="verification-state">{phone.verification_status}</span></article>)}</div> : <EmptyState title="No phone numbers connected" description="Connect a number after the backend verification and subscription-capacity flow is ready." />}</section></>;
}
function ReceptionistsPage({ instances, routes, phones }: { instances: ReceptionistRow[]; routes: RouteRow[]; phones: PhoneRow[] }) {
  return <><section className="capacity-banner"><div className="capacity-banner-icon"><Sparkles /></div><div><b>Independent AI receptionist instances.</b><p>Each instance can have its own greeting, language, configuration, and routing. Simultaneous calls are controlled by the subscription concurrency limit.</p></div><span className="capacity-lock"><ShieldCheck size={15} />Server-side entitlement</span></section><section className="surface data-surface"><div className="table-toolbar"><div><h2>Receptionist instances</h2><p>{instances.length} configured instances</p></div><button className="secondary-button" disabled title="Instance provisioning is performed by the backend capacity service"><Plus size={15} />Add receptionist</button></div>{instances.length ? <div className="receptionist-grid">{instances.map((item, index) => <article className="receptionist-card" key={item.id}><div className="receptionist-card-top"><div className="receptionist-icon"><Headphones /></div><span className={pill(item.status)}>{item.status}</span></div><span className="eyebrow">RECEPTIONIST {String(index + 1).padStart(2, "0")}</span><h3>{item.display_name}</h3><p>{item.description || "A dedicated AI receptionist for this workspace."}</p><div className="receptionist-meta"><span>{item.language_code}</span><span>{item.timezone}</span></div><div className="route-tags">{routes.filter((route) => route.receptionist_instance_id === item.id && route.is_enabled).map((route) => <small key={route.id}>{phones.find((phone) => phone.id === route.phone_number_id)?.phone_e164 || "Number"} · {route.channel}</small>)}</div></article>)}</div> : <EmptyState title="No AI receptionists configured" description="Your receptionist instances appear here after the backend provisioning flow creates them." />}</section></>;
}
function PlansPage({ plans, entitlements, prices, subscription }: { plans: PlanRow[]; entitlements: EntitlementRow[]; prices: PriceRow[]; subscription: DeskData["subscription"] }) {
  const current = plans.find((plan) => plan.id === subscription?.plan_id);
  return <><section className="subscription-summary surface"><div><span className="eyebrow">CURRENT SUBSCRIPTION</span><h2>{current?.name || "No active plan"}</h2><p>{subscription ? "Billing status: " + subscription.status.replace("_", " ") : "This workspace has not activated a subscription yet."}</p></div><div className="subscription-status"><span className={pill(subscription?.status || "not_subscribed")}>{subscription?.status?.replace("_", " ") || "Not subscribed"}</span>{subscription?.current_period_end && <small>Period ends {dateText(subscription.current_period_end)}</small>}</div></section><div className="plan-intro"><span className="eyebrow">VELLARA PLANS</span><h2>Choose the capacity your operation needs.</h2><p>Plans are built around connected numbers, AI receptionist instances, and simultaneous call capacity.</p></div><div className="plan-grid">{plans.map((plan) => {
    const ent = entitlements.find((item) => item.plan_id === plan.id);
    const price = prices.find((item) => item.plan_id === plan.id);
    const enterprise = plan.code === "enterprise";
    return <article className={plan.code === "growth" ? "plan-card plan-featured" : "plan-card"} key={plan.id}><div className="plan-card-top"><div><span className="eyebrow">VELLARA {plan.code.toUpperCase()}</span><h3>{plan.name}</h3></div>{plan.code === "growth" && <span className="popular-tag">POPULAR</span>}</div><p>{plan.description}</p><div className="plan-price"><strong>{price ? cash(price.amount_minor, price.currency) : enterprise ? "Custom" : "Coming soon"}</strong><span>{price ? " / " + price.billing_interval : enterprise ? " tailored pricing" : " pricing not published"}</span></div><div className="plan-divider" /><ul><li><Check />{ent?.phone_number_limit ? ent.phone_number_limit + " connected number(s)" : enterprise ? "Negotiated number capacity" : "Number capacity to be confirmed"}</li><li><Check />{ent?.receptionist_instance_limit ? ent.receptionist_instance_limit + " AI receptionist(s)" : enterprise ? "Custom receptionist capacity" : "Receptionist capacity to be confirmed"}</li><li><Check />{ent?.concurrent_call_limit ? ent.concurrent_call_limit + " simultaneous call(s)" : "Concurrency limit to be confirmed"}</li><li><Check />Voice and WhatsApp share one number slot</li></ul><button className="plan-button" disabled={!plan.is_available_for_purchase || !price || ent?.configuration_status !== "configured"}>{plan.is_available_for_purchase && price ? "Continue to checkout" : enterprise ? "Contact sales soon" : "Not available yet"}</button><small className="plan-footnote">Checkout opens after prices, plan limits, and verified billing callbacks are configured.</small></article>;
  })}</div><div className="plan-note"><ShieldCheck /><p>Subscription status and capacity are verified by VELLARA's backend. The Owner Desk never activates a paid plan from a browser redirect alone.</p></div></>;
}
function SettingsPage({ profile, saving, onSubmit }: { profile: BusinessProfile | null; saving: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  if (!profile) return <EmptyState title="Business profile unavailable" description="Check your workspace permissions or refresh the Owner Desk." />;
  return <form className="surface settings-form" onSubmit={onSubmit}><div className="settings-section-heading"><div><h2>Business profile</h2><p>These details identify your property across the Owner Desk.</p></div><span className="settings-readonly"><ShieldCheck size={14} />Owner / manager access</span></div><div className="form-grid"><Field label="Business display name"><input name="display_name" defaultValue={profile.display_name} required minLength={2} maxLength={120} /></Field><Field label="Business type"><select name="business_type" defaultValue={profile.business_type}><option value="hotel">Hotel / hospitality</option><option value="real_estate">Real estate</option><option value="other">Other</option></select></Field><Field label="Legal business name"><input name="legal_name" defaultValue={profile.legal_name || ""} /></Field><Field label="Contact email"><input name="contact_email" type="email" defaultValue={profile.contact_email || ""} /></Field><Field label="Contact phone (E.164)"><input name="contact_phone_e164" defaultValue={profile.contact_phone_e164 || ""} placeholder="+233..." pattern="^\+[1-9][0-9]{7,14}$" /></Field><Field label="Website"><input name="website_url" type="url" defaultValue={profile.website_url || ""} placeholder="https://" /></Field><Field label="Address"><input name="address_line_1" defaultValue={profile.address_line_1 || ""} /></Field><Field label="City"><input name="city" defaultValue={profile.city || ""} /></Field><Field label="Region"><input name="region" defaultValue={profile.region || ""} /></Field><Field label="Business description" wide><textarea name="description" rows={4} defaultValue={profile.description || ""} /></Field></div><div className="settings-footer"><div><small>Timezone: {profile.timezone} · Currency: {profile.currency}</small><small>Managed by workspace configuration.</small></div><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div></form>;
}
function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) { return <label className={wide ? "field field-wide" : "field"}><span>{label}</span>{children}</label>; }
function RecordModal({ kind, guests, rooms, saving, onClose, onSubmit }: { kind: Exclude<ModalKind, null>; guests: GuestRow[]; rooms: RoomRow[]; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const title = kind === "guest" ? "Add a guest" : kind === "room" ? "Add a room" : "Create reservation";
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card" onSubmit={onSubmit}><div className="modal-heading"><div><span className="eyebrow">OWNER DESK</span><h2>{title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X /></button></div>
    {kind === "guest" && <div className="form-grid"><Field label="Full name"><input name="full_name" required minLength={2} maxLength={160} autoFocus /></Field><Field label="Phone number (E.164)"><input name="phone_e164" placeholder="+233..." pattern="^\+[1-9][0-9]{7,14}$" /></Field><Field label="Email address"><input name="email" type="email" /></Field><Field label="Notes" wide><textarea name="notes" rows={3} /></Field></div>}
    {kind === "room" && <div className="form-grid"><Field label="Room number"><input name="room_number" required maxLength={32} autoFocus /></Field><Field label="Room type"><input name="room_type" defaultValue="Standard" required /></Field><Field label="Guest capacity"><input name="capacity" type="number" min="1" max="30" defaultValue="2" required /></Field><Field label="Floor / wing"><input name="floor_label" /></Field><Field label="Nightly rate (GHS)"><input name="nightly_rate" type="number" min="0" step="0.01" /></Field><Field label="Initial status"><select name="status" defaultValue="available"><option value="available">Available</option><option value="maintenance">Maintenance</option><option value="out_of_service">Out of service</option></select></Field></div>}
    {kind === "reservation" && <div className="form-grid"><Field label="Guest"><select name="guest_id" defaultValue=""><option value="">Guest not assigned</option>{guests.map((g) => <option key={g.id} value={g.id}>{g.full_name}</option>)}</select></Field><Field label="Room"><select name="room_id" defaultValue=""><option value="">Room not assigned</option>{rooms.filter((r) => r.status === "available").map((r) => <option key={r.id} value={r.id}>{r.room_number} · {r.room_type}</option>)}</select></Field><Field label="Arrival date"><input name="arrival_date" type="date" required /></Field><Field label="Departure date"><input name="departure_date" type="date" required /></Field><Field label="Adults"><input name="adults" type="number" min="1" max="30" defaultValue="1" required /></Field><Field label="Children"><input name="children" type="number" min="0" max="30" defaultValue="0" required /></Field><Field label="Special requests" wide><textarea name="special_requests" rows={3} /></Field></div>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : kind === "reservation" ? "Create reservation" : kind === "guest" ? "Add guest" : "Add room"}</button></div>
  </form></div>;
}
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="empty-state table-empty"><div className="empty-icon"><CircleHelp /></div><h3>{title}</h3><p>{description}</p></div>; }
