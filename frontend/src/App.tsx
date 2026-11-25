import { useState } from "react";
import { Activity, Bell, BedDouble, CalendarDays, ChevronDown, Headphones, LayoutDashboard, Menu, Phone, Settings, Users, X } from "lucide-react";

const sections = ["Overview", "Calls", "Reservations", "Guests", "Rooms", "Settings"] as const;
type Section = typeof sections[number];

export default function App() {
 const [active,setActive] = useState<Section>("Overview");
 const [menu,setMenu] = useState(false);
 const [call,setCall] = useState("ready");
 return <div className="shell">
  <aside className={menu?"sidebar open":"sidebar"}>
   <div className="brand"><b>V</b><span><strong>VELLARA</strong><small>OWNER DESK</small></span><button className="mobile-close" onClick={()=>setMenu(false)}><X/></button></div>
   <div className="workspace"><b>V</b><span>Your property<small>Workspace</small></span><ChevronDown size={15}/></div>
   <small className="nav-label">WORKSPACE</small>
   {sections.slice(0,5).map((s,i)=><button className={active===s?"nav active":"nav"} onClick={()=>{setActive(s);setMenu(false)}} key={s}>{[<LayoutDashboard/>,<Phone/>,<CalendarDays/>,<Users/>,<BedDouble/>][i]}{s}</button>)}
   <div className="grow"/><small className="nav-label">PREFERENCES</small><button className={active==="Settings"?"nav active":"nav"} onClick={()=>setActive("Settings")}><Settings/>Settings</button>
   <div className="user"><b>O</b><span>Workspace owner<small>Administrator</small></span></div>
  </aside>
  {menu&&<button className="scrim" onClick={()=>setMenu(false)} aria-label="Close menu"/>}
  <main><header><button className="menu-button" onClick={()=>setMenu(true)}><Menu/></button><span>Workspace / <b>{active}</b></span><div className="header-right"><i/> All systems operational <button aria-label="Notifications"><Bell/></button></div></header>
   <div className="content"><div className="intro"><div><small>TUESDAY, 25 NOVEMBER 2026</small><h1>{active==="Overview"?"Your desk, at a glance.":active}</h1><p>A clear view of what is happening across your property.</p></div><button className="date"><CalendarDays/> Today <ChevronDown/></button></div>
   {active==="Overview"?<>
    <div className="stats">{[["Calls today",<Phone/>],["Reservations",<CalendarDays/>],["Room occupancy",<BedDouble/>],["Guest enquiries",<Users/>]].map(([label,icon])=><article className="stat" key={String(label)}><div>{icon}{label}</div><strong>—</strong><small>Awaiting live data connection</small></article>)}</div>
    <div className="columns"><article className="panel"><div className="panel-title"><span><small>LIVE RECEPTION</small><h2>Incoming call</h2></span><em>● LIVE STAGE</em></div><div className="call-stage"><div className="rings"/><div className="call-content"><div className="headphones"><Headphones/></div><small>{call==="ready"?"RECEPTION IS READY":call==="answered"?"CALL ANSWERED":"CALL DECLINED"}</small><h2>{call==="ready"?"Your next guest":call==="answered"?"Connected":"Call ended"}</h2><p>Incoming calls will appear here when your voice service is connected.</p><div><button className="answer" onClick={()=>setCall("answered")}>☎ Answer</button><button className="decline" onClick={()=>setCall("declined")}>Decline</button></div>{call!=="ready"&&<button className="reset" onClick={()=>setCall("ready")}>Reset preview</button>}</div></div><footer>Voice assistant <span>VELLARA AI</span></footer></article>
    <article className="panel activity"><div className="panel-title"><span><small>YOUR PROPERTY</small><h2>Recent activity</h2></span><Activity/></div><div className="empty"><b>✓</b><h3>Nothing to report yet</h3><p>Calls, reservations and guest activity will appear here.</p></div></article></div>
   </>:<article className="panel placeholder"><h2>{active} module foundation</h2><p>This module is scaffolded. Production workflows will be connected after backend data contracts are agreed.</p></article>}
   <footer className="page-footer">VELLARA OWNER DESK <span>Built for thoughtful hospitality.</span></footer></div>
  </main>
 </div>;
}
