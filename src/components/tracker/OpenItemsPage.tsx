import { useState } from "react";
import { fmt, money } from "@/lib/format";
import { NoteZone } from "./NoteZone";
import { useTracker } from "./TrackerContext";
import { IconCheck, IconFlag, IconX } from "./icons";
import type { Item } from "@/lib/tracker-model";

function Row({ it, done }: { it: Item; done: boolean }) {
  const { d, api } = useTracker();
  return (
    <div className={`oi${done ? " done" : ""}`}>
      <IconFlag />
      <div className="body">
        <div className="src">
          {d.itemSource(it)}
          {it.author_label && it.author_label !== "Owner" ? ` · ${it.author_label}` : ""}
        </div>
        <div className="txt">{it.text}</div>
      </div>
      <div className="acts">
        <button
          className="resolve"
          onClick={async () => {
            await api.setResolved(it.id, !done);
            api.refresh();
          }}
        >
          {done ? <IconX /> : <IconCheck />}
          {done ? "Reopen" : "Resolve"}
        </button>
        {!api.readOnly && api.deleteItem && (
          <button
            className="del"
            onClick={async () => {
              await api.deleteItem!(it.id);
              api.refresh();
            }}
          >
            <IconX />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

export function OpenItemsPage() {
  const { d, api } = useTracker();
  const [text, setText] = useState("");

  async function add() {
    const t = text.trim();
    if (!t) return;
    setText("");
    await api.addNote("general", null, t);
    api.refresh();
  }

  return (
    <section className="page active" role="tabpanel">
      <h2 className="printonly">Open items</h2>
      <p className="oi-lead">Questions and things still to settle. Tap Resolve when one is done.</p>
      <div className="addgeneral">
        <input
          type="text"
          placeholder="Add a note…"
          aria-label="Add a note"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
        />
        <button onClick={() => void add()}>Add</button>
      </div>

      {d.openItems.map((it) => (
        <Row key={it.id} it={it} done={false} />
      ))}
      {!d.openItems.length && <p className="oi-lead">Nothing open — everything is settled.</p>}

      {d.resolvedItems.length > 0 && (
        <div>
          <div className="resolved-head">Resolved</div>
          {d.resolvedItems.map((it) => (
            <Row key={it.id} it={it} done />
          ))}
        </div>
      )}

      <div className="foot">
        <div className="card grand">
          <h4>Paid to date</h4>
          <div className="row">
            <span className="k">Contract payments</span>
            <span className="v">{money(d.contractTotal)}</span>
          </div>
          <div className="row">
            <span className="k">Bills reimbursed</span>
            <span className="v">{fmt(d.billTotal, true)}</span>
          </div>
          <div className="row total">
            <span className="k">Total transferred</span>
            <span className="v">{fmt(d.grandTotal, true)}</span>
          </div>
          <div className="row">
            <span className="k">Confirmed contract balance</span>
            <span className="v">{money(d.openValue - d.openPaid)}</span>
          </div>
        </div>
        <div style={{ height: 8 }} />
        <NoteZone targetType="general" targetId={null} />
        {api.onSwitch && (
          <button className="linkbtn center switchlink" onClick={() => void api.onSwitch!()}>
            {api.switchLabel ?? "Switch"}
          </button>
        )}
      </div>
    </section>
  );
}
