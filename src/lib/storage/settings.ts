import type { Backend } from "./backend";
import {
  DEFAULT_KIOSK_SETTINGS,
  kioskSettingsSchema,
  kioskSettingsUpdateSchema,
} from "../kiosk-settings";
import { fail } from "../errors";

const filename = "kiosk-settings.json";
let writes: Promise<unknown> = Promise.resolve();
export class SettingsRepository {
  constructor(private store: Backend) {}
  private async entry() {
    const files = (await this.store.list("frames")).filter(
      (f) => f.name === filename,
    );
    if (files.length > 1)
      fail(
        409,
        "SETTINGS_CONFLICT",
        "Ada konfigurasi ganda. Hubungi operator.",
      );
    if (!files.length)
      return { fileId: null, settings: { ...DEFAULT_KIOSK_SETTINGS } };
    const bytes = await this.store.read(files[0].id);
    if (bytes.length > 1024)
      fail(503, "INVALID_SETTINGS", "Konfigurasi booth tidak valid.");
    const settings = kioskSettingsSchema.parse(JSON.parse(bytes.toString()));
    return { fileId: files[0].id, settings };
  }
  async get() {
    return (await this.entry()).settings;
  }
  async save(value: unknown) {
    const input = kioskSettingsUpdateSchema.parse(value);
    const pending = writes.then(() => this.write(input));
    writes = pending.catch(() => {});
    return pending;
  }
  private async write(input: {
    expectedRevision: number;
    scanSeconds: number;
  }) {
    const current = await this.entry();
    if (input.expectedRevision !== current.settings.revision)
      fail(
        409,
        "REVISION_CONFLICT",
        "Pengaturan berubah. Muat ulang sebelum menyimpan.",
      );
    const settings = kioskSettingsSchema.parse({
      schemaVersion: 1,
      revision: current.settings.revision + 1,
      scanSeconds: input.scanSeconds,
    });
    const bytes = Buffer.from(JSON.stringify(settings));
    if (current.fileId) await this.store.update(current.fileId, bytes);
    else await this.store.create("frames", filename, "application/json", bytes);
    return settings;
  }
}
