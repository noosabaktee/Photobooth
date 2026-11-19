"use client";

import { useId, useRef } from "react";
import { Check, RefreshCw, Sparkles, Download, QrCode } from "lucide-react";
import { Button } from "./ui/button";

export function openKioskDialog(dialog: HTMLDialogElement | null) {
  if (!dialog) return;
  dialog.showModal();
  // Start long dialogs at their heading, rather than scrolling to the last button.
  dialog.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  dialog.scrollTop = 0;
}

export function CaptureCountdown({
  value,
  shot,
  total,
}: {
  value: number;
  shot: number;
  total: number;
}) {
  return (
    <div
      className="countdown service-countdown"
      data-holding={value === 0}
      role="status"
      aria-live="assertive"
      aria-atomic="true"
    >
      <span className="sr-only">
        Foto {shot + 1} dari {total}, {value === 0 ? "Tahan pose!" : value}
      </span>
      {value > 0 && (
        <strong className="countdown-number" aria-hidden="true">
          {value}
        </strong>
      )}
    </div>
  );
}

export function Celebration() {
  return (
    <div className="service-celebration" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => (
        <i key={i} style={{ "--piece": i } as React.CSSProperties} />
      ))}
    </div>
  );
}

export function NextGuestButton({
  onConfirm,
  disabled,
}: {
  onConfirm: () => void;
  disabled: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  return (
    <>
      <Button
        variant="ghost"
        disabled={disabled}
        onClick={() => openKioskDialog(dialog.current)}
      >
        <RefreshCw size={17} /> Foto lagi
      </Button>
      <dialog
        ref={dialog}
        className="kiosk-dialog service-exit-dialog"
        aria-labelledby={title}
      >
        <span className="dialog-symbol">
          <Check size={28} />
        </span>
        <p className="eyebrow">SESI BERIKUTNYA</p>
        <h2 id={title} tabIndex={-1}>
          Sudah menyimpan hasilmu?
        </h2>
        <p>
          Kolase, video, dan QR di layar akan dihapus untuk pengguna berikutnya.
          Hasil yang sudah masuk Drive tetap tersimpan.
        </p>
        <div className="exit-reminder">
          <Download size={18} />
          <span>Download PNG / MP4</span>
          <QrCode size={18} />
          <span>Atau scan QR</span>
        </div>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => dialog.current?.close()}>
            Kembali ke hasil
          </Button>
          <Button
            onClick={() => {
              dialog.current?.close();
              onConfirm();
            }}
          >
            <Sparkles size={17} /> Ya, mulai sesi baru
          </Button>
        </div>
      </dialog>
    </>
  );
}
