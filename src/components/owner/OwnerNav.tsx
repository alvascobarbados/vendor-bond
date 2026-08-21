import { Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const NAV = [
  { to: "/owner", label: "Trackers", exact: true },
  { to: "/owner/vendors", label: "Vendors", exact: false },
  { to: "/owner/team", label: "Team", exact: false },
  { to: "/owner/account", label: "Account", exact: false },
  { to: "/owner/settings", label: "Settings", exact: false },
  { to: "/owner/data", label: "Data", exact: false },
] as const;

function useActive() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (to: string, exact: boolean) => (exact ? path === to : path.startsWith(to));
}

export function OwnerSidebar({ name }: { name: string }) {
  const active = useActive();
  return (
    <aside className="ownernav">
      <div className="ownerbrand">
        <span className="mark" />
        <b>Owner</b>
      </div>
      {NAV.map((n) => (
        <Link key={n.to} to={n.to} className={`navlink${active(n.to, n.exact) ? " on" : ""}`}>
          {n.label}
        </Link>
      ))}
      <div className="navfoot">
        <small>{name}</small>
        <button className="linkbtn" onClick={() => void supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </aside>
  );
}

export function OwnerMenu({ name, onClose }: { name: string; onClose: () => void }) {
  const active = useActive();
  return (
    <div className="ownersheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ownersheetin">
        <div className="sheethead">{name}</div>
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} className={`navlink big${active(n.to, n.exact) ? " on" : ""}`} onClick={onClose}>
            {n.label}
          </Link>
        ))}
        <div className="formacts">
          <button className="ghost" onClick={onClose}>
            Close
          </button>
          <button className="danger" onClick={() => void supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export function OwnerHead({ title, name }: { title: string; name: string }) {
  return (
    <div className="ownerhead">
      <h2>{title}</h2>
      <span className="ownerchip">{name}</span>
    </div>
  );
}
