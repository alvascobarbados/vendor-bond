import { useState } from "react";
import { useTracker } from "./TrackerContext";
import { IconCheck, IconFlag, IconPlus, IconX } from "./icons";

export function NoteZone({
  targetType,
  targetId,
}: {
  targetType: "job" | "payment" | "general";
  targetId: string | null;
}) {
  const { d, api } = useTracker();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");

  const notes = d.openItems.filter((n) => n.target_type === targetType && (n.target_id ?? null) === targetId);

  async function submit() {
    const t = text.trim();
    if (!t) return;
    setText("");
    setAdding(false);
    await api.addNote(targetType, targetId, t);
    api.refresh();
  }

  return (
    <div className="notezone">
      <div className="notelist">
        {notes.map((n) => (
          <div className="note" key={n.id}>
            <IconFlag />
            <span className="txt">
              {n.text}
              {n.author_label && n.author_label !== "Owner" ? <span className="who"> · {n.author_label}</span> : null}
            </span>
            <span className="acts">
              <button
                title="Resolve"
                onClick={async () => {
                  await api.setResolved(n.id, true);
                  api.refresh();
                }}
              >
                <IconCheck />
              </button>
              {!api.readOnly && api.deleteItem && (
                <button
                  title="Delete"
                  onClick={async () => {
                    await api.deleteItem!(n.id);
                    api.refresh();
                  }}
                >
                  <IconX />
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
      {adding ? (
        <div className="noteform">
          <input
            autoFocus
            value={text}
            placeholder="Add a note…"
            aria-label="Add a note"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <button onClick={() => void submit()}>Add</button>
        </div>
      ) : (
        <button className="addnote" onClick={() => setAdding(true)}>
          <IconPlus />
          Add note
        </button>
      )}
    </div>
  );
}
