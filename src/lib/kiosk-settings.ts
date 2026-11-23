import { z } from "zod";

export const scanSecondsSchema = z.number().int().min(5).max(300);
export const kioskSettingsSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().nonnegative(),
    scanSeconds: scanSecondsSchema,
  })
  .strict();
export const kioskSettingsUpdateSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    scanSeconds: scanSecondsSchema,
  })
  .strict();
export type KioskSettings = z.infer<typeof kioskSettingsSchema>;
export const DEFAULT_KIOSK_SETTINGS: KioskSettings = {
  schemaVersion: 1,
  revision: 0,
  scanSeconds: 15,
};
