import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { inviteOwner, listOwners, removeOwner } from "@/lib/admin.functions";
import { Toast } from "@/components/tracker/Toast";

export const Route = createFileRoute("/owner/team")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: Team,
});

function Team() {
  const q = useQuery({ queryKey: ["owners"], queryFn: () => listOwners() });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const rows = q.data ?? [];

  return (
    <div className="ownerpage">
      <div className="ownerhead">
        <h2>Team</h2>
      </div>
      <div className="ownercard">
        <p className="hint">Anyone on this list can sign in and manage every vendor. Nobody else can.</p>
        <div className="frow">
          <label className="fw">
            <span>Invite by email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
          </label>
        </div>
        <div className="formacts">
          <button
            className="primary"
            disabled={busy || !email.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await inviteOwner({ data: { email: email.trim() } });
                setEmail("");
                setToast("Invite sent");
                void q.refetch();
              } catch (e) {
                setToast(e instanceof Error ? e.message : "Couldn't invite");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Sending…" : "Send invite"}
          </button>
        </div>
      </div>

      <div className="vlist">
        {rows.map((o) => (
          <div key={o.user_id} className="vcard">
            <div className="vcardhead">
              <span>
                <b>{o.display_name || o.email}</b>
                <small>{o.email}</small>
              </span>
            </div>
            <div className="vstatus">
              {o.is_me ? "You · " : ""}
              {o.last_sign_in_at
                ? `Last signed in ${new Date(o.last_sign_in_at).toLocaleDateString()}`
                : "Never signed in"}
            </div>
            {!o.is_me && (
              <div className="vacts">
                <button
                  className="danger"
                  onClick={async () => {
                    if (!confirm(`Remove ${o.email} from the owners list?`)) return;
                    try {
                      await removeOwner({ data: { user_id: o.user_id } });
                      void q.refetch();
                    } catch (e) {
                      setToast(e instanceof Error && e.message.includes("LAST_OWNER") ? "Can't remove the last owner" : "Couldn't remove");
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <Toast message={toast} onDone={() => setToast("")} />
    </div>
  );
}
