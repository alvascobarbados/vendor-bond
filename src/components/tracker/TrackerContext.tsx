import { createContext, useContext } from "react";
import type { Derived } from "@/lib/tracker-model";

export interface TrackerApi {
  readOnly: boolean;
  signUrl: (path: string) => Promise<string>;
  addNote: (target_type: "job" | "payment" | "general", target_id: string | null, text: string) => Promise<void>;
  setResolved: (id: string, resolved: boolean) => Promise<void>;
  deleteItem?: (id: string) => Promise<void>;
  upload?: (file: File, target_type: "payment" | "job", target_id: string) => Promise<void>;
  removeAttachment?: (id: string, storage_path: string) => Promise<void>;
  refresh: () => void;
  toast: (msg: string) => void;
}

interface Ctx {
  d: Derived;
  api: TrackerApi;
  openDoc: (target_type: "payment" | "job", target_id: string, title: string) => void;
}

export const TrackerCtx = createContext<Ctx | null>(null);

export function useTracker() {
  const c = useContext(TrackerCtx);
  if (!c) throw new Error("TrackerCtx missing");
  return c;
}
