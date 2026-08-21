import { z } from "zod";

export const slugInput = z.object({ slug: z.string().min(1).max(60) });

export const pinInput = slugInput.extend({ pin: z.string().regex(/^\d{6}$/) });

export const setupInput = slugInput.extend({
  code: z.string().regex(/^\d{6}$/),
  pin: z.string().regex(/^\d{6}$/),
});

export const noteInput = slugInput.extend({
  target_type: z.enum(["job", "payment", "general"]),
  target_id: z.string().uuid().nullable(),
  text: z.string().min(1).max(600),
});

export const idInput = slugInput.extend({ id: z.string().uuid() });
export const pathInput = slugInput.extend({ path: z.string().min(1) });
