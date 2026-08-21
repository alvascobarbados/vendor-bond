import { csvText, summaryText, type Derived } from "@/lib/tracker-model";
import { IconCode, IconDoc, IconShare, IconTable } from "./icons";

function download(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1500);
}

export function ExportSheet({
  d,
  onClose,
  toast,
  beforePrint,
}: {
  d: Derived;
  onClose: () => void;
  toast: (m: string) => void;
  beforePrint: () => void;
}) {
  const slug = `starpoint-${d.vendor.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${d.lastDate ?? "export"}`;

  async function share() {
    const text = summaryText(d);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("Summary copied — paste it into WhatsApp");
    } catch {
      toast("Couldn't copy on this browser");
    }
  }

  const opts = [
    {
      icon: <IconDoc />,
      title: "Save as PDF",
      sub: "Full statement — print or save",
      run: () => {
        beforePrint();
        setTimeout(() => window.print(), 120);
      },
    },
    { icon: <IconShare />, title: "Share summary", sub: "Short text for WhatsApp", run: share },
    {
      icon: <IconTable />,
      title: "Download CSV",
      sub: "Every transfer with its allocations",
      run: () => download(`${slug}.csv`, new Blob([csvText(d)], { type: "text/csv;charset=utf-8" })),
    },
    {
      icon: <IconCode />,
      title: "Download JSON",
      sub: "The raw data behind this tracker",
      run: () =>
        download(
          `${slug}.json`,
          new Blob(
            [
              JSON.stringify(
                {
                  exported: new Date().toISOString().slice(0, 10),
                  asOf: d.asOf,
                  vendor: d.vendor,
                  jobs: d.jobs,
                  payments: d.payments,
                  items: [...d.openItems, ...d.resolvedItems],
                },
                null,
                2,
              ),
            ],
            { type: "application/json" },
          ),
        ),
    },
  ];

  return (
    <div className="sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheetin">
        <div className="sheethead">Export · {d.vendor.name}</div>
        {opts.map((o) => (
          <button
            key={o.title}
            className="opt"
            onClick={() => {
              onClose();
              void o.run();
            }}
          >
            {o.icon}
            <span>
              <b>{o.title}</b>
              <small>{o.sub}</small>
            </span>
          </button>
        ))}
        <button className="cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
