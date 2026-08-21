import { z } from "zod";

export const vendorIdInput = z.object({ vendor_id: z.string().uuid() });

export const enabledInput = vendorIdInput.extend({ enabled: z.boolean() });

export const vendorSaveInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  contact_first_name: z.string().max(60).optional(),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  trade: z.string().max(80).optional(),
  initials: z.string().max(4).optional(),
  legal_name: z.string().max(160).optional(),
  address: z.string().max(300).optional(),
  bank: z.record(z.string(), z.string()).default({}),
});
