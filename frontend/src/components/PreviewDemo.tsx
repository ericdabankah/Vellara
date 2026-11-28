import { useState } from "react";
import type { ReactNode } from "react";
import "./preview-demo.css";
import { Activity, BedDouble, Bell, CalendarDays, ChevronRight, CreditCard, Headphones, LayoutDashboard, LogIn, MessageSquare, Phone, Settings, ShieldCheck, Sparkles, Users, X, Zap } from "lucide-react";

type Section = "Overview" | "Properties" | "Calls" | "Reservations" | "Guests" | "Rooms" | "Activity" | "Numbers" | "AI Receptionists" | "Plans" | "Settings";

const sections: { name: Section; icon: ReactNode; group: string }[] = [
  { name: "Overview", icon: <LayoutDashboard />, group: "WORKSPACE" },
  { name: "Properties", icon: <BedDouble />, group: "WORKSPACE" },
  { name: "Calls", icon: <Phone />, group: "WORKSPACE" },
  { name: "Reservations", icon: <CalendarDays />, group: "WORKSPACE" },
  { name: "Guests", icon: <Users />, group: "WORKSPACE" },
  { name: "Rooms", icon: <BedDouble />, group: "WORKSPACE" },
  { name: "Activity", icon: <Activity />, group: "WORKSPACE" },
  { name: "Numbers", icon: <MessageSquare />, group: "MANAGE" },
  { name: "AI Receptionists", icon: <Headphones />, group: "MANAGE" },
  { name: "Plans", icon: <CreditCard />, group: "MANAGE" },
  { name: "Settings", icon: <Settings />, group: "ACCOUNT" },
];

const sampleProperties = [
  { name: "The Cedar Residence", location: "East Legon, Accra", type: "Hospitality", rooms: 24, status: "Active", tone: "cedar" },
  { name: "Palm Court Apartments", location: "Airport Residential, Accra", type: "Real estate", rooms: 8, status: "Draft", tone: "palm" },
  { name: "Blue Haven Suites", location: "Labone, Accra", type: "Hospitality", rooms: 16, status: "Active", tone: "haven" },
];

export default function PreviewDemo() {
  const [active, setActive] = useState<Section>("Overview");
  const [incomingCall, setIncomingCall] = useState(false);
  const [notice, setNotice] = useState("");
  const groups = [...new Set(sections.map((item) => item.group))];

  function selectSection(section: Section) {
    setActive(section);
    setNotice("");
  }

  return <div className="app-shell preview-shell">
    <div className="preview-ribbon"><span><span className="preview-live-dot" />STAGING PREVIEW · DEMO DATA ONLY</span><span>Changes here are not connected to live business records.</span><a href="/">Exit preview <X size={13} /></a></div>
    <aside className="sidebar preview-sidebar">
      <div className="brand-lockup"><div className="brand-mark">V</div><div><strong>VELLARA</strong><span>OWNER DESK</span></div></div>
      <div className="workspace-switcher"><div className="workspace-avatar">CR</div><div className="workspace-copy"><strong>Cedar Residence Group</strong><span>Hospitality + Real estate</span></div><ChevronRight size={14} /></div>
      {groups.map((group) => <div className="nav-section" key={group}><span>{group}</span>{sections.filter((item) => item.group === group).map((item) => <button key={item.name} className={"nav-link" + (active === item.name ? " nav-active" : "")} onClick={() => selectSection(item.name)}>{item.icon}{item.name}</button>)}</div>)}
      <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={17} /><span><b>Isolated demo environment</b><small>No production permissions</small></span></div><div className="profile-strip"><div className="profile-avatar">D</div><div><b>Preview Visitor</b><small>Demo access</small></div><LogIn size={16} /></div></div>
    </aside>
    <main className="main-area preview-main">
      <header className="topbar"><div className="topbar-left"><span>DEMO WORKSPACE</span><b>/</b><b>{active}</b></div><div className="topbar-right"><span className="secure-label"><i />Preview data</span><Bell size={16} /><div className="topbar-avatar">D</div></div></header>
      <div className="page-content">
        <div className="preview-notice"><ShieldCheck size={16} /><span><b>Safe preview mode</b> · All names, numbers, reservations and activity below are fictional sample data.</span><a href="/">Sign in to Owner Desk</a></div>
        <div className="page-heading"><div><span className="eyebrow">VELLARA OWNER DESK · STAGING</span><h1>{heading(active)}</h1><p>{description(active)}</p></div><div className="heading-actions"><span className="today-label">28 Nov 2026 · Accra</span></div></div>
        {notice && <div className="inline-alert alert-success">{notice}</div>}
        {active === "Overview" && <Overview incomingCall={incomingCall} onToggle={() => setIncomingCall((value) => !value)} onNavigate={selectSection} />}
        {active === "Properties" && <Properties onOpenMedia={() => selectSection("Properties")} />}
        {active === "Calls" && <DataPanel title="Recent calls" subtitle="Sample call records" headers={["Caller", "Channel", "Time", "Duration", "Outcome"]} rows={[["Ama Mensah", "+233 24 555 0101", "10:42 AM", "04m 12s", "Reservation enquiry"], ["Kwame Boateng", "+233 55 222 0190", "09:18 AM", "02m 48s", "Information provided"], ["Nana Osei", "+233 20 777 0134", "Yesterday", "06m 03s", "Viewing requested"]]} />}
        {active === "Reservations" && <DataPanel title="Reservation ledger" subtitle="Sample bookings, not live reservations" headers={["Guest", "Property", "Stay", "Guests", "Amount", "Status"]} rows={[["Ama Mensah", "The Cedar Residence", "02-05 Dec", "2 adults", "GHS 1,800", "Confirmed"], ["Kwame Boateng", "Blue Haven Suites", "06-08 Dec", "1 adult", "GHS 920", "Pending"], ["Esi Owusu", "The Cedar Residence", "12-15 Dec", "3 guests", "GHS 2,400", "Inquiry"]]} />}
        {active === "Guests" && <DataPanel title="Guest directory" subtitle="Fictional sample guest profiles" headers={["Guest", "Phone", "Email", "Last interaction"]} rows={[["Ama Mensah", "+233 24 555 0101", "ama@example.test", "Today"], ["Kwame Boateng", "+233 55 222 0190", "kwame@example.test", "Today"], ["Esi Owusu", "+233 20 777 0134", "esi@example.test", "Yesterday"]]} />}
        {active === "Rooms" && <DataPanel title="Room operations" subtitle="Illustrative room inventory" headers={["Room", "Property", "Type", "Capacity", "Nightly rate", "Status"]} rows={[["101", "The Cedar Residence", "Deluxe King", "2", "GHS 450", "Available"], ["102", "The Cedar Residence", "Twin Suite", "3", "GHS 520", "Occupied"], ["203", "Blue Haven Suites", "Studio", "2", "GHS 380", "Maintenance"]]} />}
        {active === "Activity" && <ActivityPanel />}
        {active === "Numbers" && <FeaturePanel icon={<Phone />} title="Connected numbers" body="Voice and WhatsApp numbers are managed here once provider verification and subscription capacity are configured." status="Backend connection required" />}
        {active === "AI Receptionists" && <FeaturePanel icon={<Sparkles />} title="AI receptionist instances" body="Configure greetings, languages, business knowledge and channel routing for each receptionist." status="Configuration preview" />}
        {active === "Plans" && <FeaturePanel icon={<CreditCard />} title="Plans & subscription" body="Review plan capacity, connected numbers, receptionist limits and billing status. Checkout is not enabled in this demo." status="Billing disabled in preview" />}
        {active === "Settings" && <FeaturePanel icon={<Settings />} title="Business settings" body="Business identity, contact information, timezone, currency and workspace configuration will be managed here." status="Read-only demo" />}
        <footer className="page-footer"><span>VELLARA OWNER DESK</span><span>Staging preview · fictional data only</span></footer>
      </div>
    </main>
  </div>;
}

function heading(section: Section) {
  const values: Record<Section, string> = { Overview: "Your desk, at a glance.", Properties: "Your properties", Calls: "Call activity", Reservations: "Reservations", Guests: "Guest directory", Rooms: "Room management", Activity: "Workspace activity", Numbers: "Connected numbers", "AI Receptionists": "Your AI receptionists", Plans: "Plans & subscription", Settings: "Business settings" };
  return values[section];
}
function description(section: Section) {
  const values: Record<Section, string> = { Overview: "A live-style view of your business operations.", Properties: "Explore property workspaces and their customer-facing assets.", Calls: "Review conversations handled by VELLARA.", Reservations: "Track enquiries and upcoming stays.", Guests: "A sample directory of guest profiles.", Rooms: "Illustrative room operations and availability.", Activity: "A sample timeline of workspace events.", Numbers: "Phone identities and communication channels.", "AI Receptionists": "Manage the intelligence layer behind each front desk.", Plans: "Understand subscription capacity and billing.", Settings: "Business identity and workspace preferences." };
  return values[section];
}
function Overview({ incomingCall, onToggle, onNavigate }: { incomingCall: boolean; onToggle: () => void; onNavigate: (section: Section) => void }) {
  const metrics = [{ label: "Calls today", value: "28", hint: "Across voice and WhatsApp", icon: <Phone /> }, { label: "Reservations", value: "14", hint: "7 confirmed · 4 pending", icon: <CalendarDays /> }, { label: "Room occupancy", value: "76%", hint: "18 of 24 rooms occupied", icon: <BedDouble /> }, { label: "Guest profiles", value: "342", hint: "Across your properties", icon: <Users /> }];
  return <>
    <section className="metric-grid">{metrics.map((item) => <article className="metric-card" key={item.label}><div className="metric-top"><span>{item.label}</span><i>{item.icon}</i></div><strong>{item.value}</strong><small>{item.hint}</small></article>)}</section>
    <div className="overview-grid">
      <section className="surface call-panel"><div className="surface-heading"><div><span className="eyebrow">LIVE RECEPTION · DEMO</span><h2>{incomingCall ? "Incoming call" : "Reception is ready"}</h2></div><span className={incomingCall ? "connection-state connected" : "connection-state"}><i />{incomingCall ? "RINGING" : "SIMULATED CONNECTION"}</span></div>
        <div className={incomingCall ? "call-stage call-stage-active call-stage-ringing" : "call-stage"}><div className="call-orbit" /><div className="call-stage-content"><div className="headset-icon"><Headphones /></div><span className="call-kicker">{incomingCall ? "INCOMING CALL · RINGING" : "AI RECEPTIONIST ONLINE"}</span><h3>{incomingCall ? "+233 24 555 0101" : "Ready for your next guest"}</h3><p>{incomingCall ? "Ama Mensah · Sample caller. This is a visual simulation only. No real phone call is connected." : "See how the Owner Desk presents the receptionist stage when the voice provider is connected."}</p><div className="call-actions"><button className="call-answer" disabled title="Call controls are not connected in preview">Answer</button><button className="call-decline" disabled title="Call controls are not connected in preview">Decline</button></div></div></div>
        <div className="call-panel-footer"><span><i />AI receptionist</span><b>VELLARA AI</b></div><button className="preview-simulate-button" onClick={onToggle}>{incomingCall ? "End visual simulation" : "Simulate incoming call"}</button>
      </section>
      <section className="surface activity-panel"><div className="surface-heading"><div><span className="eyebrow">WORKSPACE FEED</span><h2>Recent activity</h2></div><Activity size={18} /></div><div className="activity-list">{[["New reservation request","reservation · 4 min ago"],["Guest profile created","guest · 18 min ago"],["AI receptionist handled a call","call · 32 min ago"],["Property images updated","media · 1 hr ago"]].map(([title, meta]) => <div className="activity-row" key={title}><div className="activity-symbol"><Zap size={15} /></div><div><b>{title}</b><small>{meta}</small></div></div>)}</div></section>
    </div>
    <section className="quick-grid"><button className="quick-card" onClick={() => onNavigate("Properties")}><span className="quick-icon"><BedDouble /></span><span><b>Explore properties</b><small>3 sample properties</small></span><ChevronRight /></button><button className="quick-card" onClick={() => onNavigate("Reservations")}><span className="quick-icon"><CalendarDays /></span><span><b>View reservations</b><small>14 sample reservations</small></span><ChevronRight /></button><button className="quick-card" onClick={() => onNavigate("AI Receptionists")}><span className="quick-icon"><Sparkles /></span><span><b>AI receptionists</b><small>2 sample instances</small></span><ChevronRight /></button></section>
  </>;
}
function Properties({ onOpenMedia }: { onOpenMedia: () => void }) {
  const [selected, setSelected] = useState(0);
  const property = sampleProperties[selected];
  return <><div className="preview-property-grid">{sampleProperties.map((item, index) => <button className={"preview-property-card" + (selected === index ? " selected" : "")} key={item.name} onClick={() => setSelected(index)}><div className={"preview-property-art " + item.tone}><span>{item.name.split(" ").map((word) => word[0]).join("").slice(0, 2)}</span></div><div className="preview-property-copy"><span className="eyebrow">{item.type}</span><h3>{item.name}</h3><p>{item.location}</p><small>{item.rooms} units · {item.status}</small></div></button>)}</div><section className="surface preview-property-detail"><div><span className="eyebrow">SELECTED PROPERTY</span><h2>{property.name}</h2><p>{property.location} · {property.type}</p><span className="status-pill status-active">{property.status}</span></div><button className="primary-button" onClick={onOpenMedia}>Explore media library <ChevronRight size={14}/></button></section><section className="surface"><div className="surface-heading"><div><span className="eyebrow">PROPERTY MEDIA</span><h2>Customer-facing images</h2></div><span className="table-meta">Demo preview</span></div><div className="preview-media-strip"><div className="preview-media-tile cedar" /><div className="preview-media-tile palm" /><div className="preview-media-tile haven" /></div><p className="preview-media-caption">The production media library will support image uploads, categories, alt text, cover selection and explicit publication.</p></section></>;
}
function DataPanel({ title, subtitle, headers, rows }: { title: string; subtitle: string; headers: string[]; rows: string[][] }) {
  return <section className="surface data-surface"><div className="table-toolbar"><div><h2>{title}</h2><p>{subtitle}</p></div><span className="table-meta">DEMO DATA</span></div><div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cellIndex === row.length - 1 ? <span className="status-pill status-confirmed">{cell}</span> : cell}</td>)}</tr>)}</tbody></table></div></section>;
}
function ActivityPanel() {
  return <section className="surface"><div className="surface-heading"><div><span className="eyebrow">SAMPLE TIMELINE</span><h2>Recent workspace events</h2></div><Activity size={18}/></div><div className="activity-list">{[["Reservation created","Today · 10:42 AM"],["Guest profile added","Today · 09:18 AM"],["Room status updated","Yesterday · 04:32 PM"],["Property media prepared","Yesterday · 02:11 PM"]].map(([title, time]) => <div className="activity-row" key={title}><div className="activity-symbol"><Zap size={15}/></div><div><b>{title}</b><small>{time}</small></div></div>)}</div></section>;
}
function FeaturePanel({ icon, title, body, status }: { icon: ReactNode; title: string; body: string; status: string }) {
  return <section className="surface preview-feature-panel"><div className="preview-feature-icon">{icon}</div><span className="eyebrow">OWNER DESK MODULE</span><h2>{title}</h2><p>{body}</p><span className="status-pill status-pending">{status}</span></section>;
}
