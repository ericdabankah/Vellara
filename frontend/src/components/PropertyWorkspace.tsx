import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Archive, BedDouble, Check, ChevronLeft, CircleHelp, Edit3, Plus, Save, ShieldCheck, X } from "lucide-react";
import { supabase } from "../lib/supabase";

type Property = {
  id: string;
  vertical: "hospitality" | "real_estate";
  name: string;
  slug: string;
  description: string;
  status: string;
  address_line_1?: string | null;
  city: string | null;
  region: string | null;
  timezone_override: string | null;
  currency_override: string | null;
};
type Profile = { currency: string; timezone: string } | null;
type RoomType = {
  id: string;
  organization_id: string;
  property_id: string;
  name: string;
  description: string;
  default_capacity: number;
  bed_configuration: Record<string, number>;
  amenities: string[];
  default_nightly_rate_minor: number | null;
  is_active: boolean;
  archived_at: string | null;
};
type Props = {
  workspaceId: string;
  properties: Property[];
  profile: Profile;
  schemaReady: boolean;
  schemaError: string;
  onRefresh: () => Promise<void>;
};
type BedKey = "king" | "queen" | "double" | "single" | "bunk";

function pill(status: string) { return "status-pill status-" + status.toLowerCase().replace(/[^a-z]+/g, "-"); }

const bedLabels: { key: BedKey; label: string }[] = [
  { key: "king", label: "King" },
  { key: "queen", label: "Queen" },
  { key: "double", label: "Double" },
  { key: "single", label: "Single" },
  { key: "bunk", label: "Bunk" },
];

export default function PropertyWorkspace({ workspaceId, properties, profile, schemaReady, schemaError, onRefresh }: Props) {
  const [selectedId, setSelectedId] = useState("");
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingProperty, setEditingProperty] = useState(false);
  const [editingType, setEditingType] = useState<RoomType | null>(null);
  const [addingType, setAddingType] = useState(false);

  const selected = properties.find((property) => property.id === selectedId) ?? null;
  const hospitality = properties.filter((property) => property.vertical === "hospitality");
  const realEstate = properties.filter((property) => property.vertical === "real_estate");
  const currency = selected?.currency_override || profile?.currency || "GHS";
  const timezone = selected?.timezone_override || profile?.timezone || "Africa/Accra";

  async function loadRoomTypes(propertyId: string) {
    if (!supabase || !propertyId) return;
    setLoadingTypes(true);
    setError("");
    const result = await supabase.from("room_types")
      .select("id,organization_id,property_id,name,description,default_capacity,bed_configuration,amenities,default_nightly_rate_minor,is_active,archived_at")
      .eq("organization_id", workspaceId).eq("property_id", propertyId)
      .order("name", { ascending: true });
    if (result.error) setError(result.error.message);
    else setRoomTypes((result.data ?? []) as RoomType[]);
    setLoadingTypes(false);
  }

  useEffect(() => {
    if (selectedId && !properties.some((property) => property.id === selectedId)) {
      setSelectedId("");
      setRoomTypes([]);
    }
  }, [properties, selectedId]);

  useEffect(() => {
    if (selected?.vertical === "hospitality") void loadRoomTypes(selected.id);
    else setRoomTypes([]);
  }, [selectedId]);

  async function saveProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selected) return;
    const form = new FormData(event.currentTarget);
    setSaving(true); setError(""); setNotice("");
    const result = await supabase.from("properties").update({
      name: String(form.get("name") ?? "").trim(),
      slug: String(form.get("slug") ?? "").trim().toLowerCase(),
      description: String(form.get("description") ?? "").trim(),
      address_line_1: String(form.get("address_line_1") ?? "").trim() || null,
      city: String(form.get("city") ?? "").trim() || null,
      region: String(form.get("region") ?? "").trim() || null,
      status: String(form.get("status") ?? "active"),
      timezone_override: String(form.get("timezone_override") ?? "").trim() || null,
      currency_override: String(form.get("currency_override") ?? "").trim().toUpperCase() || null,
    }).eq("organization_id", workspaceId).eq("id", selected.id).select("id").maybeSingle();
    if (result.error) setError(result.error.message);
    else if (!result.data) setError("The property was not updated. Your role may not have permission.");
    else {
      setNotice("Property details saved.");
      setEditingProperty(false);
      await onRefresh();
    }
    setSaving(false);
  }

  async function saveRoomType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selected || selected.vertical !== "hospitality") return;
    const form = new FormData(event.currentTarget);
    const bedConfiguration = Object.fromEntries(bedLabels.map(({ key }) => [key, Number(form.get("bed_" + key) ?? 0)] as const).filter(([, value]) => value > 0));
    const amenities = String(form.get("amenities") ?? "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 40);
    const rateText = String(form.get("default_rate") ?? "").trim();
    const fields = {
      name: String(form.get("name") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      default_capacity: Number(form.get("default_capacity") ?? 2),
      bed_configuration: bedConfiguration,
      amenities,
      default_nightly_rate_minor: rateText ? Math.round(Number(rateText) * 100) : null,
    };
    setSaving(true); setError(""); setNotice("");
    const result = editingType
      ? await supabase.from("room_types").update(fields).eq("organization_id", workspaceId).eq("property_id", selected.id).eq("id", editingType.id).select("id").maybeSingle()
      : await supabase.from("room_types").insert({ ...fields, organization_id: workspaceId, property_id: selected.id }).select("id").maybeSingle();
    if (result.error) setError(result.error.message);
    else if (!result.data) setError("The room type was not saved. Check your property access.");
    else {
      setNotice(editingType ? "Room type updated." : "Room type created.");
      setEditingType(null); setAddingType(false);
      await loadRoomTypes(selected.id);
    }
    setSaving(false);
  }

  async function archiveRoomType(type: RoomType) {
    if (!supabase || !selected) return;
    if (!window.confirm("Archive “" + type.name + "”? Existing rooms will keep their history, but this type will no longer be available for new rooms.")) return;
    setSaving(true); setError(""); setNotice("");
    const result = await supabase.from("room_types").update({ is_active: false, archived_at: new Date().toISOString() })
      .eq("organization_id", workspaceId).eq("property_id", selected.id).eq("id", type.id).select("id").maybeSingle();
    if (result.error) setError(result.error.message);
    else if (!result.data) setError("The room type was not archived. Check your property access.");
    else { setNotice("Room type archived. Existing room records are preserved."); await loadRoomTypes(selected.id); }
    setSaving(false);
  }

  if (!schemaReady) return <section className="surface property-schema-note"><div className="empty-icon"><BedDouble /></div><h2>Property foundation is unavailable</h2><p>The Owner Desk could not load every required property table. This can mean the property migrations have not been applied, or the current workspace does not have the required database permissions. Existing property data is hidden until the full schema is available.</p><small>{schemaError || "Refresh the workspace or ask an administrator to check the property database migrations and access policies."}</small></section>;

  if (selected) return <div className="property-management">
    <div className="property-detail-back"><button className="secondary-button" onClick={() => { setSelectedId(""); setEditingProperty(false); setAddingType(false); setEditingType(null); setError(""); setNotice(""); }}><ChevronLeft size={15} />All properties</button><span className="property-vertical">{selected.vertical === "hospitality" ? "HOSPITALITY PROPERTY" : "REAL ESTATE PROPERTY"}</span></div>
    {error && <div className="inline-alert alert-error" role="alert"><CircleHelp size={15} />{error}<button onClick={() => setError("")} aria-label="Dismiss"><X size={14} /></button></div>}
    {notice && <div className="inline-alert alert-success" role="status"><Check size={15} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}
    <section className="surface property-detail-header"><div><span className="eyebrow">PROPERTY OVERVIEW</span><h2>{selected.name}</h2><p>{[selected.city, selected.region].filter(Boolean).join(", ") || "Location not set"} · {selected.status}</p></div><button className="primary-button" onClick={() => setEditingProperty((value) => !value)}><Edit3 size={15} />{editingProperty ? "Close editor" : "Edit details"}</button></section>
    {editingProperty && <form className="surface settings-form" onSubmit={saveProperty}><div className="settings-section-heading"><div><h2>Property details</h2><p>Changes apply to this property only. Vertical and tenant identity cannot be changed.</p></div><span className="settings-readonly"><ShieldCheck size={14} />Property-scoped</span></div><div className="form-grid">
      <Field label="Property name"><input name="name" defaultValue={selected.name} required minLength={2} maxLength={120} /></Field>
      <Field label="Public slug"><input name="slug" defaultValue={selected.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></Field>
      <Field label="Address"><input name="address_line_1" defaultValue={selected.address_line_1 || ""} /></Field>
      <Field label="City"><input name="city" defaultValue={selected.city || ""} /></Field>
      <Field label="Region"><input name="region" defaultValue={selected.region || ""} /></Field>
      <Field label="Status"><select name="status" defaultValue={selected.status}><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select></Field>
      <Field label="Currency override (ISO code)"><input name="currency_override" defaultValue={selected.currency_override || ""} maxLength={3} pattern="[A-Za-z]{3}" placeholder={"Inherited: " + (profile?.currency || "GHS")} /></Field>
      <Field label="Timezone override"><input name="timezone_override" defaultValue={selected.timezone_override || ""} placeholder={"Inherited: " + (profile?.timezone || "Africa/Accra")} /></Field>
      <Field label="Description" wide><textarea name="description" rows={3} defaultValue={selected.description || ""} /></Field>
    </div><div className="settings-footer"><div><small>Effective currency: {currency} · {selected.currency_override ? "Custom override" : "Inherited from workspace"}</small><small>Effective timezone: {timezone} · {selected.timezone_override ? "Custom override" : "Inherited from workspace"}</small></div><button className="primary-button" disabled={saving}><Save size={14} />{saving ? "Saving…" : "Save property"}</button></div></form>}
    <div className="property-summary-grid"><article className="metric-card"><div className="metric-top"><span>Vertical</span><i><BedDouble /></i></div><strong>{selected.vertical === "hospitality" ? "Hospitality" : "Real estate"}</strong><small>Immutable after creation</small></article><article className="metric-card"><div className="metric-top"><span>Currency</span><i>₵</i></div><strong>{currency}</strong><small>{selected.currency_override ? "Property override" : "Inherited default"}</small></article><article className="metric-card"><div className="metric-top"><span>Timezone</span><i>◷</i></div><strong className="property-timezone-value">{timezone}</strong><small>{selected.timezone_override ? "Property override" : "Inherited default"}</small></article></div>
    {selected.vertical === "hospitality" && <section className="surface data-surface"><div className="table-toolbar"><div><h2>Room types</h2><p>Custom definitions for this property. Existing rooms retain their assigned type.</p></div><button className="primary-button" onClick={() => { setEditingType(null); setAddingType(true); }}><Plus size={15} />Add room type</button></div>
      {loadingTypes ? <div className="loading-panel"><span className="loader" />Loading room types…</div> : roomTypes.length ? <div className="room-type-list">{roomTypes.map((type) => <article className={type.is_active ? "room-type-row" : "room-type-row room-type-archived"} key={type.id}><div className="room-type-icon"><BedDouble /></div><div className="room-type-main"><b>{type.name}</b><p>{type.description || "No description added."}</p><div className="room-type-tags"><span>{type.default_capacity} guests</span>{Object.entries(type.bed_configuration || {}).filter(([, count]) => count > 0).map(([bed, count]) => <span key={bed}>{count} × {bed}</span>)}{type.amenities.map((amenity) => <span key={amenity}>{amenity}</span>)}</div></div><div className="room-type-rate">{type.default_nightly_rate_minor == null ? "Rate not set" : new Intl.NumberFormat("en-GH", { style: "currency", currency }).format(type.default_nightly_rate_minor / 100)}</div><span className={type.is_active ? "status-pill status-active" : "status-pill status-archived"}>{type.is_active ? "Active" : "Archived"}</span><div className="room-type-actions"><button className="icon-button" title="Edit room type" onClick={() => { setEditingType(type); setAddingType(false); }}><Edit3 size={15} /></button>{type.is_active && <button className="icon-button" title="Archive room type" disabled={saving} onClick={() => void archiveRoomType(type)}><Archive size={15} /></button>}</div></article>)}</div> : <div className="property-type-empty"><BedDouble /><h3>No room types yet</h3><p>Create the room categories your property actually uses. VELLARA does not impose a fixed catalogue.</p><button className="secondary-button" onClick={() => setAddingType(true)}><Plus size={14} />Create first room type</button></div>}
    </section>}
    {selected.vertical === "real_estate" && <section className="surface property-type-empty"><ShieldCheck /><h3>Real-estate workspace foundation</h3><p>Property details are ready. Listings, viewings, offers, sales and rental workflows will be introduced as a separate real-estate domain, not as hotel room inventory.</p></section>}
    {(addingType || editingType) && <RoomTypeModal key={editingType?.id || "new"} type={editingType} currency={currency} saving={saving} onClose={() => { setAddingType(false); setEditingType(null); }} onSubmit={saveRoomType} />}
  </div>;

  return <div className="property-management">
    <section className="property-summary-grid"><article className="metric-card"><div className="metric-top"><span>All properties</span><i><BedDouble /></i></div><strong>{properties.length}</strong><small>Across enabled business verticals</small></article><article className="metric-card"><div className="metric-top"><span>Hospitality</span><i><BedDouble /></i></div><strong>{hospitality.length}</strong><small>Hotels, serviced apartments and stays</small></article><article className="metric-card"><div className="metric-top"><span>Real estate</span><i><BedDouble /></i></div><strong>{realEstate.length}</strong><small>Sales and rental portfolios</small></article></section>
    <section className="surface data-surface"><div className="table-toolbar"><div><h2>Property portfolio</h2><p>Open a property to manage its details and operational configuration.</p></div><span className="table-meta">{properties.length} properties</span></div>
      {properties.length ? <div className="property-grid">{properties.map((property) => <button type="button" className="property-card property-card-button" key={property.id} onClick={() => { setSelectedId(property.id); setError(""); setNotice(""); }}><div className="property-card-top"><span className="property-vertical">{property.vertical === "hospitality" ? "HOSPITALITY" : "REAL ESTATE"}</span><span className={pill(property.status)}>{property.status}</span></div><h3>{property.name}</h3><p>{property.description || (property.vertical === "hospitality" ? "Hospitality property" : "Real-estate property")}</p><div className="property-address">{[property.city, property.region].filter(Boolean).join(", ") || "Address not added"}</div><div className="property-settings"><span><small>Currency</small><b>{property.currency_override || profile?.currency || "GHS"} · {property.currency_override ? "custom" : "inherited"}</b></span><span><small>Timezone</small><b>{property.timezone_override || profile?.timezone || "Africa/Accra"} · {property.timezone_override ? "custom" : "inherited"}</b></span></div><span className="property-card-open">Open property <ChevronLeft size={13} /></span></button>)}</div> : <div className="property-type-empty"><BedDouble /><h3>Your property portfolio is empty</h3><p>Create your first property. Room types will be configured inside each hospitality property.</p></div>}
    </section>
    <p className="property-footnote">Workspace defaults: {profile?.currency || "GHS"} · {profile?.timezone || "Africa/Accra"}. Each property can override either setting independently.</p>
  </div>;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={wide ? "field field-wide" : "field"}><span>{label}</span>{children}</label>;
}

function RoomTypeModal({ type, currency, saving, onClose, onSubmit }: { type: RoomType | null; currency: string; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card room-type-modal" onSubmit={onSubmit}>
    <div className="modal-heading"><div><span className="eyebrow">PROPERTY ROOM TYPES</span><h2>{type ? "Edit room type" : "Create room type"}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X /></button></div>
    <div className="form-grid">
      <Field label="Room type name"><input name="name" defaultValue={type?.name || ""} required minLength={1} maxLength={80} autoFocus placeholder="e.g. Executive Suite" /></Field>
      <Field label="Default guest capacity"><input name="default_capacity" type="number" min="1" max="30" required defaultValue={type?.default_capacity ?? 2} /></Field>
      <Field label={"Default nightly rate (" + currency + ")"}><input name="default_rate" type="number" min="0" step="0.01" defaultValue={type?.default_nightly_rate_minor == null ? "" : (type.default_nightly_rate_minor / 100).toFixed(2)} /></Field>
      <Field label="Amenities (comma separated)"><input name="amenities" defaultValue={(type?.amenities || []).join(", ")} placeholder="Wi-Fi, air conditioning, balcony" /></Field>
      <Field label="Description" wide><textarea name="description" rows={2} defaultValue={type?.description || ""} /></Field>
    </div>
    <div className="bed-configuration"><div><b>Bed arrangement</b><small>Enter the number of each bed included in this room type.</small></div><div className="bed-configuration-grid">{bedLabels.map(({ key, label }) => <Field key={key} label={label}><input name={"bed_" + key} type="number" min="0" max="20" defaultValue={type?.bed_configuration?.[key] ?? 0} /></Field>)}</div></div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}><Save size={14} />{saving ? "Saving…" : type ? "Save room type" : "Create room type"}</button></div>
  </form></div>;
}
