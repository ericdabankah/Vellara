import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Activity, ArrowDownLeft, ArrowUpRight, BedDouble, Bell, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, CreditCard, Headphones, LayoutDashboard, LogOut, Menu, MessageSquare, Phone, Plus, RefreshCw, Search, Settings, ShieldCheck, Sparkles, Users, X, Zap } from "lucide-react";
import AuthGate from "./auth/AuthGate";
import PreviewDemo from "./components/PreviewDemo";
import PropertyWorkspace from "./components/PropertyWorkspace";
import { supabase } from "./lib/supabase";

type Workspace = { id: string; name: string; businessType: string; role: string };
type Section = "Overview" | "Properties" | "Calls" | "Reservations" | "Guests" | "Rooms" | "Activity" | "Numbers" | "AI Receptionists" | "Plans" | "Settings";
type CallRow = { id: string; status: string; direction: string; caller_e164: string | null; guest_name: string | null; started_at: string; duration_seconds: number | null; outcome: string | null; summary: string };
type GuestRow = { id: string; full_name: string; phone_e164: string | null; email: string | null; notes: string; source: string; created_at: string };
type RoomRow = { id: string; property_id: string; room_type_id: string; room_number: string; room_type: string; room_types: { name: string } | null; capacity: number; status: string; nightly_rate_minor: number | null; currency: string; floor_label: string | null };
type RoomTypeRow = { id: string; property_id: string; name: string; default_capacity: number; default_nightly_rate_minor: number | null; is_active: boolean; archived_at: string | null };
type PropertyRow = { id: string; address_line_1?: string | null; vertical: "hospitality" | "real_estate"; name: string; slug: string; description: string; status: string; city: string | null; region: string | null; timezone_override: string | null; currency_override: string | null; created_at: string };
type ReservationRow = { id: string; property_id: string; guest_id: string | null; room_id: string | null; confirmation_code: string | null; status: string; source: string; arrival_date: string; departure_date: string; adults: number; children: number; total_amount_minor: number | null; currency: string; special_requests: string; created_at: string };
type PhoneRow = { id: string; phone_e164: string; label: string; status: string; verification_status: string; phone_number_channels: { channel: string; status: string }[] };
type ReceptionistRow = { id: string; display_name: string; description: string; status: string; language_code: string; timezone: string };
type RouteRow = { id: string; phone_number_id: string; receptionist_instance_id: string; channel: string; priority: number; is_enabled: boolean };
type PlanRow = { id: string; code: string; name: string; description: string; is_available_for_purchase: boolean; display_order: number };
type EntitlementRow = { plan_id: string; phone_number_limit: number | null; receptionist_instance_limit: number | null; concurrent_call_limit: number | null; configuration_status: string; custom_entitlements: boolean };
type PriceRow = { id: string; plan_id: string; currency: string; billing_interval: string; amount_minor: number };
type ActivityRow = { id: string; event_type: string; summary: string; created_at: string };
type BusinessProfile = { organization_id: string; display_name: string; legal_name: string | null; description: string | null; contact_email: string | null; contact_phone_e164: string | null; website_url: string | null; address_line_1: string | null; city: string | null; region: string | null; timezone: string; currency: string };
type DeskData = { calls: CallRow[]; reservations: ReservationRow[]; guests: GuestRow[]; rooms: RoomRow[]; phones: PhoneRow[]; routes: RouteRow[]; receptionists: ReceptionistRow[]; plans: PlanRow[]; entitlements: EntitlementRow[]; prices: PriceRow[]; activities: ActivityRow[]; subscription: { id: string; status: string; plan_id: string; current_period_end: string | null } | null; profile: BusinessProfile | null; metrics: { calls: number; reservations: number; guests: number; occupied: number; rooms: number } };
type ModalKind = "guest" | "room" | "reservation" | null;

const nav: { name: Section; icon: ReactNode; group: string }[] = [
  { name: "Overview", icon: <LayoutDashboard />, group: "workspace" },
  { name: "Properties", icon: <BedDouble />, group: "workspace" },
  { name: "Calls", icon: <Phone />, group: "workspace" },
  { name: "Reservations", icon: <CalendarDays />, group: "workspace" },
  { name: "Guests", icon: <Users />, group: "workspace" },
  { name: "Rooms", icon: <BedDouble />, group: "workspace" },
  { name: "Activity", icon: <Activity />, group: "workspace" },
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
function roomTypeName(room: RoomRow) { return room.room_types?.name || room.room_type; }

export default function App() {
  if (window.location.pathname === "/preview") return <PreviewDemo />;
  return <AuthGate>{({ workspace, workspaces, onWorkspaceChange, signOut, refreshWorkspaceModules }) => <OwnerDesk workspace={workspace} workspaces={workspaces} onWorkspaceChange={onWorkspaceChange} signOut={signOut} refreshWorkspaceModules={refreshWorkspaceModules} />}</AuthGate>;
}

function OwnerDesk({ workspace, workspaces, onWorkspaceChange, signOut, refreshWorkspaceModules }: { workspace: Workspace; workspaces: Workspace[]; onWorkspaceChange: (workspaceId: string) => void; signOut: () => Promise<void>; refreshWorkspaceModules: () => Promise<void> }) {
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
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([]);
  const [propertySchemaReady, setPropertySchemaReady] = useState(false);
  const [propertySchemaError, setPropertySchemaError] = useState("");
  const [propertyModal, setPropertyModal] = useState(false);
  const requestVersion = useRef(0);

  const reload = useCallback(async (quiet = false) => {
    if (!supabase) return;
    const requestId = ++requestVersion.current;
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    const today = startOfAccraDay();
        const [calls, reservations, guests, rooms, phones, routes, receptionists, plans, entitlements, prices, activities, subscription, profile, callCount, reservationCount, guestCount, roomCount, occupiedCount] = await Promise.all([
      supabase.from("calls").select("id,status,direction,caller_e164,guest_name,started_at,duration_seconds,outcome,summary").eq("organization_id", workspace.id).order("started_at", { ascending: false }).limit(100),
      supabase.from("reservations").select("id,property_id,guest_id,room_id,confirmation_code,status,source,arrival_date,departure_date,adults,children,total_amount_minor,currency,special_requests,created_at").eq("organization_id", workspace.id).order("arrival_date", { ascending: true }).limit(200),
      supabase.from("guests").select("id,full_name,phone_e164,email,notes,source,created_at").eq("organization_id", workspace.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("rooms").select("id,property_id,room_type_id,room_number,room_type,room_types(name),capacity,status,nightly_rate_minor,currency,floor_label").eq("organization_id", workspace.id).order("room_number", { ascending: true }).limit(500),
      supabase.from("organization_phone_numbers").select("id,phone_e164,label,status,verification_status,phone_number_channels(channel,status)").eq("organization_id", workspace.id).order("created_at", { ascending: false }),
      supabase.from("receptionist_number_routes").select("id,phone_number_id,receptionist_instance_id,channel,priority,is_enabled").eq("organization_id", workspace.id).order("priority", { ascending: true }),
      supabase.from("receptionist_instances").select("id,display_name,description,status,language_code,timezone").eq("organization_id", workspace.id).order("created_at", { ascending: true }),
      supabase.from("subscription_plans").select("id,code,name,description,is_available_for_purchase,display_order").eq("is_listed", true).order("display_order", { ascending: true }),
      supabase.from("subscription_plan_entitlements").select("plan_id,phone_number_limit,receptionist_instance_limit,concurrent_call_limit,configuration_status,custom_entitlements"),
      supabase.from("subscription_prices").select("id,plan_id,currency,billing_interval,amount_minor").eq("is_active", true),
      supabase.from("activity_events").select("id,event_type,summary,created_at").eq("organization_id", workspace.id).order("created_at", { ascending: false }).limit(12),
      supabase.from("organization_subscriptions").select("id,status,plan_id,current_period_end").eq("organization_id", workspace.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("business_profiles").select("organization_id,display_name,legal_name,description,contact_email,contact_phone_e164,website_url,address_line_1,city,region,timezone,currency").eq("organization_id", workspace.id).maybeSingle(),
      supabase.from("calls").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id).gte("started_at", today),
      supabase.from("reservations").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id).gte("created_at", today),
      supabase.from("guests").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id).gte("created_at", today),
      supabase.from("rooms").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id),
      supabase.from("rooms").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id).eq("status", "occupied"),
    ]);
    const [propertyRows, moduleRows, roomTypeRows] = await Promise.all([
      supabase.from("properties").select("id,vertical,name,slug,description,status,address_line_1,city,region,timezone_override,currency_override,created_at").eq("organization_id", workspace.id).order("created_at", { ascending: false }),
      supabase.from("organization_modules").select("module_key,is_enabled").eq("organization_id", workspace.id),
      supabase.from("room_types").select("id,property_id,name,default_capacity,default_nightly_rate_minor,is_active,archived_at").eq("organization_id", workspace.id).eq("is_active", true).is("archived_at", null).order("name", { ascending: true }),
    ]);
    if (requestId !== requestVersion.current) return;
    const propertySchemaFailure = propertyRows.error || moduleRows.error || roomTypeRows.error;
    if (propertySchemaFailure) {
      setPropertySchemaReady(false);
      setPropertySchemaError(propertySchemaFailure.message || "One or more required property tables are unavailable.");
      setProperties([]);
      setRoomTypes([]);
    } else {
      setPropertySchemaReady(true);
      setPropertySchemaError("");
      setProperties((propertyRows.data ?? []) as PropertyRow[]);
      setRoomTypes((roomTypeRows.data ?? []) as RoomTypeRow[]);
    }
    const failed = [calls.error, reservations.error, guests.error, rooms.error, phones.error, routes.error, receptionists.error, plans.error, entitlements.error, prices.error, activities.error, subscription.error, profile.error, callCount.error, reservationCount.error, guestCount.error, roomCount.error, occupiedCount.error, roomTypeRows.error].find(Boolean);
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

  useEffect(() => {
    setData(blank);
    setProperties([]);
    setRoomTypes([]);
    setPropertySchemaReady(false);
    setPropertySchemaError("");
    setError("");
    setNotice("");
    setModal(null);
    setPropertyModal(false);
    setLoading(true);
    void reload();
    return () => { requestVersion.current += 1; };
  }, [reload]);
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
      const propertyId = String(form.get("property_id") ?? "");
      const roomTypeId = String(form.get("room_type_id") ?? "");
      const selectedType = roomTypes.find((item) => item.id === roomTypeId && item.property_id === propertyId);
      const property = properties.find((item) => item.id === propertyId && item.vertical === "hospitality" && item.status === "active");
      const rate = String(form.get("nightly_rate") ?? "").trim();
      if (!property || !selectedType) {
        setError("Choose an active hospitality property and one of its active room types.");
        setSaving(false);
        return;
      }
      result = await supabase.from("rooms").insert({
        organization_id: workspace.id, property_id: property.id, room_type_id: selectedType.id,
        room_number: String(form.get("room_number") ?? "").trim(), room_type: selectedType.name,
        capacity: Number(form.get("capacity") ?? selectedType.default_capacity),
        status: String(form.get("status") ?? "available"), nightly_rate_minor: rate ? Math.round(Number(rate) * 100) : selectedType.default_nightly_rate_minor,
        currency: property.currency_override ?? data.profile?.currency ?? "GHS",
        floor_label: String(form.get("floor_label") ?? "").trim() || null,
      });
    } else {
      const roomId = String(form.get("room_id") ?? "") || null;
      const selectedRoom = roomId ? data.rooms.find((item) => item.id === roomId) : null;
      const propertyId = selectedRoom?.property_id || String(form.get("property_id") ?? "");
      const property = properties.find((item) => item.id === propertyId && item.vertical === "hospitality" && item.status === "active");
      if (!property || (selectedRoom && selectedRoom.property_id !== property.id)) {
        setError("Choose an active hospitality property and a room belonging to that property, or leave the room unassigned.");
        setSaving(false);
        return;
      }
      result = await supabase.from("reservations").insert({
        organization_id: workspace.id, property_id: property.id, guest_id: String(form.get("guest_id") ?? "") || null,
        room_id: roomId, arrival_date: String(form.get("arrival_date") ?? ""),
        departure_date: String(form.get("departure_date") ?? ""), adults: Number(form.get("adults") ?? 1),
        children: Number(form.get("children") ?? 0), status: roomId ? "pending" : "inquiry", source: "owner_desk",
        special_requests: String(form.get("special_requests") ?? "").trim(),
        currency: property.currency_override ?? data.profile?.currency ?? "GHS",
      });
    }
    if (result.error) setError(result.error.message);
    else { setNotice(modal === "guest" ? "Guest added." : modal === "room" ? "Room added." : "Reservation created."); setModal(null); await reload(true); }
    setSaving(false);
  }

  async function updateStatus(table: "rooms" | "reservations", id: string, status: string) {
    if (!supabase) return;
    setError(""); setNotice("");
    if (table === "reservations") {
      const current = data.reservations.find((item) => item.id === id);
      if (!current) { setError("Reservation not found in the current workspace. Refresh and try again."); return; }
      if (!reservationNextStatuses(current.status).includes(status)) {
        setError("That reservation status change is not allowed. Follow the available next step shown in the reservation ledger.");
        return;
      }
    } else {
      const current = data.rooms.find((item) => item.id === id);
      if (!current) { setError("Room not found in the current workspace. Refresh and try again."); return; }
      if (!roomNextStatuses(current.status).includes(status)) {
        setError("That room status change is not allowed. Refresh the room and choose an available next step.");
        return;
      }
    }
    const result = await supabase.from(table).update({ status }).eq("organization_id", workspace.id).eq("id", id).select("id").maybeSingle();
    if (result.error) setError(result.error.message); else if (!result.data) setError("This change was not applied. Your workspace role may not have permission."); else { setNotice(table === "reservations" ? "Reservation status updated." : "Room operational status updated."); await reload(true); }
  }

  async function createProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const vertical = String(form.get("vertical") ?? "hospitality") as PropertyRow["vertical"];
    const name = String(form.get("name") ?? "").trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        setSaving(true); setError(""); setNotice("");
    const result = await supabase.rpc("create_property", {
      p_organization_id: workspace.id,
      p_vertical: vertical,
      p_name: name,
      p_slug: slug,
      p_description: String(form.get("description") ?? "").trim(),
      p_city: String(form.get("city") ?? "").trim() || null,
      p_region: String(form.get("region") ?? "").trim() || null,
      p_timezone_override: String(form.get("timezone_override") ?? "").trim() || null,
      p_currency_override: String(form.get("currency_override") ?? "").trim() || null,
    });
    if (result.error) setError(result.error.message);
    else if (!result.data?.id) setError("The property was not created. The server returned no property record.");
    else { setNotice("Property created. Its currency and timezone inherit your workspace defaults unless overridden."); setPropertyModal(false); await reload(true); await refreshWorkspaceModules(); }
    setSaving(false);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    setSaving(true); setError(""); setNotice("");
    const result = await supabase.from("business_profiles").update({
      display_name: String(form.get("display_name") ?? "").trim(),
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
      <div className="workspace-switcher"><div className="workspace-avatar">{initials(workspace.name)}</div><div className="workspace-copy"><strong>{workspace.name}</strong><span>{workspace.businessType.replace("_", " ")}</span></div>{workspaces.length > 1 ? <select className="workspace-select" aria-label="Switch workspace" value={workspace.id} onChange={(event) => onWorkspaceChange(event.target.value)}>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.businessType.replace("_", " ")}</option>)}</select> : <ChevronDown size={15} />}</div>
      <div className="nav-section"><span>WORKSPACE</span>{nav.filter((item) => item.group === "workspace").map((item) => <button key={item.name} className={active === item.name ? "nav-link nav-active" : "nav-link"} onClick={() => { setActive(item.name); setMobileMenu(false); }}>{item.icon}{item.name}</button>)}</div>
      <div className="nav-section"><span>CONFIGURATION</span>{nav.filter((item) => item.group === "manage").map((item) => <button key={item.name} className={active === item.name ? "nav-link nav-active" : "nav-link"} onClick={() => { setActive(item.name); setMobileMenu(false); }}>{item.icon}{item.name}</button>)}</div>
      <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={16} /><span><b>Workspace protected</b><small>Tenant-isolated access</small></span></div><button className={active === "Settings" ? "nav-link nav-active" : "nav-link"} onClick={() => { setActive("Settings"); setMobileMenu(false); }}><Settings />Settings</button><div className="profile-strip"><div className="profile-avatar">{initials(workspace.name)}</div><div><b>{workspace.name}</b><small>{workspace.role}</small></div><button className="icon-button" onClick={() => void signOut()} aria-label="Sign out"><LogOut size={17} /></button></div></div>
    </aside>
    {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation" />}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu /></button><span>Owner Desk</span><ChevronRight size={14} /><b>{active}</b></div><div className="topbar-right"><span className="secure-label"><i /> Secure workspace</span><button className="icon-button" onClick={() => void reload(true)} title="Refresh data" aria-label="Refresh data"><RefreshCw className={refreshing ? "spin" : ""} size={17} /></button><span className="icon-button" aria-hidden="true"><Bell size={18} /></span><div className="topbar-avatar">{initials(workspace.name)}</div></div></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">{active === "Overview" || active === "Properties" ? "PROPERTY OPERATIONS" : "OWNER WORKSPACE"}</div><h1>{pageTitle(active)}</h1><p>{pageDescription(active, workspace.name)}</p></div><div className="heading-actions"><span className="today-label"><CalendarDays size={15} />{new Intl.DateTimeFormat("en-GH", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Accra" }).format(new Date())}</span>{active === "Properties" && <button className="primary-button" disabled={!propertySchemaReady} onClick={() => setPropertyModal(true)}><Plus size={16} />Add property</button>}{active === "Guests" && <button className="primary-button" onClick={() => setModal("guest")}><Plus size={16} />Add guest</button>}{active === "Rooms" && <button className="primary-button" disabled={!properties.some((p) => p.vertical === "hospitality" && p.status === "active") || !roomTypes.length} title={!properties.some((p) => p.vertical === "hospitality" && p.status === "active") ? "Create an active hospitality property first" : !roomTypes.length ? "Create a room type in Properties first" : "Add room"} onClick={() => setModal("room")}><Plus size={16} />Add room</button>}{active === "Reservations" && <button className="primary-button" disabled={!properties.some((p) => p.vertical === "hospitality" && p.status === "active")} title="An active hospitality property is required" onClick={() => setModal("reservation")}><Plus size={16} />New reservation</button>}</div></div>
        {error && <div className="inline-alert alert-error" role="alert"><CircleHelp size={16} />{error}<button onClick={() => setError("")} aria-label="Dismiss"><X size={14} /></button></div>}
        {notice && <div className="inline-alert alert-success" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}
        {loading ? <div className="loading-panel"><span className="loader" />Loading your workspace data…</div> : <>
          {active === "Overview" && <Overview data={data} activeCall={activeCall} occupancy={occupancy} onNavigate={setActive} />}
          {active === "Properties" && <PropertyWorkspace workspaceId={workspace.id} properties={properties} profile={data.profile} schemaReady={propertySchemaReady} schemaError={propertySchemaError} onRefresh={() => reload(true)} />}
          {active === "Calls" && <CallsPage calls={data.calls} />}
          {active === "Reservations" && <ReservationsPage reservations={data.reservations} guests={data.guests} rooms={data.rooms} properties={properties} onStatus={updateStatus} />}
          {active === "Guests" && <GuestsPage guests={data.guests} reservations={data.reservations} rooms={data.rooms} properties={properties} /> }
          {active === "Rooms" && <RoomsPage rooms={data.rooms} properties={properties} onStatus={updateStatus} />}
          {active === "Activity" && <ActivityPage activities={data.activities} />}
          {active === "Numbers" && <NumbersPage phones={data.phones} routes={data.routes} receptionists={data.receptionists} />}
          {active === "AI Receptionists" && <ReceptionistsPage instances={data.receptionists} routes={data.routes} phones={data.phones} />}
          {active === "Plans" && <PlansPage plans={data.plans} entitlements={data.entitlements} prices={data.prices} subscription={data.subscription} />}
          {active === "Settings" && <SettingsPage profile={data.profile} saving={saving} onSubmit={saveSettings} />}
        </>}
        <footer className="page-footer"><span>VELLARA OWNER DESK</span><span>Thoughtful hospitality. Clear operations.</span></footer>
      </div>
    </main>
    {modal && <RecordModal kind={modal} guests={data.guests} rooms={data.rooms} properties={properties} roomTypes={roomTypes} profileCurrency={data.profile?.currency ?? "GHS"} saving={saving} onClose={() => setModal(null)} onSubmit={createRecord} />}
    {propertyModal && <PropertyModal saving={saving} onClose={() => setPropertyModal(false)} onSubmit={createProperty} />}
  </div>;
}

function pageTitle(section: Section) {
  const titles: Record<Section, string> = { Overview: "Your desk, at a glance.", Properties: "Your properties", Calls: "Call activity", Reservations: "Reservations", Guests: "Guest directory", Rooms: "Room management", Activity: "Workspace activity", Numbers: "Connected numbers", "AI Receptionists": "Your AI receptionists", Plans: "Plans & subscription", Settings: "Business settings" };
  return titles[section];
}
function pageDescription(section: Section, name: string) {
  const descriptions: Record<Section, string> = { Overview: "A live view of " + name + " and its guest experience.", Properties: "Manage each location, its operating vertical, and inherited business settings.", Calls: "Review conversations handled by VELLARA.", Reservations: "Track enquiries, upcoming stays, and reservation status.", Guests: "Keep guest contact details and notes in one secure place.", Rooms: "Manage room operations and operational status.", Activity: "Review recent events recorded across this workspace.", Numbers: "Manage the phone identities and channels connected to your workspace.", "AI Receptionists": "Configure independent receptionist instances and routing.", Plans: "Understand your subscription, included capacity, and billing status.", Settings: "Keep your business details accurate across the Owner Desk." };
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

function PropertyModal({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card property-modal" onSubmit={onSubmit}>
    <div className="modal-heading"><div><span className="eyebrow">PROPERTY PORTFOLIO</span><h2>Add a property</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X /></button></div>
    <div className="form-grid">
      <Field label="Property name"><input name="name" required minLength={2} maxLength={120} autoFocus placeholder="e.g. The Cedar Residence" /></Field>
      <Field label="Business vertical"><select name="vertical" defaultValue="hospitality"><option value="hospitality">Hospitality</option><option value="real_estate">Real estate</option></select></Field>
      <Field label="City"><input name="city" placeholder="e.g. Accra" /></Field>
      <Field label="Region"><input name="region" placeholder="e.g. Greater Accra" /></Field>
      <Field label="Currency override"><input name="currency_override" maxLength={3} pattern="[A-Z]{3}" placeholder="Blank inherits workspace default" /></Field>
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
function reservationNextStatuses(status: string): string[] {
  const transitions: Record<string, string[]> = {
    inquiry: ["pending", "canceled"],
    pending: ["confirmed", "inquiry", "canceled"],
    confirmed: ["checked_in", "canceled", "no_show"],
    checked_in: ["checked_out"],
    checked_out: [],
    canceled: [],
    no_show: [],
  };
  return transitions[status] ?? [];
}
function roomNextStatuses(status: string): string[] {
  const transitions: Record<string, string[]> = {
    available: ["occupied", "maintenance", "out_of_service"],
    occupied: ["available", "maintenance", "out_of_service"],
    maintenance: ["available", "out_of_service"],
    out_of_service: ["available", "maintenance"],
  };
  return transitions[status] ?? [];
}
function ActivityPage({ activities }: { activities: ActivityRow[] }) {
  return <section className="surface data-surface"><div className="table-toolbar"><div><h2>Workspace activity</h2><p>Recent activity events recorded for this workspace</p></div><span className="table-meta">{activities.length} recent events</span></div>{activities.length ? <div className="activity-timeline">{activities.map((event) => <article className="activity-timeline-item" key={event.id}><span className="activity-timeline-marker"><Activity size={14} /></span><div><b>{event.summary || event.event_type.replaceAll("_", " ")}</b><small>{event.event_type.replaceAll("_", " ")}</small></div><time>{dateText(event.created_at)} · {timeText(event.created_at)}</time></article>)}</div> : <EmptyState title="No activity recorded yet" description="Workspace events will appear here when supported actions write activity records. This view does not invent events for changes that have no audit record." />}</section>;
}
function ReservationsPage({ reservations, guests, rooms, properties, onStatus }: { reservations: ReservationRow[]; guests: GuestRow[]; rooms: RoomRow[]; properties: PropertyRow[]; onStatus: (table: "rooms" | "reservations", id: string, status: string) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const rows = reservations.filter((r) => {
    const guest = guests.find((g) => g.id === r.guest_id);
    const room = rooms.find((item) => item.id === r.room_id);
    const property = properties.find((item) => item.id === r.property_id);
    return ((guest?.full_name || "") + " " + (room?.room_number || "") + " " + (property?.name || "") + " " + (r.confirmation_code || "") + " " + r.status).toLowerCase().includes(query.toLowerCase());
  });
  return <section className="surface data-surface"><div className="table-toolbar"><div><h2>Reservation ledger</h2><p>Guest stays and booking requests across your properties</p></div><SearchInput value={query} onChange={setQuery} placeholder="Search reservations" /></div>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Property</th><th>Guest</th><th>Room</th><th>Stay</th><th>Guests</th><th>Amount</th><th>Status</th><th>Update</th></tr></thead><tbody>{rows.map((r) => { const guest = guests.find((g) => g.id === r.guest_id); const room = rooms.find((item) => item.id === r.room_id); const property = properties.find((item) => item.id === r.property_id); return <tr key={r.id}><td><b>{property?.name || "Property unavailable"}</b><small>{property?.city || "Hospitality property"}</small></td><td><b>{guest?.full_name || "Guest enquiry"}</b><small>{r.confirmation_code || "No confirmation code"}</small></td><td>{room?.room_number || "Unassigned"}<small>{room ? roomTypeName(room) : "Room pending"}</small></td><td>{dateText(r.arrival_date)}<small>to {dateText(r.departure_date)}</small></td><td>{r.adults} adults, {r.children} children</td><td>{cash(r.total_amount_minor, r.currency)}</td><td><span className={pill(r.status)}>{r.status.replace("_", " ")}</span></td><td><select className="inline-select" aria-label={"Next status for reservation " + (r.confirmation_code || r.id)} value={r.status} disabled={reservationNextStatuses(r.status).length === 0} onChange={(event) => void onStatus("reservations", r.id, event.target.value)}><option value={r.status}>{r.status.replaceAll("_", " ")}</option>{reservationNextStatuses(r.status).map((next) => <option key={next} value={next}>{next.replaceAll("_", " ")}</option>)}</select></td></tr>; })}</tbody></table></div> : <EmptyState title="No reservations yet" description="Create a property-specific reservation or an unassigned enquiry for one of your properties." />}</section>;
}
function GuestsPage({ guests, reservations, rooms, properties }: { guests: GuestRow[]; reservations: ReservationRow[]; rooms: RoomRow[]; properties: PropertyRow[] }) {
  const [query, setQuery] = useState("");
  const [selectedGuest, setSelectedGuest] = useState<GuestRow | null>(null);
  const rows = guests.filter((g) => (g.full_name + " " + (g.phone_e164 || "") + " " + (g.email || "")).toLowerCase().includes(query.toLowerCase()));
  const guestReservations = selectedGuest ? reservations.filter((item) => item.guest_id === selectedGuest.id).sort((a, b) => b.arrival_date.localeCompare(a.arrival_date)) : [];
  return <>
    <section className="surface data-surface"><div className="table-toolbar"><div><h2>Guest directory</h2><p>Guest records belonging to this workspace · Select a guest to view their stay history</p></div><SearchInput value={query} onChange={setQuery} placeholder="Search guests" /></div>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Guest</th><th>Phone</th><th>Email</th><th>Source</th><th>Added</th></tr></thead><tbody>{rows.map((g) => <tr key={g.id}><td><button type="button" className="guest-profile-trigger" onClick={() => setSelectedGuest(g)}><span className="guest-cell"><span>{initials(g.full_name)}</span><b>{g.full_name}</b></span></button></td><td>{g.phone_e164 || "—"}</td><td>{g.email || "—"}</td><td><span className="source-label">{g.source.replace("_", " ")}</span></td><td>{dateText(g.created_at)}</td></tr>)}</tbody></table></div> : <EmptyState title="Your guest book is empty" description="Add a guest record or let VELLARA create one from a verified guest interaction." />}</section>
    {selectedGuest && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedGuest(null); }}><section className="modal-card guest-profile-modal" role="dialog" aria-modal="true" aria-labelledby="guest-profile-title"><div className="modal-heading"><div><span className="eyebrow">GUEST PROFILE</span><h2 id="guest-profile-title">{selectedGuest.full_name}</h2></div><button className="icon-button" onClick={() => setSelectedGuest(null)} aria-label="Close guest profile"><X size={18} /></button></div>
      <div className="guest-profile-contact"><div><small>PHONE</small><b>{selectedGuest.phone_e164 || "Not provided"}</b></div><div><small>EMAIL</small><b>{selectedGuest.email || "Not provided"}</b></div><div><small>RECORD SOURCE</small><b>{selectedGuest.source.replaceAll("_", " ")}</b></div><div><small>ADDED</small><b>{dateText(selectedGuest.created_at)}</b></div></div>
      {selectedGuest.notes.trim() && <div className="guest-notes"><span className="eyebrow">STAFF NOTES</span><p>{selectedGuest.notes}</p></div>}
      <div className="guest-history-heading"><div><span className="eyebrow">STAY HISTORY</span><h3>{guestReservations.length} linked {guestReservations.length === 1 ? "record" : "records"}</h3></div></div>
      {guestReservations.length ? <div className="guest-history-list">{guestReservations.map((item) => { const property = properties.find((p) => p.id === item.property_id); const room = rooms.find((r) => r.id === item.room_id); return <article key={item.id} className="guest-history-item"><div><b>{property?.name || "Property unavailable"}</b><small>{dateText(item.arrival_date)} to {dateText(item.departure_date)}</small></div><div><span className={pill(item.status)}>{item.status.replaceAll("_", " ")}</span><small>{room ? "Room " + room.room_number : item.status === "inquiry" ? "Unassigned enquiry" : "Room unassigned"}</small></div><strong>{cash(item.total_amount_minor, item.currency)}</strong></article>; })}</div> : <EmptyState title="No linked stays yet" description="Reservations associated with this guest will appear here." />}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setSelectedGuest(null)}>Close profile</button></div>
    </section></div>}
  </>;
}
function RoomsPage({ rooms, properties, onStatus }: { rooms: RoomRow[]; properties: PropertyRow[]; onStatus: (table: "rooms" | "reservations", id: string, status: string) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const counts = ["available", "occupied", "maintenance", "out_of_service"].map((status) => ({ status, count: rooms.filter((room) => room.status === status).length }));
  const rows = rooms.filter((room) => {
    const property = properties.find((item) => item.id === room.property_id);
    const matchesQuery = (room.room_number + " " + roomTypeName(room) + " " + (property?.name || "")).toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (filter === "all" || room.status === filter);
  });
  return <section className="surface data-surface"><div className="table-toolbar"><div><h2>Room operations</h2><p>Track housekeeping and operational availability across your properties.</p></div><SearchInput value={query} onChange={setQuery} placeholder="Search room or property" /></div>
    <div className="room-status-summary">{counts.map(({status,count}) => <button type="button" key={status} className={filter === status ? "room-status-summary-card selected" : "room-status-summary-card"} onClick={() => setFilter(filter === status ? "all" : status)}><span className={pill(status)}>{status.replaceAll("_"," ")}</span><b>{count}</b></button>)}</div>
    <div className="room-operations-note"><ShieldCheck size={15}/><p>Room status is an operational label only. Marking a room occupied does not check in a reservation or confirm payment. Reservation and payment states remain separate.</p></div>
    <div className="room-filter-row"><span>{rows.length} of {rooms.length} rooms</span><button type="button" className="text-button" onClick={() => { setFilter("all"); setQuery(""); }}>Clear filters</button></div>
    {rows.length ? <div className="room-grid">{rows.map((room) => { const property = properties.find((item) => item.id === room.property_id); const next = roomNextStatuses(room.status); return <article className="room-card" key={room.id}><div className="room-card-top"><div className="room-icon"><BedDouble /></div><span className={pill(room.status)}>{room.status.replaceAll("_", " ")}</span></div><h3>Room {room.room_number}</h3><p>{property?.name || "Property unavailable"} · {roomTypeName(room)}{room.floor_label ? " · " + room.floor_label : ""}</p><div className="room-meta"><span>{room.capacity} guests</span><b>{cash(room.nightly_rate_minor, room.currency)} <small>/ night</small></b></div><label className="room-status-control"><span>Next operational status</span><select className="room-status-select" aria-label={"Next operational status for room " + room.room_number} value={room.status} disabled={!next.length} onChange={(event) => void onStatus("rooms", room.id, event.target.value)}><option value={room.status}>{room.status.replaceAll("_"," ")}</option>{next.map((status) => <option key={status} value={status}>{status.replaceAll("_"," ")}</option>)}</select></label></article>; })}</div> : <EmptyState title="No matching rooms" description={rooms.length ? "Try another search or clear the status filter." : "Choose a property, create its room types, then add rooms to that property's inventory."} />}
  </section>;
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
  return <form className="surface settings-form" onSubmit={onSubmit}><div className="settings-section-heading"><div><h2>Business profile</h2><p>These details identify your property across the Owner Desk.</p></div><span className="settings-readonly"><ShieldCheck size={14} />Owner / manager access</span></div><div className="form-grid"><Field label="Business display name"><input name="display_name" defaultValue={profile.display_name} required minLength={2} maxLength={120} /></Field><p className="field-wide settings-module-note">Hospitality and real estate are enabled independently. Creating a property of either type enables that module for this workspace, so one business can manage both.</p><Field label="Legal business name"><input name="legal_name" defaultValue={profile.legal_name || ""} /></Field><Field label="Contact email"><input name="contact_email" type="email" defaultValue={profile.contact_email || ""} /></Field><Field label="Contact phone (E.164)"><input name="contact_phone_e164" defaultValue={profile.contact_phone_e164 || ""} placeholder="+233..." pattern="^\+[1-9][0-9]{7,14}$" /></Field><Field label="Website"><input name="website_url" type="url" defaultValue={profile.website_url || ""} placeholder="https://" /></Field><Field label="Address"><input name="address_line_1" defaultValue={profile.address_line_1 || ""} /></Field><Field label="City"><input name="city" defaultValue={profile.city || ""} /></Field><Field label="Region"><input name="region" defaultValue={profile.region || ""} /></Field><Field label="Business description" wide><textarea name="description" rows={4} defaultValue={profile.description || ""} /></Field></div><div className="settings-footer"><div><small>Timezone: {profile.timezone} · Currency: {profile.currency}</small><small>Managed by workspace configuration.</small></div><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div></form>;
}
function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) { return <label className={wide ? "field field-wide" : "field"}><span>{label}</span>{children}</label>; }
function RecordModal({ kind, guests, rooms, properties, roomTypes, profileCurrency, saving, onClose, onSubmit }: { kind: Exclude<ModalKind, null>; guests: GuestRow[]; rooms: RoomRow[]; properties: PropertyRow[]; roomTypes: RoomTypeRow[]; profileCurrency: string; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const title = kind === "guest" ? "Add a guest" : kind === "room" ? "Add a room" : "Create reservation";
  const hospitalityProperties = properties.filter((property) => property.vertical === "hospitality" && property.status === "active");
  const [selectedPropertyId, setSelectedPropertyId] = useState(hospitalityProperties[0]?.id ?? "");
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState(roomTypes.find((type) => type.property_id === (hospitalityProperties[0]?.id ?? ""))?.id ?? "");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const selectedProperty = hospitalityProperties.find((property) => property.id === selectedPropertyId);
  const availableRoomTypes = roomTypes.filter((type) => type.property_id === selectedPropertyId && type.is_active && !type.archived_at);
  const selectedRoomType = availableRoomTypes.find((type) => type.id === selectedRoomTypeId);
  const availableRooms = rooms.filter((room) => room.property_id === selectedPropertyId && room.status === "available");
  const currency = selectedProperty?.currency_override ?? profileCurrency;
  const noProperties = hospitalityProperties.length === 0;
  const noRoomTypes = kind === "room" && availableRoomTypes.length === 0;
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card" onSubmit={onSubmit}><div className="modal-heading"><div><span className="eyebrow">OWNER DESK</span><h2>{title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X /></button></div>
    {kind === "guest" && <div className="form-grid"><Field label="Full name"><input name="full_name" required minLength={2} maxLength={160} autoFocus /></Field><Field label="Phone number (E.164)"><input name="phone_e164" placeholder="+233..." pattern="^\+[1-9][0-9]{7,14}$" /></Field><Field label="Email address"><input name="email" type="email" /></Field><Field label="Notes" wide><textarea name="notes" rows={3} /></Field></div>}
    {kind === "room" && <div className="form-grid">
      {noProperties ? <div className="field field-wide"><span>No active hospitality property is available. Create or activate a property before adding rooms.</span></div> : <>
        <Field label="Property"><select name="property_id" required value={selectedPropertyId} onChange={(event) => { const next = event.target.value; setSelectedPropertyId(next); setSelectedRoomTypeId(roomTypes.find((type) => type.property_id === next && type.is_active && !type.archived_at)?.id ?? ""); }}><option value="">Choose a property</option>{hospitalityProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></Field>
        <Field label="Room type"><select name="room_type_id" required value={selectedRoomTypeId} onChange={(event) => setSelectedRoomTypeId(event.target.value)}><option value="">Choose a room type</option>{availableRoomTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></Field>
        {noRoomTypes && <div className="field field-wide"><span>This property has no active room types yet. Add a room type in Properties before creating its rooms.</span></div>}
        <Field label="Room number"><input name="room_number" required maxLength={32} autoFocus /></Field>
        <Field label="Guest capacity"><input key={selectedRoomType?.id || selectedPropertyId} name="capacity" type="number" min="1" max="30" defaultValue={selectedRoomType?.default_capacity ?? 2} required /></Field>
        <Field label="Floor / wing"><input name="floor_label" /></Field>
        <Field label={"Nightly rate (" + currency + ")"}><input key={"rate-" + (selectedRoomType?.id || selectedPropertyId)} name="nightly_rate" type="number" min="0" step="0.01" defaultValue={selectedRoomType?.default_nightly_rate_minor == null ? "" : (selectedRoomType.default_nightly_rate_minor / 100).toFixed(2)} placeholder="Use room-type default" /></Field>
        <Field label="Initial status"><select name="status" defaultValue="available"><option value="available">Available</option><option value="maintenance">Maintenance</option><option value="out_of_service">Out of service</option></select></Field>
      </>}
    </div>}
    {kind === "reservation" && <div className="form-grid">
      {noProperties ? <div className="field field-wide"><span>No active hospitality property is available. Create or activate a property before recording a reservation or enquiry.</span></div> : <>
        <Field label="Property"><select name="property_id" required value={selectedPropertyId} onChange={(event) => { setSelectedPropertyId(event.target.value); setSelectedRoomId(""); }}><option value="">Choose a property</option>{hospitalityProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></Field>
        <Field label="Guest"><select name="guest_id" defaultValue=""><option value="">Guest not assigned</option>{guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.full_name}</option>)}</select></Field>
        <Field label="Room"><select name="room_id" value={selectedRoomId} onChange={(event) => setSelectedRoomId(event.target.value)}><option value="">Unassigned enquiry / room pending</option>{availableRooms.map((room) => <option key={room.id} value={room.id}>{room.room_number} · {roomTypeName(room)}</option>)}</select></Field>
        <Field label="Arrival date"><input name="arrival_date" type="date" required /></Field>
        <Field label="Departure date"><input name="departure_date" type="date" required /></Field>
        <Field label="Adults"><input name="adults" type="number" min="1" max="30" defaultValue="1" required /></Field>
        <Field label="Children"><input name="children" type="number" min="0" max="30" defaultValue="0" /></Field>
        <Field label="Special requests" wide><textarea name="special_requests" rows={3} /></Field>
      </>}
    </div>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving || ((kind === "room" || kind === "reservation") && noProperties) || (kind === "room" && noRoomTypes)}>{saving ? "Saving…" : kind === "reservation" ? "Create reservation" : kind === "guest" ? "Add guest" : "Add room"}</button></div>
  </form></div>;
}
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="empty-state table-empty"><div className="empty-icon"><CircleHelp /></div><h3>{title}</h3><p>{description}</p></div>; }
