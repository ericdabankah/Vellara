import { useState } from "react";
import { Activity, Bell, BedDouble, CalendarDays, ChevronDown, Headphones, LayoutDashboard, Menu, Phone, Settings, Users, X, LogOut } from "lucide-react";
import AuthGate from "./auth/AuthGate";

const sections = ["Overview", "Calls", "Reservations", "Guests", "Rooms", "Settings"] as const;
type Section = typeof sections[number];

export default function App() {
  return (
    <AuthGate>
      {({ workspace, signOut }) => <OwnerDesk workspaceName={workspace.name} signOut={signOut} />}
    </AuthGate>
  );
}

function OwnerDesk({ workspaceName, signOut }: { workspaceName: string; signOut: () => Promise<void> }) {
 const [active,setActive] = useState<Section>("Overview");
 const [menu,setMenu] = useState(false);
 return <div className="shell">
  <aside className={menu?"sidebar open":"sidebar"}>
   <div className="brand"><b>V</b><span><strong>VELLARA</strong><small>OWNER DESK</small></span><button className="mobile-close" onClick={()=>setMenu(false)}><X/></button></div>
   <div className="workspace"><b>V</b><span>{workspaceName}<small>Workspace</small></span><ChevronDown size={15}/></div>
   <small className="nav-label">WORKSPACE</small>
   {sections.slice(0,5).map((s,i)=><button className={active===s?"nav active":"nav"} onClick={()=>{setActive(s);setMenu(false)}} key={s}>{[<LayoutDashboard/>,<Phone/>,<CalendarDays/>,<Users/>,<BedDouble/>][i]}{s}</button>)}
   <div className="grow"/><small className="nav-label">PREFERENCES</small><button className={active==="Settings"?"nav active":"nav"} onClick={()=>setActive("Settings")}><Settings/>Settings</button>
   <div className="user"><b>{workspaceName.slice(0,1).toUpperCase()}</b><span>{workspaceName}<small>Workspace member</small></span></div>
   <button className="nav signout" onClick={()=>void signOut()}><LogOut/>Sign out</button>
  </aside>
  {menu&&<button className="scrim" onClick={()=>setMenu(false)} aria-label="Close menu"/>}
  <main><header><button className="menu-button" onClick={()=>setMenu(true)}><Menu/></button><span>Workspace / <b>{active}</b></span><div className="header-right"><i/> Secure workspace <button aria-label="Notifications"><Bell/></button></div></header>
   <div className="content"><div className="intro"><div><small>YOUR PROPERTY WORKSPACE</small><h1>{active==="Overview"?"Your desk, at a glance.":active}</h1><p>A clear view of what is happening across your property.</p></div><button className="date"><CalendarDays/> Today <ChevronDown/></button></div>
   {active==="Overview"?<>
    <div className="stats">{[["Calls today",<Phone/>],["Reservations",<CalendarDays/>],["Room occupancy",<BedDouble/>],["Guest enquiries",<Users/>]].map(([label,icon])=><article className="stat" key={String(label)}><div>{icon}{label}</div><strong>—</strong><small>Awaiting live data connection</small></article>)}</div>
    <div className="columns"><article className="panel"><div className="panel-title"><span><small>LIVE RECEPTION</small><h2>Incoming call</h2></span><em>VOICE CONNECTION PENDING</em></div><div className="call-stage"><div className="rings"/><div className="call-content"><div className="headphones"><Headphones/></div><small>RECEPTION IS READY</small><h2>Ready for your next guest</h2><p>When Retell is connected, live calls and AI activity will appear here. Call controls activate only for a real call session.</p><div><button className="answer" disabled title="Available when the voice service is connected">Answer</button><button className="decline" disabled title="Available when the voice service is connected">Decline</button></div></div></div><footer>Voice assistant <span>VELLARA AI</span></footer></article>
    <article className="panel activity"><div className="panel-title"><span><small>YOUR PROPERTY</small><h2>Recent activity</h2></span><Activity/></div><div className="empty"><b>✓</b><h3>Nothing to report yet</h3><p>Calls, reservations and guest activity will appear here when connected to live data.</p></div></article></div>
   </>:<article className="panel placeholder"><h2>{active} module foundation</h2><p>This module is scaffolded. Production workflows will be connected after backend data contracts are agreed.</p></article>}
   <footer className="page-footer">VELLARA OWNER DESK <span>Built for thoughtful hospitality.</span></footer></div>
  </main>
 </div>;
}
