export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "20 Aug" or "20 Aug 2026" */
export function fdate(iso: string, year = false) {
  const p = iso.split("-");
  const s = `${parseInt(p[2]!, 10)} ${MON[parseInt(p[1]!, 10) - 1]}`;
  return year ? `${s} ${p[0]}` : s;
}

export function fmt(n: number, cents = false) {
  const neg = n < 0;
  const v = Math.abs(n);
  const s = cents ? v.toFixed(2) : String(Math.round(v));
  const parts = s.split(".");
  parts[0] = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "−" : ""}$${parts.join(".")}`;
}

/** cents only when there are cents */
export function money(n: number) {
  return fmt(n, Math.round(n) !== n);
}

export function pct(a: number, b: number) {
  return b ? (100 * a) / b : 0;
}

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export function monthName(key: string) {
  const p = key.split("-");
  return `${MONTHS_LONG[parseInt(p[1]!, 10) - 1]} ${p[0]}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
