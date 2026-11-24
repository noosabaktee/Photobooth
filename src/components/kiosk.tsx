"use client";
import { useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  X,
  CircleHelp,
  Sparkles,
  Pause,
  Camera,
  ScanLine,
  Timer,
} from "lucide-react";
import { Privacy } from "./shared";
import { Button } from "./ui/button";
import { openKioskDialog } from "./self-service";
import { eventIdentity } from "@/lib/event";
function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  window.addEventListener("kiosk-motion-change", callback);
  return () => {
    query.removeEventListener("change", callback);
    window.removeEventListener("kiosk-motion-change", callback);
  };
}
function motionEnabled() {
  return (
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    document.documentElement.dataset.kioskMotion !== "off"
  );
}
export function KioskFooter() {
  const dialog = useRef<HTMLDialogElement>(null);
  const help = useRef<HTMLDialogElement>(null);
  const motion = useSyncExternalStore(
    subscribeMotion,
    motionEnabled,
    () => false,
  );
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  return (
    <>
      <footer className="kiosk-footer">
        <span>
          {eventIdentity.name} · {eventIdentity.company}
        </span>
        <button onClick={() => openKioskDialog(dialog.current)}>
          <ShieldCheck size={15} /> Privasi foto
        </button>
        <button
          className="kiosk-help-button"
          onClick={() => openKioskDialog(help.current)}
        >
          <CircleHelp size={16} /> Cara pakai
        </button>
        <button
          className="motion-toggle"
          disabled={reduced}
          aria-label={
            reduced
              ? "Animasi mengikuti pengaturan perangkat"
              : motion
                ? "Nonaktifkan animasi"
                : "Aktifkan animasi"
          }
          aria-pressed={motion}
          title={
            reduced
              ? "Reduced motion aktif di perangkat"
              : motion
                ? "Nonaktifkan animasi"
                : "Aktifkan animasi"
          }
          onClick={() => {
            document.documentElement.dataset.kioskMotion = motion
              ? "off"
              : "on";
            window.dispatchEvent(new Event("kiosk-motion-change"));
          }}
        >
          {motion ? <Sparkles size={16} /> : <Pause size={16} />}
        </button>
        <Link href="/admin" aria-label="Ruang pengelola">
          Admin ↗
        </Link>
      </footer>
      <dialog
        className="kiosk-dialog"
        ref={dialog}
        aria-labelledby="privacy-title"
      >
        <h2 id="privacy-title" tabIndex={-1}>
          Momenmu, pilihanmu.
        </h2>
        <Privacy />
        <Button onClick={() => dialog.current?.close()}>
          <X size={17} /> Tutup
        </Button>
      </dialog>
      <dialog
        className="kiosk-dialog service-help-dialog"
        ref={help}
        aria-labelledby="kiosk-help-title"
      >
        <p className="eyebrow">BISA SENDIRI, SERUNYA BARENG</p>
        <h2 id="kiosk-help-title" tabIndex={-1}>
          Tinggal ketuk, pose, simpan.
        </h2>
        <ol className="help-steps">
          <li>
            <span>
              <Timer size={22} />
            </span>
            <div>
              <strong>Mulai dari Buka kamera</strong>
              <p>
                Template sudah disiapkan pengelola. Ketuk Buka kamera pada awal
                penggunaan. Sesi berikutnya membuka kamera otomatis.
              </p>
            </div>
          </li>
          <li>
            <span>
              <Camera size={22} />
            </span>
            <div>
              <strong>Izinkan kamera & bersiap</strong>
              <p>
                Buka kamera, pilih Izinkan, lalu Mulai countdown. Ikuti 3–2–1
                dan jeda setengah detik.
              </p>
            </div>
          </li>
          <li>
            <span>
              <ScanLine size={22} />
            </span>
            <div>
              <strong>Simpan kenanganmu</strong>
              <p>
                Hasil tersimpan otomatis. Scan QR sebelum waktu habis. QR juga
                ada di PNG cetak.
              </p>
            </div>
          </li>
        </ol>
        <Button onClick={() => help.current?.close()}>
          <Sparkles size={17} /> Oke, mengerti
        </Button>
      </dialog>
    </>
  );
}
export function KioskMessage({
  message,
  error = false,
  onDismiss,
}: {
  message: string;
  error?: boolean;
  onDismiss?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className={`kiosk-message ${error ? "is-error" : ""}`}>
      <p role={error ? "alert" : "status"}>{message}</p>
      <button
        aria-label="Detail pesan"
        onClick={() => openKioskDialog(dialog.current)}
      >
        Detail
      </button>
      {onDismiss && (
        <button aria-label="Tutup pesan" onClick={onDismiss}>
          <X size={16} />
        </button>
      )}
      <dialog
        className="kiosk-dialog"
        aria-labelledby="message-title"
        ref={dialog}
      >
        <h2 id="message-title" tabIndex={-1}>
          {error ? "Ada kendala" : "Informasi"}
        </h2>
        <p>{message}</p>
        <Button onClick={() => dialog.current?.close()}>Mengerti</Button>
      </dialog>
    </div>
  );
}
