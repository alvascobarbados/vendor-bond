import { useRef } from "react";
import { useTracker } from "./TrackerContext";
import { IconClip, IconTick } from "./icons";

export function DocChip({
  targetType,
  targetId,
  label,
  title,
}: {
  targetType: "payment" | "job";
  targetId: string;
  label: string;
  title: string;
}) {
  const { d, api, openDoc } = useTracker();
  const files = useRef<HTMLInputElement>(null);
  const n = d.attachmentsFor(targetType, targetId).length;

  return (
    <span className="docs">
      {n > 0 ? (
        <button className="receipt" title={title} onClick={() => openDoc(targetType, targetId, label)}>
          <IconTick />
          {label}
          {n > 1 ? ` · ${n}` : ""}
        </button>
      ) : (
        <span className="receipt none" title="No proof attached yet">
          {label}
        </span>
      )}
      {!api.readOnly && api.upload && (
        <>
          <button
            className="attach-add"
            title="Attach proof (photo or PDF)"
            onClick={() => files.current?.click()}
            aria-label={`Attach proof to ${label}`}
          >
            <IconClip />
          </button>
          <input
            ref={files}
            type="file"
            accept="image/*,application/pdf"
            multiple
            style={{ display: "none" }}
            onChange={async (e) => {
              const list = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (!list.length) return;
              api.toast("Uploading…");
              for (const f of list) await api.upload!(f, targetType, targetId);
              api.refresh();
              api.toast(list.length > 1 ? `${list.length} files attached` : "Attached");
            }}
          />
        </>
      )}
    </span>
  );
}
