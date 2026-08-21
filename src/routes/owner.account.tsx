import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setDisplayName, whoAmI } from "@/lib/admin.functions";
import { Toast } from "@/components/tracker/Toast";

export const Route = createFileRoute("/owner/account")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: Account,
});

function Account() {
  const q = useQuery({ queryKey: ["whoami"], queryFn: () => whoAmI() });
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [toast, setToast] = useState("");
  const owner = q.data?.owner;

  useEffect(() => {
    if (owner) setName(owner.display_name ?? "");
  }, [owner]);

  return (
    <div className="ownerpage">
      <div className="ownerhead">
        <h2>Account</h2>
      </div>
      <div className="ownercard">
        <label className="fw">
          <span>Email</span>
          <input value={owner?.email ?? ""} readOnly />
        </label>
        <label className="fw">
          <span>Display name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="formacts">
          <button
            className="primary"
            onClick={async () => {
              await setDisplayName({ data: { display_name: name } });
              setToast("Saved");
              void q.refetch();
            }}
          >
            Save
          </button>
        </div>
      </div>

      <div className="ownercard">
        <div className="sheethead">Security</div>
        <label className="fw">
          <span>New password</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </label>
        <div className="formacts">
          <button
            className="ghost"
            disabled={pw.length < 8}
            onClick={async () => {
              const { error } = await supabase.auth.updateUser({ password: pw });
              setPw("");
              setToast(error ? error.message : "Password updated");
            }}
          >
            Update password
          </button>
          <button className="danger" onClick={() => void supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
      <Toast message={toast} onDone={() => setToast("")} />
    </div>
  );
}
