"use client";
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { Button } from "./ui/button";
import { requestJson } from "@/lib/client";
import type { KioskSettings } from "@/lib/kiosk-settings";

export function AdminSettings() {
  const [settings, setSettings] = useState<KioskSettings | null>(null);
  const [seconds, setSeconds] = useState("15");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      const response = await requestJson<{ settings: KioskSettings }>(
        "/api/admin/settings",
      );
      setSettings(response.settings);
      setSeconds(String(response.settings.scanSeconds));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    void requestJson<{ settings: KioskSettings }>("/api/admin/settings")
      .then((r) => {
        if (active) {
          setSettings(r.settings);
          setSeconds(String(r.settings.scanSeconds));
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="admin-kiosk-settings" aria-labelledby="settings-title">
      <div>
        <h2 id="settings-title">
          <Timer size={22} /> Pengaturan antrean booth
        </h2>
        <p>
          Setelah foto terakhir, hasil otomatis dikirim ke Drive. Durasi dimulai
          setelah QR tampil; lalu layar kembali ke pilih frame. Berlaku pada
          sesi baru.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!settings || busy) return;
          setBusy(true);
          setError("");
          setNotice("");
          void requestJson<{ settings: KioskSettings }>("/api/admin/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scanSeconds: Number(seconds),
              expectedRevision: settings.revision,
            }),
          })
            .then((r) => {
              setSettings(r.settings);
              setNotice(
                `Durasi scan disimpan: ${r.settings.scanSeconds} detik.`,
              );
            })
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        <label className="field">
          Durasi scan QR (detik)
          <input
            type="number"
            min={5}
            max={300}
            step={1}
            required
            value={seconds}
            disabled={!settings || busy}
            onChange={(e) => {
              setSeconds(e.target.value);
              setNotice("");
            }}
          />
        </label>
        <Button disabled={!settings || busy}>
          {busy ? "Menyimpan…" : "Simpan durasi"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          Muat ulang pengaturan
        </Button>
      </form>
      <small>
        Default 15 detik · batas 5–300 detik. Mode Drive: file JSON privat; mode
        demo: memori server.
      </small>
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
