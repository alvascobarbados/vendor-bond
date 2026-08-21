import type { adminListVendors } from "@/lib/vendors-admin.functions";

export type VendorRow = Awaited<ReturnType<typeof adminListVendors>>["vendors"][number];

export function ago(iso: string | null) {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} hours ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function statusLine(v: VendorRow) {
  const a = v.access;
  if (!a) return "No access set up yet.";
  if (!a.enabled) return "Access switched off.";
  const bits: string[] = [];
  if (a.has_setup_code && a.setup_code_expires_at)
    bits.push(
      new Date(a.setup_code_expires_at) > new Date() ? "Setup code active · not used yet" : "Setup code expired",
    );
  if (a.pin_set_at)
    bits.push(
      `PIN set ${new Date(a.pin_set_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}${a.last_device ? ` on ${a.last_device}` : ""}`,
    );
  if (!a.has_pin && !a.has_setup_code) bits.push("No PIN and no setup code");
  if (a.last_seen_at) bits.push(`Last seen ${ago(a.last_seen_at)}`);
  if (a.failed_attempts) bits.push(`${a.failed_attempts} failed tries`);
  if (a.locked_until && new Date(a.locked_until) > new Date())
    bits.push(
      `Locked until ${new Date(a.locked_until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    );
  return bits.join(" · ");
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function initialsOf(s: string) {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
