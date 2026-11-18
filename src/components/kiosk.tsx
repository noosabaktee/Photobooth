"use client";
import { useRef } from "react";
import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";
import { Privacy } from "./shared";
import { Button } from "./ui/button";
import { eventIdentity } from "@/lib/event";
export function KioskFooter() {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <footer className="kiosk-footer">
        <span>
          {eventIdentity.name} · {eventIdentity.company}
        </span>
        <button onClick={() => dialog.current?.showModal()}>
          <ShieldCheck size={15} /> Privasi foto
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
        <h2 id="privacy-title">Momenmu, pilihanmu.</h2>
        <Privacy />
        <Button onClick={() => dialog.current?.close()}>
          <X size={17} /> Tutup
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
        onClick={() => dialog.current?.showModal()}
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
        <h2 id="message-title">{error ? "Ada kendala" : "Informasi"}</h2>
        <p>{message}</p>
        <Button onClick={() => dialog.current?.close()}>Mengerti</Button>
      </dialog>
    </div>
  );
}
