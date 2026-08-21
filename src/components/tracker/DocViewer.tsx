import { useEffect, useRef, useState } from "react";
import { useTracker } from "./TrackerContext";

export interface DocTarget {
  targetType: "payment" | "job";
  targetId: string;
  title: string;
}

export function DocViewer({ target, onClose }: { target: DocTarget; onClose: () => void }) {
  const { d, api } = useTracker();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const files = useRef<HTMLInputElement>(null);
  const list = d.attachmentsFor(target.targetType, target.targetId);

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<string, string> = {};
      for (const a of list) {
        try {
          out[a.id] = await api.signUrl(a.storage_path);
        } catch {
          /* ignore */
        }
      }
      if (alive) setUrls(out);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.targetId, list.length]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label="Document viewer">
      <div className="lbin">
        <div className="lbbar">
          <div className="t">{target.title}</div>
          <div className="acts">
            {!api.readOnly && api.upload && <button onClick={() => files.current?.click()}>Attach</button>}
            <button onClick={onClose}>Close</button>
          </div>
        </div>
        <div>
          {!list.length && <div className="empty">No proof attached yet.</div>}
          {list.map((a) => {
            const url = urls[a.id];
            const isPdf = (a.mime ?? "").includes("pdf") || a.file_name.toLowerCase().endsWith(".pdf");
            return (
              <div key={a.id}>
                {url ? (
                  isPdf ? (
                    <iframe src={url} title={a.file_name} />
                  ) : (
                    <img src={url} alt={a.file_name} />
                  )
                ) : (
                  <div className="empty">Loading…</div>
                )}
                <div className="cap">
                  <span>{a.file_name}</span>
                  <span style={{ display: "flex", gap: 6 }}>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#fff", fontSize: 11.5, fontWeight: 600 }}
                      >
                        Open
                      </a>
                    )}
                    {!api.readOnly && api.removeAttachment && (
                      <button
                        onClick={async () => {
                          await api.removeAttachment!(a.id, a.storage_path);
                          api.refresh();
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <input
        ref={files}
        type="file"
        accept="image/*,application/pdf"
        multiple
        style={{ display: "none" }}
        onChange={async (e) => {
          const chosen = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (!chosen.length || !api.upload) return;
          api.toast("Uploading…");
          for (const f of chosen) await api.upload(f, target.targetType, target.targetId);
          api.refresh();
          api.toast("Attached");
        }}
      />
    </div>
  );
}
