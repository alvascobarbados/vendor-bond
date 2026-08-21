import bcrypt from "bcryptjs";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

export const COOKIE = "rt_vsession";
const THIRTY_DAYS = 30 * 24 * 60 * 60;

export function baseUrl() {
  return process.env["PUBLIC_BASE_URL"] || "https://starpointreno.com";
}

export async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function userAgent() {
  return (getRequestHeader("user-agent") ?? "").slice(0, 200);
}

/** A short human label for the device that logged in. */
export function deviceLabel(ua: string) {
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  return "a browser";
}

export async function sha256(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hash(secret: string) {
  return bcrypt.hash(secret, 10);
}

export function compare(secret: string, stored: string | null) {
  if (!stored) return Promise.resolve(false);
  return bcrypt.compare(secret, stored);
}

export function readCookie(): string | null {
  const raw = getRequestHeader("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function writeCookie(token: string) {
  setResponseHeader(
    "set-cookie",
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${THIRTY_DAYS}`,
  );
}

export function clearCookie() {
  setResponseHeader("set-cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function openSession(vendorId: string) {
  const token = newToken();
  const ua = userAgent();
  const client = await db();
  await client.from("vendor_sessions").insert({
    vendor_id: vendorId,
    token_hash: await sha256(token),
    user_agent: ua,
    expires_at: new Date(Date.now() + THIRTY_DAYS * 1000).toISOString(),
  });
  await client
    .from("vendor_access")
    .update({ last_seen_at: new Date().toISOString(), last_device: deviceLabel(ua) })
    .eq("vendor_id", vendorId);
  writeCookie(token);
}

export async function log(vendorId: string, kind: string) {
  const client = await db();
  await client.from("vendor_login_events").insert({ vendor_id: vendorId, kind: kind as never, user_agent: userAgent() });
}

export async function vendorBySlug(slug: string) {
  const client = await db();
  const { data } = await client.from("vendors").select("*").eq("slug", slug.toLowerCase()).maybeSingle();
  return data;
}

export async function accessFor(vendorId: string) {
  const client = await db();
  const { data } = await client.from("vendor_access").select("*").eq("vendor_id", vendorId).maybeSingle();
  if (data) return data;
  const { data: created } = await client
    .from("vendor_access")
    .insert({ vendor_id: vendorId })
    .select("*")
    .single();
  return created;
}

/** Resolves the contractor session cookie and asserts it belongs to `slug`. */
export async function requireVendorSession(slug: string) {
  const token = readCookie();
  if (!token) throw new Error("NO_SESSION");
  const client = await db();
  const { data: session } = await client
    .from("vendor_sessions")
    .select("*")
    .eq("token_hash", await sha256(token))
    .maybeSingle();
  if (!session || new Date(session.expires_at) < new Date()) throw new Error("NO_SESSION");

  const vendor = await vendorBySlug(slug);
  if (!vendor || vendor.id !== session.vendor_id) throw new Error("NO_SESSION");
  const access = await accessFor(vendor.id);
  if (!access?.enabled) throw new Error("DISABLED");

  const now = new Date().toISOString();
  await client.from("vendor_sessions").update({ last_used_at: now }).eq("id", session.id);
  await client.from("vendor_access").update({ last_seen_at: now }).eq("vendor_id", vendor.id);
  return { db: client, vendorId: vendor.id };
}

export function weakPin(pin: string) {
  if (!/^\d{6}$/.test(pin)) return true;
  if (/^(\d)\1{5}$/.test(pin)) return true;
  return ["123456", "654321", "012345", "543210", "111222", "123123"].includes(pin);
}
